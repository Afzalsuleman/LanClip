// Subnet Scanner - Auto-discover peers by scanning the local network
// This bypasses mDNS and works even when multicast is blocked
import { EventEmitter } from 'events';
import * as net from 'net';
import * as os from 'os';
import type { Device } from '@lanclip/shared';
import { logger } from '../utils/logger.js';

const SCAN_INTERVAL_MS = 30_000; // Scan every 30 seconds
const CONNECT_TIMEOUT_MS = 500;  // 500ms timeout per IP

export class SubnetScanner extends EventEmitter {
  private port: number;
  private deviceId: string;
  private knownPeers: Set<string> = new Set();
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private localIPs: Set<string> = new Set();

  constructor(port: number, deviceId: string) {
    super();
    this.port = port;
    this.deviceId = deviceId;
  }

  /** Get all local non-loopback IPv4 addresses */
  private getLocalIPs(): string[] {
    const results: string[] = [];
    const ifaces = os.networkInterfaces();
    for (const iface of Object.values(ifaces)) {
      for (const addr of iface ?? []) {
        if (addr.family === 'IPv4' && !addr.internal) {
          results.push(addr.address);
          this.localIPs.add(addr.address);
        }
      }
    }
    return results;
  }

  /** Derive all IPs in a /24 subnet from a given IP */
  private getSubnetIPs(localIP: string): string[] {
    const parts = localIP.split('.');
    if (parts.length !== 4) return [];
    const base = `${parts[0]}.${parts[1]}.${parts[2]}`;
    const ips: string[] = [];
    for (let i = 1; i <= 254; i++) {
      ips.push(`${base}.${i}`);
    }
    return ips;
  }

  /** Check if a single IP has LANClip running on our port */
  private probeIP(ip: string): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(CONNECT_TIMEOUT_MS);
      socket
        .connect(this.port, ip, () => {
          socket.destroy();
          resolve(true);
        })
        .on('error', () => {
          socket.destroy();
          resolve(false);
        })
        .on('timeout', () => {
          socket.destroy();
          resolve(false);
        });
    });
  }

  /** Scan the entire /24 subnet in parallel batches */
  async scan(): Promise<void> {
    const localIPs = this.getLocalIPs();
    if (localIPs.length === 0) {
      logger.warn('⚠️  No network interfaces found, skipping scan');
      return;
    }

    const allTargets: string[] = [];
    for (const localIP of localIPs) {
      for (const ip of this.getSubnetIPs(localIP)) {
        // Skip our own IPs
        if (!this.localIPs.has(ip)) {
          allTargets.push(ip);
        }
      }
    }

    logger.info(`🔍 Scanning ${allTargets.length} IPs on subnet for LANClip peers...`);

    // Scan in parallel batches of 50 to avoid overwhelming the network
    const BATCH_SIZE = 50;
    const newPeers: string[] = [];

    for (let i = 0; i < allTargets.length; i += BATCH_SIZE) {
      const batch = allTargets.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (ip) => {
          const alive = await this.probeIP(ip);
          return { ip, alive };
        })
      );
      for (const { ip, alive } of results) {
        if (alive) newPeers.push(ip);
      }
    }

    if (newPeers.length === 0) {
      logger.info('📡 No peers found on subnet');
      return;
    }

    logger.info(`✅ Found ${newPeers.length} peer(s) on subnet: ${newPeers.join(', ')}`);

    for (const ip of newPeers) {
      if (!this.knownPeers.has(ip)) {
        this.knownPeers.add(ip);
        const device: Device = {
          id: `subnet-${ip}`,
          name: ip,
          ip,
          port: this.port,
          status: 'online',
          lastSeen: Date.now(),
        };
        logger.info(`📍 Peer discovered via subnet scan: ${ip}:${this.port}`);
        this.emit('deviceFound', device);
      }
    }

    // Mark peers that disappeared as lost
    for (const knownIP of this.knownPeers) {
      if (!newPeers.includes(knownIP)) {
        this.knownPeers.delete(knownIP);
        logger.info(`📴 Peer no longer reachable: ${knownIP}`);
        this.emit('deviceLost', { id: `subnet-${knownIP}` });
      }
    }
  }

  start(): void {
    logger.info('🔍 Subnet scanner started');
    // Initial scan immediately
    this.scan();
    // Repeat every 30s
    this.scanTimer = setInterval(() => this.scan(), SCAN_INTERVAL_MS);
  }

  stop(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    logger.info('🛑 Subnet scanner stopped');
  }
}
