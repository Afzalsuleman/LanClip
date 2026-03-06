// LANClip configuration loader
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG_DIR = join(homedir(), '.lanclip');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export interface LanClipConfig {
  encryptionKey: string | null;
  port: number;
}

function defaultConfig(): LanClipConfig {
  return {
    encryptionKey: null,
    port: 8765,
  };
}

export function loadConfig(): LanClipConfig {
  // 1. Environment variable takes highest priority
  const envKey = process.env.LANCLIP_KEY;
  const envPort = process.env.PORT ? parseInt(process.env.PORT) : undefined;

  // 2. Try reading from config file
  let fileConfig: Partial<LanClipConfig> = {};
  if (existsSync(CONFIG_FILE)) {
    try {
      fileConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
    } catch {
      // Ignore parse errors, use defaults
    }
  }

  return {
    encryptionKey: envKey ?? fileConfig.encryptionKey ?? null,
    port: envPort ?? fileConfig.port ?? 8765,
  };
}

export function saveConfig(updates: Partial<LanClipConfig>): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const current = loadConfig();
  const merged = { ...current, ...updates };
  writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
}

export function setEncryptionKey(key: string): void {
  saveConfig({ encryptionKey: key });
  console.log(`✅ Encryption key saved to ${CONFIG_FILE}`);
}

export function clearEncryptionKey(): void {
  saveConfig({ encryptionKey: null });
  console.log('✅ Encryption key cleared');
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}
