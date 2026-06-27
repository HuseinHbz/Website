import { z } from 'zod';
import { EngagementStage } from '../../../lib/enums';
import prisma from '../../../db/prisma';
import { NotFoundError } from '../../../lib/errors';
import { buildPaginationMeta, buildPrismaSkipTake } from '../../../lib/pagination';

const createEngagementSchema = z.object({
  leadId: z.string().uuid(),
  stage: z.nativeEnum(EngagementStage),
  notes: z.string().max(5000).optional(),
  value: z.number().positive().optional(),
  closedAt: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
});

const updateEngagementSchema = z.object({
  stage: z.nativeEnum(EngagementStage).optional(),
  notes: z.string().max(5000).optional(),
  value: z.number().positive().optional().nullable(),
  closedAt: z.string().datetime().optional().nullable().transform(v => v ? new Date(v) : (v === null ? null : undefined)),
});

export async function listEngagements(
  page: number,
  limit: number,
  filters: { stage?: EngagementStage },
) {
  const where: Record<string, unknown> = {};
  if (filters.stage) where['stage'] = filters.stage;

  const [total, engagements] = await Promise.all([
    prisma.engagement.count({ where }),
    prisma.engagement.findMany({
      where,
      ...buildPrismaSkipTake(page, limit),
      orderBy: { createdAt: 'desc' },
      include: {
        lead: {
          select: { id: true, name: true, company: true, email: true, score: true },
        },
      },
    }),
  ]);

  return {
    engagements,
    meta: buildPaginationMeta(total, page, limit),
  };
}

export async function getEngagementById(id: string) {
  const engagement = await prisma.engagement.findFirst({
    where: { id },
    include: {
      lead: {
        select: {
          id: true, name: true, company: true, email: true, phone: true, status: true, score: true,
        },
      },
    },
  });

  if (!engagement) throw new NotFoundError('Engagement');
  return engagement;
}

export async function createEngagement(data: z.infer<typeof createEngagementSchema>) {
  const lead = await prisma.lead.findFirst({ where: { id: data.leadId, deletedAt: null } });
  if (!lead) throw new NotFoundError('Lead');

  return prisma.engagement.create({
    data: {
      leadId: data.leadId,
      stage: data.stage,
      notes: data.notes ?? null,
      value: data.value ?? null,
      closedAt: data.closedAt ?? null,
    },
  });
}

export async function updateEngagement(
  id: string,
  data: z.infer<typeof updateEngagementSchema>,
) {
  const engagement = await prisma.engagement.findFirst({ where: { id } });
  if (!engagement) throw new NotFoundError('Engagement');

  return prisma.engagement.update({
    where: { id },
    data: {
      ...(data.stage !== undefined && { stage: data.stage }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.value !== undefined && { value: data.value }),
      ...(data.closedAt !== undefined && { closedAt: data.closedAt }),
      updatedAt: new Date(),
    },
  });
}

export async function deleteEngagement(id: string) {
  const engagement = await prisma.engagement.findFirst({ where: { id } });
  if (!engagement) throw new NotFoundError('Engagement');

  await prisma.engagement.delete({ where: { id } });
}

export { createEngagementSchema, updateEngagementSchema };
