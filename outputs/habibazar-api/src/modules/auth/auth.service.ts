import { v4 as uuidv4 } from 'uuid';
import prisma from '../../db/prisma';
import {
  hashPassword,
  verifyPassword,
  hashToken,
  generateToken,
  encryptSecret,
  decryptSecret,
} from '../../lib/crypto';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt';
import { generateSecret, generateQrUri, verifyToken as totpVerify } from '../../lib/totp';
import { UnauthorizedError, NotFoundError, ConflictError, ForbiddenError } from '../../lib/errors';
import { env } from '../../config/env';
import { UserStatus } from '@prisma/client';
import logger from '../../lib/logger';

interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    roleId: string;
    twoFactorEnabled: boolean;
  };
}

export async function login(
  email: string,
  password: string,
  totpToken?: string,
  userAgent?: string,
  ipAddress?: string,
): Promise<LoginResult> {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase(), deletedAt: null },
    include: { role: true },
  });

  // Always verify password to prevent user enumeration timing attacks
  const dummyHash = '$argon2id$v=19$m=65536,t=3,p=1$dummydummydummy$dummydummydummydummydummydummy';
  const passwordValid = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, dummyHash).then(() => false);

  if (!user || !passwordValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new UnauthorizedError('Account is inactive or suspended');
  }

  // 2FA check
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    if (!totpToken) {
      throw new UnauthorizedError('Two-factor authentication code required');
    }
    const secret = decryptSecret(user.twoFactorSecret);
    if (!totpVerify(secret, totpToken)) {
      throw new UnauthorizedError('Invalid two-factor authentication code');
    }
  }

  // Create session
  const rawRefreshToken = generateToken();
  const jti = uuidv4();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL * 1000);

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: hashToken(rawRefreshToken),
      userAgent: userAgent ?? null,
      ipAddress: ipAddress ?? null,
      expiresAt,
    },
  });

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    roleId: user.roleId,
  });

  const refreshToken = signRefreshToken({
    sub: user.id,
    jti,
  });

  // Embed raw token in the JWT but use the hash for DB storage
  // The client stores the JWT refresh token which contains the raw token
  // We return the rawRefreshToken directly as the refresh token

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      roleId: user.roleId,
      twoFactorEnabled: user.twoFactorEnabled,
    },
  };
}

export async function refresh(
  refreshTokenRaw: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const tokenHash = hashToken(refreshTokenRaw);

  const session = await prisma.session.findFirst({
    where: {
      refreshTokenHash: tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      user: {
        include: { role: true },
      },
    },
  });

  if (!session || !session.user || session.user.status !== UserStatus.ACTIVE || session.user.deletedAt) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  // Rotate: revoke old session, create new
  const newRawToken = generateToken();
  const newExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL * 1000);

  await prisma.$transaction([
    prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    }),
    prisma.session.create({
      data: {
        userId: session.userId,
        refreshTokenHash: hashToken(newRawToken),
        userAgent: session.userAgent,
        ipAddress: session.ipAddress,
        expiresAt: newExpiresAt,
      },
    }),
  ]);

  const accessToken = signAccessToken({
    sub: session.user.id,
    email: session.user.email,
    roleId: session.user.roleId,
  });

  return { accessToken, refreshToken: newRawToken };
}

export async function logout(
  userId: string,
  refreshTokenRaw: string,
): Promise<void> {
  const tokenHash = hashToken(refreshTokenRaw);

  await prisma.session.updateMany({
    where: {
      userId,
      refreshTokenHash: tokenHash,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      twoFactorEnabled: true,
      createdAt: true,
      updatedAt: true,
      role: {
        select: {
          id: true,
          name: true,
          permissions: true,
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  return user;
}

export async function setup2fa(userId: string): Promise<{ qrUri: string; secret: string }> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  if (user.twoFactorEnabled) {
    throw new ConflictError('Two-factor authentication is already enabled');
  }

  const secret = generateSecret();
  const encrypted = encryptSecret(secret);
  const qrUri = await generateQrUri(secret, user.email);

  // Store secret but don't enable until verified
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: encrypted,
      twoFactorEnabled: false,
    },
  });

  return { qrUri, secret };
}

export async function verify2fa(userId: string, token: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  if (!user.twoFactorSecret) {
    throw new ForbiddenError('2FA setup not started. Call /2fa/setup first.');
  }

  if (user.twoFactorEnabled) {
    throw new ConflictError('Two-factor authentication is already enabled');
  }

  const secret = decryptSecret(user.twoFactorSecret);
  if (!totpVerify(secret, token)) {
    throw new UnauthorizedError('Invalid TOTP token');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: true },
  });

  logger.info({ userId }, '2FA enabled for user');
}

export async function disable2fa(userId: string, token: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  if (!user.twoFactorEnabled || !user.twoFactorSecret) {
    throw new ConflictError('Two-factor authentication is not enabled');
  }

  const secret = decryptSecret(user.twoFactorSecret);
  if (!totpVerify(secret, token)) {
    throw new UnauthorizedError('Invalid TOTP token');
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: null,
      twoFactorEnabled: false,
    },
  });

  logger.info({ userId }, '2FA disabled for user');
}

export async function seedAdminUser(email: string, password: string, name: string): Promise<void> {
  const existingRole = await prisma.role.findFirst({ where: { name: 'admin' } });

  let roleId: string;
  if (!existingRole) {
    const role = await prisma.role.create({
      data: {
        name: 'admin',
        permissions: Object.keys({
          'lead:read': true, 'lead:write': true, 'lead:delete': true,
          'consultation:read': true, 'consultation:write': true,
          'engagement:read': true, 'engagement:write': true,
          'content:read': true, 'content:write': true, 'content:delete': true,
          'testimonial:approve': true, 'cert:verify': true, 'consent:write': true,
          'user:read': true, 'user:write': true,
          'role:read': true, 'role:write': true,
          'settings:read': true, 'settings:write': true,
          'audit:read': true, 'ai:read': true, 'ai:write': true,
        }),
      },
    });
    roleId = role.id;
  } else {
    roleId = existingRole.id;
  }

  const existingUser = await prisma.user.findFirst({ where: { email } });
  if (!existingUser) {
    await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        name,
        roleId,
        status: UserStatus.ACTIVE,
      },
    });
    logger.info({ email }, 'Admin user seeded');
  }
}
