// AES-256-GCM Encryption for LANClip
// Uses Node.js built-in crypto - no external dependencies needed
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;   // 96-bit IV for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Derives a 32-byte AES key from a user passphrase using SHA-256.
 * Both devices must use the same passphrase to communicate.
 */
function deriveKey(passphrase: string): Buffer {
  return createHash('sha256').update(passphrase).digest();
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a base64-encoded string: IV (12 bytes) + AuthTag (16 bytes) + Ciphertext
 */
export function encrypt(plaintext: string, passphrase: string): string {
  const key = deriveKey(passphrase);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Pack: IV + AuthTag + Ciphertext → base64
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypts a base64-encoded AES-256-GCM payload.
 * Returns null if decryption fails (wrong key or tampered data).
 */
export function decrypt(encryptedBase64: string, passphrase: string): string | null {
  try {
    const key = deriveKey(passphrase);
    const combined = Buffer.from(encryptedBase64, 'base64');

    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      return null; // Too short to be valid
    }

    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch {
    // Wrong key, tampered data, or invalid format
    return null;
  }
}

/**
 * Checks if a string looks like an encrypted LANClip payload (base64 encoded).
 */
export function isEncrypted(data: string): boolean {
  try {
    const buf = Buffer.from(data, 'base64');
    return buf.length > IV_LENGTH + AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}
