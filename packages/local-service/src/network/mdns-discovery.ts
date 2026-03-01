// mDNS device discovery module
import { Bonjour } from 'bonjour-service';
import { EventEmitter } from 'events';
import os from 'os';
import type { Device } from '@lanclip/shared';
import { logger } from '../utils/logger.js';

export class MDNSDiscovery extends EventEmitter {
  private bonjour: any;
  private browser: any;
  private service: any;
  private devices: Map<string, Device> = new Map();
  private serviceName: string;
  private port: number;
  private deviceId: string;

  constructor(serviceName: string, port: number, deviceId: string) {
    super();
    this.serviceName = serviceName;
    this.port = port;
    this.deviceId = deviceId;
  }

  async start() {
    this.bonjour = new Bonjour();

    // Get device name
    const deviceName = os.hostname();

    // Publish this device
    this.service = this.bonjour.publish({
      name: deviceName,
      type: 'lanclip',
      port: this.port,
      txt: {
        deviceId: this.deviceId,
      },
    });

    logger.info(`📡 Broadcasting device: ${deviceName} on port ${this.port}`);

    // Discover other devices
    this.browser = this.bonjour.find({ type: 'lanclip' });

    this.browser.on('up', (service: any) => {
      // Don't discover ourselves
      if (service.txt?.deviceId === this.deviceId) {
        return;
      }

      const device: Device = {
        id: service.txt?.deviceId || service.fqdn,
        name: service.name,
        ip: service.referer?.address || service.host,
        port: service.port,
        status: 'online',
        lastSeen: Date.now(),
      };

      this.devices.set(device.id, device);
      logger.info(`📍 Device found: ${device.name} at ${device.ip}:${device.port}`);
      this.emit('deviceFound', device);
    });

    this.browser.on('down', (service: any) => {
      const deviceId = service.txt?.deviceId || service.fqdn;
      const device = this.devices.get(deviceId);

      if (device) {
        device.status = 'offline';
        logger.info(`📴 Device went offline: ${device.name}`);
        this.emit('deviceLost', device);
        this.devices.delete(deviceId);
      }
    });

    logger.info('mDNS discovery started');
  }

  stop() {
    if (this.browser) {
      this.browser.stop();
    }
    if (this.service) {
      this.bonjour.unpublishAll();
    }
    if (this.bonjour) {
      this.bonjour.destroy();
    }
    logger.info('mDNS discovery stopped');
  }

  getDiscoveredDevices(): Device[] {
    return Array.from(this.devices.values());
  }
}
