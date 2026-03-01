// LANClip Local Service - Main Entry Point
import { ClipboardMonitor } from './clipboard/monitor.js';
import { MDNSDiscovery } from './network/mdns-discovery.js';
import { WebSocketServer } from './network/websocket-server.js';
import { logger } from './utils/logger.js';
import os from 'os';

const PORT = 8765;
const SERVICE_NAME = '_lanclip._tcp.local';

async function main() {
  logger.info('🚀 Starting LANClip Local Service...');
  logger.info(`Device: ${os.hostname()}`);

  try {
    // 1. Start WebSocket server for P2P communication
    const wsServer = new WebSocketServer(PORT);
    await wsServer.start();
    logger.info(`✅ WebSocket server started on port ${PORT}`);

    // 2. Start mDNS discovery
    const deviceId = `lanclip-${os.hostname()}-${Date.now()}`;
    const mdns = new MDNSDiscovery(SERVICE_NAME, PORT, deviceId);
    await mdns.start();
    logger.info('✅ mDNS discovery started');

    // 3. Start clipboard monitoring
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

    // 4. Handle incoming clipboard updates from peers
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

    // 5. Handle device discovery
    mdns.on('deviceFound', (device) => {
      logger.info(`🔍 Discovered device: ${device.name} at ${device.ip}:${device.port}`);
      wsServer.connectToPeer(device);
    });

    mdns.on('deviceLost', (device) => {
      logger.info(`❌ Device lost: ${device.name}`);
      wsServer.disconnectPeer(device.id);
    });

    logger.info('✨ LANClip service running successfully!');
    logger.info('💡 Copy text on this device to sync with peers on the same network');

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
