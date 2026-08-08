import crypto from 'node:crypto';

const PREFIX = 'enc:v1';

function decodeKey(raw: string): Buffer {
  const value = raw.trim();
  if (/^[a-f\d]{64}$/i.test(value)) return Buffer.from(value, 'hex');
  try {
    const decoded = Buffer.from(value, 'base64');
    if (decoded.length === 32) return decoded;
  } catch {
    // handled below
  }
  throw new Error('TIKTOK_TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64)');
}

function key(): Buffer {
  const raw = process.env.TIKTOK_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TIKTOK_TOKEN_ENCRYPTION_KEY is required in production');
    }
    // Stable development-only key, never suitable for production data.
    return crypto.createHash('sha256').update('orky-dev-token-encryption-key').digest();
  }
  return decodeKey(raw);
}

export function isEncryptedSecret(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(`${PREFIX}:`);
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) throw new Error('Cannot encrypt an empty secret');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(':');
}

export function decryptSecret(stored: string): string {
  if (!stored) throw new Error('Encrypted secret is empty');
  // Backward-compatible read permits a rolling migration of existing plaintext
  // rows. The next refresh/upsert writes the value encrypted.
  if (!isEncryptedSecret(stored)) return stored;

  const parts = stored.split(':');
  if (parts.length !== 6 || `${parts[0]}:${parts[1]}` !== PREFIX) {
    throw new Error('Encrypted secret format is invalid');
  }
  const iv = Buffer.from(parts[3], 'base64url');
  const tag = Buffer.from(parts[4], 'base64url');
  const ciphertext = Buffer.from(parts[5], 'base64url');
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
    throw new Error('Encrypted secret payload is invalid');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
