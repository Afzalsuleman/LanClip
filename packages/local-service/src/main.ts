// LANClip Local Service - Main Entry Point
import { createInterface } from 'readline';
import { ClipboardMonitor } from './clipboard/monitor.js';
import { MDNSDiscovery } from './network/mdns-discovery.js';
import { SubnetScanner } from './network/subnet-scanner.js';
import { WebSocketServer } from './network/websocket-server.js';
import { encrypt, decrypt } from './crypto/encryption.js';
import { loadConfig } from './config.js';
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
  const config = loadConfig();
  const PORT = config.port;
  const PEER_IP = process.env.PEER_IP;

  // ── Ask for encryption key every time on startup ──────────────────
  let encryptionKey: string | null = null;

  console.log('');
  console.log('🎉 Welcome to LANClip!');
  console.log('──────────────────────────────────────────');
  console.log('🔐 Enter a room code to encrypt your clipboard data.');
  console.log('   Both devices must use the SAME code to sync.');
  console.log('');

  while (true) {
    const key = await prompt('   Enter room code (min 6 chars, or Enter to skip): ');
    if (key.length === 0) {
      const skip = await prompt('   ⚠️  Skip encryption? Clipboard sent as plain text. (y/N): ');
      if (skip.toLowerCase() === 'y') {
        console.log('   ⚠️  Starting WITHOUT encryption.');
        break;
      }
    } else if (key.length < 6) {
      console.log('   ❌ Too short! Must be at least 6 characters. Try again.');
    } else {
      encryptionKey = key;
      console.log(`   ✅ Room code accepted: "${key}"`);
      console.log('   Use the SAME code on all devices!');
      break;
    }
  }

  console.log('──────────────────────────────────────────');
  console.log('');

  logger.info('🚀 Starting LANClip Local Service...');
  logger.info(`Device: ${os.hostname()}`);

  if (encryptionKey) {
    logger.info('🔐 Encryption: ENABLED');
  } else {
    logger.warn('⚠️  Encryption: DISABLED — clipboard data is sent as plain text');
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

    // 3. Start mDNS discovery
    const mdns = new MDNSDiscovery(SERVICE_NAME, PORT, deviceId);
    await mdns.start();
    mdns.on('deviceFound', onDeviceFound);
    mdns.on('deviceLost', onDeviceLost);
    logger.info('✅ mDNS discovery started');

    // 4. Start subnet scanner
    if (!PEER_IP) {
      const scanner = new SubnetScanner(PORT, deviceId);
      scanner.on('deviceFound', onDeviceFound);
      scanner.on('deviceLost', onDeviceLost);
      scanner.start();
      logger.info('✅ Subnet scanner started (auto-discovery)');
      process.on('SIGINT', () => scanner.stop());
    }

    // 5. Manual peer override
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

      // Encrypt before sending to peers
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

      // Also notify extension with the PLAIN text (user copied it, so they know what it is)
      wsServer.notifyExtensionClipboard(text, 'self');
    });

    clipboard.start();
    logger.info('✅ Clipboard monitoring started');

    // 7. Handle incoming clipboard updates from peers
    wsServer.on('message', async (data) => {
      if (data.type === 'clipboard.update') {
        const payload = data.payload as any;
        let text: string = payload.data;

        // Decrypt if encrypted
        if (payload.encrypted && encryptionKey) {
          const decrypted = decrypt(text, encryptionKey);
          if (decrypted === null) {
            logger.warn('⚠️  Decryption failed — wrong room code? Message ignored.');
            return;
          }
          text = decrypted;
          logger.info(`📥 Received & decrypted clipboard from peer: ${payload.sourceDeviceId}`);
        } else if (payload.encrypted && !encryptionKey) {
          logger.warn('⚠️  Received encrypted message but no key set — ignored');
          return;
        } else {
          logger.info(`📥 Received clipboard update from peer: ${payload.sourceDeviceId}`);
        }

        // Write decrypted text to local clipboard
        await clipboard.setClipboard(text);

        // Send DECRYPTED text to Chrome extension (so it shows plaintext in history)
        wsServer.notifyExtensionClipboard(text, payload.sourceDeviceId);
      }

      if (data.type === 'ping') {
        wsServer.broadcastToPeer((data as any).sourceDeviceId, {
          type: 'pong',
          timestamp: Date.now(),
        });
      }

      // Handle clipboard sent from extension → encrypt and broadcast to peers
      if (data.type === 'clipboard.update' && (data.payload as any).sourceDeviceId === 'extension') {
        const plainText = (data.payload as any).data;
        const payload = encryptionKey ? encrypt(plainText, encryptionKey) : plainText;
        wsServer.broadcast({
          type: 'clipboard.update',
          payload: {
            id: `clip-${Date.now()}`,
            data: payload,
            contentType: 'text',
            timestamp: Date.now(),
            sourceDeviceId: deviceId,
            encrypted: !!encryptionKey,
          } as any,
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
