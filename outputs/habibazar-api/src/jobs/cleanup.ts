/**
 * Cleanup job - run via: tsx src/jobs/cleanup.ts
 * Or schedule with cron: 0 2 * * * tsx src/jobs/cleanup.ts
 */

import prisma from '../db/prisma';
import { env } from '../config/env';
import logger from '../lib/logger';

async function runCleanup() {
  logger.info('Starting cleanup job');
  const now = new Date();

  // 1. Delete expired sessions (expiresAt < now OR revokedAt set > 30 days ago)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const deletedSessions = await prisma.session.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: now } },
        { revokedAt: { lt: thirtyDaysAgo } },
      ],
    },
  });
  logger.info({ count: deletedSessions.count }, 'Deleted expired sessions');

  // 2. Delete expired idempotency keys
  const deletedIdempotency = await prisma.idempotencyKey.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  logger.info({ count: deletedIdempotency.count }, 'Deleted expired idempotency keys');

  // 3. Delete conversations older than AI_RETENTION_DAYS
  const retentionCutoff = new Date(
    now.getTime() - env.AI_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );

  const deletedConversations = await prisma.conversation.deleteMany({
    where: { createdAt: { lt: retentionCutoff } },
  });
  logger.info(
    { count: deletedConversations.count, retentionDays: env.AI_RETENTION_DAYS },
    'Deleted old AI conversations',
  );

  // 4. Clean up old audit logs (optional, keep 1 year)
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const deletedAuditLogs = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: oneYearAgo } },
  });
  logger.info({ count: deletedAuditLogs.count }, 'Deleted old audit logs');

  logger.info('Cleanup job completed');
}

runCleanup()
  .catch((err) => {
    logger.error({ err }, 'Cleanup job failed');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
