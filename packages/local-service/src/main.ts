// LANClip Local Service - Main Entry Point
import { ClipboardMonitor } from './clipboard/monitor.js';
import { MDNSDiscovery } from './network/mdns-discovery.js';
import { SubnetScanner } from './network/subnet-scanner.js';
import { WebSocketServer } from './network/websocket-server.js';
import { logger } from './utils/logger.js';
import os from 'os';

const PORT = parseInt(process.env.PORT || '8765');
const PEER_IP = process.env.PEER_IP; // Optional: manual override
const SERVICE_NAME = '_lanclip._tcp.local';

async function main() {
  logger.info('🚀 Starting LANClip Local Service...');
  logger.info(`Device: ${os.hostname()}`);

  try {
    // 1. Start WebSocket server for P2P communication
    const wsServer = new WebSocketServer(PORT);
    await wsServer.start();
    logger.info(`✅ WebSocket server started on port ${PORT}`);

    // 2. Create a shared device-found handler
    const deviceId = `lanclip-${os.hostname()}-${Date.now()}`;

    const onDeviceFound = (device: { id: string; name: string; ip: string; port: number; status: 'online' | 'offline'; lastSeen?: number }) => {
      logger.info(`📍 Device found: ${device.name} at ${device.ip}:${device.port}`);
      wsServer.connectToPeer(device);
    };

    const onDeviceLost = (device: { id: string; name?: string }) => {
      logger.info(`📴 Device lost: ${device.id}`);
      wsServer.disconnectPeer(device.id);
    };

    // 3. Start mDNS discovery (works when multicast is allowed)
    const mdns = new MDNSDiscovery(SERVICE_NAME, PORT, deviceId);
    await mdns.start();
    mdns.on('deviceFound', onDeviceFound);
    mdns.on('deviceLost', onDeviceLost);
    logger.info('✅ mDNS discovery started');

    // 4. Start subnet scanner (auto-discover peers via TCP probe - works when mDNS is blocked)
    if (!PEER_IP) {
      const scanner = new SubnetScanner(PORT, deviceId);
      scanner.on('deviceFound', onDeviceFound);
      scanner.on('deviceLost', onDeviceLost);
      scanner.start();
      logger.info('✅ Subnet scanner started (auto-discovery)');

      process.on('SIGINT', () => scanner.stop());
    }

    // 5. Manual peer override (if PEER_IP is set - takes priority)
    if (PEER_IP) {
      logger.info(`🔧 Manual peer mode: connecting to ${PEER_IP}:${PORT}`);
      setTimeout(() => {
        onDeviceFound({
          id: `manual-${PEER_IP}`,
          name: `Manual-Peer-${PEER_IP}`,
          ip: PEER_IP,
          port: PORT,
          status: 'online',
        });
      }, 2000);
    }

    // 6. Start clipboard monitoring
    const clipboard = new ClipboardMonitor(deviceId);

    clipboard.on('change', async (text: string) => {
      logger.info(`📋 Clipboard changed (${text.length} chars), broadcasting to peers...`);
      wsServer.broadcast({
        type: 'clipboard.update',
        payload: {
          id: `clip-${Date.now()}`,
          data: text,
          contentType: 'text',
          timestamp: Date.now(),
          sourceDeviceId: deviceId,
        },
      });
    });

    clipboard.start();
    logger.info('✅ Clipboard monitoring started');

    // 7. Handle incoming clipboard updates from peers
    wsServer.on('message', async (data) => {
      if (data.type === 'clipboard.update') {
        logger.info(`📥 Received clipboard update from peer: ${data.payload.sourceDeviceId}`);
        await clipboard.setClipboard(data.payload.data);
      }

      if (data.type === 'ping') {
        wsServer.broadcastToPeer(data.sourceDeviceId, {
          type: 'pong',
          timestamp: Date.now(),
        });
      }
    });

    logger.info('✨ LANClip service running successfully!');
    logger.info('💡 Scanning for peers on your LAN automatically...');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('\n🛑 Shutting down...');
      clipboard.stop();
      wsServer.stop();
      mdns.stop();
      process.exit(0);
    });
  } catch (error) {
    logger.error('❌ Failed to start service:', error);
    process.exit(1);
  }
}

main();
