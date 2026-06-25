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
  const where: Record<string, unknown> = {
    ...(filters.resource !== undefined && { resource: filters.resource }),
    ...(filters.userId !== undefined && { userId: filters.userId }),
    ...(filters.action !== undefined && { action: filters.action }),
    ...((filters.dateFrom || filters.dateTo) && {
      createdAt: {
        ...(filters.dateFrom && { gte: filters.dateFrom }),
        ...(filters.dateTo && { lte: filters.dateTo }),
      },
    }),
  };

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
