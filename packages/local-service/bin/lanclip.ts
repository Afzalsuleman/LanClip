#!/usr/bin/env node
// LANClip CLI - npm global package entry point

import { createInterface } from 'readline';
import { loadConfig, setEncryptionKey, clearEncryptionKey, getConfigPath } from '../src/config.js';

const command = process.argv[2];
const arg = process.argv[3];

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

const HELP = `
LANClip - LAN Clipboard Sync

Usage:
  lanclip start          Start the clipboard sync service
  lanclip stop           Stop the running service
  lanclip status         Show current status and connected peers
  lanclip set-key <key>  Set encryption key (same key on all devices)
  lanclip clear-key      Remove encryption key (disable encryption)
  lanclip config         Show current configuration
  lanclip help           Show this help

Examples:
  lanclip start
  lanclip set-key my-secret-room-code
  lanclip status
`;

async function main() {
  switch (command) {
    case 'start': {
      const config = loadConfig();

      // First-time setup: interactively ask for encryption key if not set
      if (!config.encryptionKey) {
        console.log('');
        console.log('🎉 Welcome to LANClip!');
        console.log('──────────────────────────────────────────');
        console.log('🔐 No encryption key found.');
        console.log('   Both devices must use the SAME key to sync.');
        console.log('');

        let key = '';
        while (key.length < 6) {
          key = await prompt('   Enter a room code (min 6 chars): ');
          if (key.length === 0) {
            const skip = await prompt('   ⚠️  Skip encryption? Data will be unencrypted. (y/N): ');
            if (skip.toLowerCase() === 'y') {
              console.log('   ⚠️  Skipping encryption.');
              break;
            }
          } else if (key.length < 6) {
            console.log('   ❌ Key too short! Must be at least 6 characters. Try again.');
          }
        }

        if (key.length >= 6) {
          setEncryptionKey(key);
          console.log(`   ✅ Key saved: "${key}"`);
          console.log('   Use the same key on all devices!');
        }

        console.log('──────────────────────────────────────────');
        console.log('');
      }

      console.log('🚀 Starting LANClip service...');
      // Dynamically import and run the main service (runs on import as side-effect)
      await import('../src/main.js');
      break;
    }

    case 'stop': {
      // Find and kill the running process
      const { execSync } = await import('child_process');
      try {
        const pid = execSync('lsof -ti:8765 2>/dev/null || true').toString().trim();
        if (pid) {
          execSync(`kill ${pid}`);
          console.log('✅ LANClip service stopped');
        } else {
          console.log('ℹ️  LANClip is not running');
        }
      } catch {
        console.log('ℹ️  LANClip is not running');
      }
      break;
    }

    case 'status': {
      const { WebSocket } = await import('ws');
      const config = loadConfig();

      process.stdout.write('🔍 Checking LANClip service status...\n');

      const ws = new WebSocket('ws://localhost:8765');
      const timeout = setTimeout(() => {
        console.log('❌ LANClip is NOT running');
        console.log('   Start it with: lanclip start');
        ws.terminate();
        process.exit(0);
      }, 2000);

      ws.on('open', () => {
        clearTimeout(timeout);
        console.log('✅ LANClip is running on port 8765');
        console.log(`🔐 Encryption: ${config.encryptionKey ? 'Enabled ✅' : 'Disabled ⚠️'}`);
        console.log(`📋 Config: ${getConfigPath()}`);
        ws.send(JSON.stringify({ type: 'get_status' }));
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'status') {
            const peers = msg.payload?.peers ?? [];
            console.log(`💻 Connected peers: ${peers.length > 0 ? peers.join(', ') : 'None found yet'}`);
          }
        } catch { /* ignore */ }
        ws.close();
        process.exit(0);
      });

      ws.on('error', () => {
        clearTimeout(timeout);
        console.log('❌ LANClip is NOT running');
        console.log('   Start it with: lanclip start');
        process.exit(0);
      });
      break;
    }

    case 'set-key': {
      if (!arg) {
        console.error('❌ Please provide a key: lanclip set-key <your-secret-key>');
        process.exit(1);
      }
      if (arg.length < 6) {
        console.error('❌ Key must be at least 6 characters long');
        process.exit(1);
      }
      setEncryptionKey(arg);
      console.log(`🔐 Encryption enabled with key: "${arg}"`);
      console.log('   Make sure to use the SAME key on all devices!');
      console.log('   Restart the service to apply: lanclip start');
      break;
    }

    case 'clear-key': {
      clearEncryptionKey();
      console.log('⚠️  Encryption disabled. Clipboard data will be sent as plain text.');
      console.log('   Restart the service to apply: lanclip start');
      break;
    }

    case 'config': {
      const config = loadConfig();
      console.log('📋 LANClip Configuration:');
      console.log(`   Config file: ${getConfigPath()}`);
      console.log(`   Port: ${config.port}`);
      console.log(`   Encryption: ${config.encryptionKey ? `Enabled (key: "${config.encryptionKey}")` : 'Disabled'}`);
      break;
    }

    case 'help':
    case '--help':
    case '-h':
    case undefined:
      console.log(HELP);
      break;

    default:
      console.error(`❌ Unknown command: ${command}`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
