import { z } from 'zod';
import { LeadStatus, LeadSource, Prisma } from '@prisma/client';
import prisma from '../../../db/prisma';
import { NotFoundError } from '../../../lib/errors';
import { buildPaginationMeta, buildPrismaSkipTake } from '../../../lib/pagination';

const updateLeadSchema = z.object({
  status: z.nativeEnum(LeadStatus).optional(),
  notes: z.string().max(5000).optional(),
  score: z.number().int().min(0).max(100).optional(),
  company: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
});

const leadEventSchema = z.object({
  event: z.string().min(1).max(100),
  metadata: z.record(z.unknown()).optional(),
});

export async function listLeads(
  page: number,
  limit: number,
  filters: {
    status?: LeadStatus;
    source?: LeadSource;
    search?: string;
  },
) {
  const where: Prisma.LeadWhereInput = {
    deletedAt: null,
  };

  if (filters.status) where.status = filters.status;
  if (filters.source) where.source = filters.source;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
      { company: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [total, leads] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      ...buildPrismaSkipTake(page, limit),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        source: true,
        status: true,
        score: true,
        marketingConsent: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  return {
    leads,
    meta: buildPaginationMeta(total, page, limit),
  };
}

export async function getLeadById(id: string) {
  const lead = await prisma.lead.findFirst({
    where: { id, deletedAt: null },
    include: {
      events: { orderBy: { createdAt: 'desc' } },
      attributions: true,
      consultations: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      },
      engagements: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!lead) throw new NotFoundError('Lead');
  return lead;
}

export async function updateLead(id: string, data: z.infer<typeof updateLeadSchema>) {
  const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
  if (!lead) throw new NotFoundError('Lead');

  return prisma.lead.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });
}

export async function softDeleteLead(id: string) {
  const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
  if (!lead) throw new NotFoundError('Lead');

  return prisma.lead.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function addLeadEvent(
  leadId: string,
  data: z.infer<typeof leadEventSchema>,
) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null } });
  if (!lead) throw new NotFoundError('Lead');

  return prisma.leadEvent.create({
    data: {
      leadId,
      event: data.event,
      metadata: data.metadata ?? Prisma.JsonNull,
    },
  });
}

export { updateLeadSchema, leadEventSchema };
