import { describe, it, mock, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Set required env vars
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

describe('JWT utilities', async () => {
  let jwtLib: typeof import('../src/lib/jwt');

  before(async () => {
    jwtLib = await import('../src/lib/jwt');
  });

  describe('signAccessToken / verifyAccessToken', () => {
    it('should sign and verify an access token', () => {
      const payload = { sub: 'user-123', email: 'test@example.com', roleId: 'role-456' };
      const token = jwtLib.signAccessToken(payload);

      assert.ok(typeof token === 'string', 'Token should be a string');
      assert.ok(token.split('.').length === 3, 'Token should be a valid JWT (3 parts)');

      const decoded = jwtLib.verifyAccessToken(token);
      assert.equal(decoded.sub, payload.sub);
      assert.equal(decoded.email, payload.email);
      assert.equal(decoded.type, 'access');
    });

    it('should throw UnauthorizedError for invalid token', () => {
      assert.throws(
        () => jwtLib.verifyAccessToken('invalid.token.here'),
        { name: 'UnauthorizedError' },
      );
    });

    it('should throw when using refresh token as access token', () => {
      const refreshToken = jwtLib.signRefreshToken({ sub: 'user-123', jti: 'jti-123' });
      assert.throws(
        () => jwtLib.verifyAccessToken(refreshToken),
        { name: 'UnauthorizedError' },
      );
    });
  });

  describe('signRefreshToken / verifyRefreshToken', () => {
    it('should sign and verify a refresh token', () => {
      const payload = { sub: 'user-123', jti: 'jti-abc' };
      const token = jwtLib.signRefreshToken(payload);

      const decoded = jwtLib.verifyRefreshToken(token);
      assert.equal(decoded.sub, payload.sub);
      assert.equal(decoded.jti, payload.jti);
      assert.equal(decoded.type, 'refresh');
    });

    it('should throw when using access token as refresh token', () => {
      const accessToken = jwtLib.signAccessToken({
        sub: 'user-123',
        email: 'test@example.com',
        roleId: 'role-456',
      });
      assert.throws(
        () => jwtLib.verifyRefreshToken(accessToken),
        { name: 'UnauthorizedError' },
      );
    });
  });
});

describe('Auth service', async () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$test',
    name: 'Test User',
    status: 'ACTIVE',
    roleId: 'role-123',
    twoFactorEnabled: false,
    twoFactorSecret: null,
    deletedAt: null,
    role: { id: 'role-123', name: 'admin', permissions: ['lead:read'] },
  };

  const mockPrisma = {
    user: {
      findFirst: async () => mockUser,
      update: async (args: unknown) => ({ ...mockUser, ...(args as { data: unknown }).data }),
    },
    session: {
      create: async () => ({ id: 'session-123' }),
      findFirst: async () => null,
      update: async () => ({}),
      updateMany: async () => ({ count: 1 }),
    },
    $connect: async () => {},
    $disconnect: async () => {},
  };

  before(() => {
    mock.module('../src/db/prisma', {
      defaultExport: mockPrisma,
      namedExports: { prisma: mockPrisma },
    });
  });

  describe('signAccessToken type safety', () => {
    it('access token payload should contain type=access', async () => {
      const jwt = await import('../src/lib/jwt');
      const token = jwt.signAccessToken({
        sub: 'u1',
        email: 'a@b.com',
        roleId: 'r1',
      });
      const decoded = jwt.verifyAccessToken(token);
      assert.equal(decoded.type, 'access');
      assert.equal(decoded.sub, 'u1');
    });
  });

  describe('TOTP utilities', () => {
    it('should generate and verify TOTP', async () => {
      const totp = await import('../src/lib/totp');
      const secret = totp.generateSecret();
      assert.ok(secret.length >= 16, 'Secret should be at least 16 chars');

      // Generate current token
      const { authenticator } = await import('otplib');
      const token = authenticator.generate(secret);
      const valid = totp.verifyToken(secret, token);
      assert.equal(valid, true, 'Current token should be valid');

      const invalid = totp.verifyToken(secret, '000000');
      assert.equal(invalid, false, 'Wrong token should be invalid');
    });
  });
});
