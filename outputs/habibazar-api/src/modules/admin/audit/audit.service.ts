import { Prisma } from '@prisma/client';
import prisma from '../../../db/prisma';
import { buildPaginationMeta, buildPrismaSkipTake } from '../../../lib/pagination';

interface AuditFilters {
  resource?: string;
  userId?: string;
  action?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export async function listAuditLogs(
  page: number,
  limit: number,
  filters: AuditFilters,
) {
  const where: Prisma.AuditLogWhereInput = {};

  if (filters.resource) where.resource = filters.resource;
  if (filters.userId) where.userId = filters.userId;
  if (filters.action) where.action = filters.action;
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
    if (filters.dateTo) where.createdAt.lte = filters.dateTo;
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      ...buildPrismaSkipTake(page, limit),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  return { logs, meta: buildPaginationMeta(total, page, limit) };
}
