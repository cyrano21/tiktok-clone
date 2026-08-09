import { decryptSecret, encryptSecret, isEncryptedSecret } from './token-encryption';

describe('OAuth token encryption', () => {
  const previousKey = process.env.TIKTOK_TOKEN_ENCRYPTION_KEY;
  const previousEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.TIKTOK_TOKEN_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  });

  afterAll(() => {
    process.env.TIKTOK_TOKEN_ENCRYPTION_KEY = previousKey;
    process.env.NODE_ENV = previousEnv;
  });

  it('round-trips an access token without storing plaintext', () => {
    const encrypted = encryptSecret('secret-access-token');
    expect(encrypted).not.toContain('secret-access-token');
    expect(isEncryptedSecret(encrypted)).toBe(true);
    expect(decryptSecret(encrypted)).toBe('secret-access-token');
  });

  it('rejects a tampered authentication tag/ciphertext', () => {
    const encrypted = encryptSecret('refresh-token');
    const parts = encrypted.split(':');
    // Flip a character in the middle of the ciphertext segment. The final
    // base64url character of a segment can encode only padding bits, so a
    // flip there would not always change the decoded bytes.
    const ct = parts[4];
    const mid = Math.floor(ct.length / 2);
    parts[4] = `${ct.slice(0, mid)}${ct[mid] === 'A' ? 'B' : 'A'}${ct.slice(mid + 1)}`;
    expect(() => decryptSecret(parts.join(':'))).toThrow();
  });

  it('reads legacy plaintext for rolling migration', () => {
    expect(decryptSecret('legacy-plaintext-token')).toBe('legacy-plaintext-token');
  });
});
