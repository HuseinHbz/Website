import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// Set required env vars before importing modules
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
process.env['ACCESS_TOKEN_SECRET'] = 'test_access_secret_min_32_chars_abcdef';
process.env['REFRESH_TOKEN_SECRET'] = 'test_refresh_secret_min_32_chars_abcdef';
process.env['ENCRYPTION_KEY'] = '0000000000000000000000000000000000000000000000000000000000000000';
process.env['OWNER_EMAIL'] = 'test@example.com';
process.env['SMTP_HOST'] = 'localhost';
process.env['SMTP_USER'] = 'test@example.com';
process.env['SMTP_PASS'] = 'password';
process.env['MAIL_FROM'] = 'noreply@example.com';
process.env['MAIL_NOTIFY_TO'] = 'admin@example.com';
process.env['CORS_ORIGINS'] = 'http://localhost:3000';

describe('Crypto utilities', async () => {
  let crypto: typeof import('../src/lib/crypto');

  before(async () => {
    crypto = await import('../src/lib/crypto');
  });

  describe('hashPassword / verifyPassword', () => {
    it('should hash and verify a password', async () => {
      const password = 'MySecurePassword123!';
      const hash = await crypto.hashPassword(password);

      assert.ok(hash.startsWith('$argon2'), 'Hash should be an argon2 hash');
      assert.notEqual(hash, password, 'Hash should not equal the original password');

      const valid = await crypto.verifyPassword(password, hash);
      assert.equal(valid, true, 'Password should verify correctly');
    });

    it('should reject wrong password', async () => {
      const hash = await crypto.hashPassword('correct-password');
      const valid = await crypto.verifyPassword('wrong-password', hash);
      assert.equal(valid, false, 'Wrong password should not verify');
    });

    it('should produce different hashes for same password (salt)', async () => {
      const password = 'samepassword';
      const hash1 = await crypto.hashPassword(password);
      const hash2 = await crypto.hashPassword(password);
      assert.notEqual(hash1, hash2, 'Same password should produce different hashes due to salt');
    });
  });

  describe('hashToken', () => {
    it('should produce consistent SHA-256 hex hash', () => {
      const token = 'mytoken123';
      const hash1 = crypto.hashToken(token);
      const hash2 = crypto.hashToken(token);
      assert.equal(hash1, hash2, 'Same token should produce same hash');
      assert.equal(hash1.length, 64, 'SHA-256 hex should be 64 characters');
    });

    it('should produce different hashes for different tokens', () => {
      const hash1 = crypto.hashToken('token1');
      const hash2 = crypto.hashToken('token2');
      assert.notEqual(hash1, hash2);
    });
  });

  describe('encryptSecret / decryptSecret', () => {
    it('should encrypt and decrypt a secret', () => {
      const secret = 'JBSWY3DPEHPK3PXP'; // TOTP secret
      const encrypted = crypto.encryptSecret(secret);

      assert.notEqual(encrypted, secret, 'Encrypted value should differ from original');
      assert.ok(encrypted.includes(':'), 'Encrypted format should have colon separators');

      const decrypted = crypto.decryptSecret(encrypted);
      assert.equal(decrypted, secret, 'Decrypted value should match original');
    });

    it('should produce different ciphertexts for same plaintext (IV randomness)', () => {
      const secret = 'same-secret';
      const enc1 = crypto.encryptSecret(secret);
      const enc2 = crypto.encryptSecret(secret);
      assert.notEqual(enc1, enc2, 'Same plaintext should produce different ciphertexts due to random IV');
    });

    it('should throw on tampered ciphertext', () => {
      const secret = 'test-secret';
      const encrypted = crypto.encryptSecret(secret);
      const tampered = encrypted.slice(0, -4) + 'XXXX';

      assert.throws(() => crypto.decryptSecret(tampered), 'Should throw on tampered data');
    });
  });

  describe('generateToken', () => {
    it('should generate 64-char hex token', () => {
      const token = crypto.generateToken();
      assert.equal(token.length, 64, 'Token should be 64 hex chars (32 bytes)');
      assert.match(token, /^[a-f0-9]+$/, 'Token should be hex');
    });

    it('should generate unique tokens', () => {
      const tokens = new Set(Array.from({ length: 10 }, () => crypto.generateToken()));
      assert.equal(tokens.size, 10, 'All generated tokens should be unique');
    });
  });

  describe('constantTimeEqual', () => {
    it('should return true for equal strings', () => {
      assert.equal(crypto.constantTimeEqual('hello', 'hello'), true);
    });

    it('should return false for different strings of same length', () => {
      assert.equal(crypto.constantTimeEqual('hello', 'world'), false);
    });

    it('should return false for different length strings', () => {
      assert.equal(crypto.constantTimeEqual('short', 'longer string'), false);
    });
  });
});
