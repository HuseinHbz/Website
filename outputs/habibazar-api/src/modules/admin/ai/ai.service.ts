import { AssistantCategory, Locale } from '@prisma/client';
import prisma from '../../../db/prisma';
import { buildPaginationMeta, buildPrismaSkipTake } from '../../../lib/pagination';
import { NotFoundError } from '../../../lib/errors';

interface ConversationFilters {
  category?: AssistantCategory;
  locale?: Locale;
  dateFrom?: Date;
  dateTo?: Date;
}

export async function listConversations(
  page: number,
  limit: number,
  filters: ConversationFilters,
) {
  const where: Parameters<typeof prisma.conversation.findMany>[0]['where'] = {};

  if (filters.category) where.category = filters.category;
  if (filters.locale) where.locale = filters.locale;
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
    if (filters.dateTo) where.createdAt.lte = filters.dateTo;
  }

  const [total, conversations] = await Promise.all([
    prisma.conversation.count({ where }),
    prisma.conversation.findMany({
      where,
      ...buildPrismaSkipTake(page, limit),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        company: true,
        phone: true,
        category: true,
        locale: true,
        turnCount: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    }),
  ]);

  return { conversations, meta: buildPaginationMeta(total, page, limit) };
}

export async function getConversationById(id: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!conversation) throw new NotFoundError('Conversation');
  return conversation;
}

export async function deleteConversation(id: string) {
  const conversation = await prisma.conversation.findFirst({ where: { id } });
  if (!conversation) throw new NotFoundError('Conversation');

  await prisma.conversation.delete({ where: { id } });
}

export async function getAiAnalytics() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [byCategory, byLocale, avgTurns, dailyCounts] = await Promise.all([
    // Count by category
    prisma.conversation.groupBy({
      by: ['category'],
      _count: { id: true },
    }),

    // Count by locale
    prisma.conversation.groupBy({
      by: ['locale'],
      _count: { id: true },
    }),

    // Average turns
    prisma.conversation.aggregate({
      _avg: { turnCount: true },
      _sum: { turnCount: true },
      _count: { id: true },
    }),

    // Daily counts last 30 days
    prisma.$queryRaw<{ date: string; count: bigint }[]>`
      SELECT
        DATE(created_at)::text as date,
        COUNT(*)::bigint as count
      FROM conversations
      WHERE created_at >= ${thirtyDaysAgo}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `,
  ]);

  return {
    byCategory: byCategory.map((c) => ({ category: c.category, count: c._count.id })),
    byLocale: byLocale.map((c) => ({ locale: c.locale, count: c._count.id })),
    totals: {
      conversations: avgTurns._count.id,
      totalTurns: avgTurns._sum.turnCount ?? 0,
      avgTurns: avgTurns._avg.turnCount ?? 0,
    },
    daily: dailyCounts.map((d) => ({ date: d.date, count: Number(d.count) })),
  };
}
