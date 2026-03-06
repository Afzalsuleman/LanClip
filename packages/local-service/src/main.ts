// LANClip Local Service - Main Entry Point
import { createInterface } from 'readline';
import { ClipboardMonitor } from './clipboard/monitor.js';
import { MDNSDiscovery } from './network/mdns-discovery.js';
import { SubnetScanner } from './network/subnet-scanner.js';
import { WebSocketServer } from './network/websocket-server.js';
import { encrypt, decrypt } from './crypto/encryption.js';
import { loadConfig, setEncryptionKey } from './config.js';
import { logger } from './utils/logger.js';
import os from 'os';

/** Prompt user for input in terminal */
function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  let config = loadConfig();
  const PORT = config.port;
  const PEER_IP = process.env.PEER_IP;

  // ── First-time setup: ask for encryption key if none set ──
  if (!config.encryptionKey) {
    console.log('');
    console.log('🎉 Welcome to LANClip!');
    console.log('──────────────────────────────────────────');
    console.log('🔐 No encryption key found.');
    console.log('   Both devices must use the SAME key to sync.');
    console.log('');

    let key = '';
    while (true) {
      key = await prompt('   Enter a room code (min 6 chars, or press Enter to skip): ');
      if (key.length === 0) {
        const skip = await prompt('   ⚠️  Skip encryption? Data will be unencrypted. (y/N): ');
        if (skip.toLowerCase() === 'y') {
          console.log('   ⚠️  Starting without encryption.');
          break;
        }
      } else if (key.length < 6) {
        console.log('   ❌ Too short! Must be at least 6 characters. Try again.');
      } else {
        setEncryptionKey(key);
        console.log(`   ✅ Key saved: "${key}"`);
        console.log('   Use the SAME key on all devices!');
        config = loadConfig(); // reload config with new key
        break;
      }
    }

    console.log('──────────────────────────────────────────');
    console.log('');
  }

  const encryptionKey = config.encryptionKey;

  logger.info('🚀 Starting LANClip Local Service...');
  logger.info(`Device: ${os.hostname()}`);

  if (encryptionKey) {
    logger.info('🔐 Encryption: ENABLED');
  } else {
    logger.warn('⚠️  Encryption: DISABLED (run: pnpm dev:service to set a key)');
  }

  try {
    // 1. Start WebSocket server for P2P communication
    const wsServer = new WebSocketServer(PORT);
    await wsServer.start();
    logger.info(`✅ WebSocket server started on port ${PORT}`);

    // 2. Create a shared device-found handler
    const SERVICE_NAME = '_lanclip._tcp.local';
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

      // Encrypt if key is set
      const payload = encryptionKey ? encrypt(text, encryptionKey) : text;
      const isEncrypted = !!encryptionKey;

      wsServer.broadcast({
        type: 'clipboard.update',
        payload: {
          id: `clip-${Date.now()}`,
          data: payload,
          contentType: 'text',
          timestamp: Date.now(),
          sourceDeviceId: deviceId,
          encrypted: isEncrypted,
        } as any,
      });
    });

    clipboard.start();
    logger.info('✅ Clipboard monitoring started');

    // 7. Handle incoming clipboard updates from peers
    wsServer.on('message', async (data) => {
      if (data.type === 'clipboard.update') {
        const payload = data.payload as any;
        let text: string = payload.data;

        // Decrypt if the message is encrypted
        if (payload.encrypted && encryptionKey) {
          const decrypted = decrypt(text, encryptionKey);
          if (decrypted === null) {
            logger.warn('⚠️  Received encrypted message but decryption failed (wrong key?)');
            return;
          }
          text = decrypted;
          logger.info(`📥 Received & decrypted clipboard from peer: ${payload.sourceDeviceId}`);
        } else if (payload.encrypted && !encryptionKey) {
          logger.warn('⚠️  Received encrypted message but no key is set — ignored');
          return;
        } else {
          logger.info(`📥 Received clipboard update from peer: ${payload.sourceDeviceId}`);
        }

        await clipboard.setClipboard(text);
      }

      if (data.type === 'ping') {
        wsServer.broadcastToPeer((data as any).sourceDeviceId, {
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
