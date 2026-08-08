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
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith('A') ? 'B' : 'A'}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('reads legacy plaintext for rolling migration', () => {
    expect(decryptSecret('legacy-plaintext-token')).toBe('legacy-plaintext-token');
  });
});
