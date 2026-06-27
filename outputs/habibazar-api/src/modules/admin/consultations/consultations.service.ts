import { z } from 'zod';
import { ConsultationStatus, ConsultationKind, Prisma } from '@prisma/client';
import prisma from '../../../db/prisma';
import { NotFoundError } from '../../../lib/errors';
import { buildPaginationMeta, buildPrismaSkipTake } from '../../../lib/pagination';

const updateConsultationSchema = z.object({
  status: z.nativeEnum(ConsultationStatus).optional(),
  notes: z.string().max(5000).optional(),
  preferredDate: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
});

export async function listConsultations(
  page: number,
  limit: number,
  filters: {
    status?: ConsultationStatus;
    kind?: ConsultationKind;
  },
) {
  const where: Prisma.ConsultationRequestWhereInput = {
    deletedAt: null,
  };

  if (filters.status) where.status = filters.status;
  if (filters.kind) where.kind = filters.kind;

  const [total, consultations] = await Promise.all([
    prisma.consultationRequest.count({ where }),
    prisma.consultationRequest.findMany({
      where,
      ...buildPrismaSkipTake(page, limit),
      orderBy: { createdAt: 'desc' },
      include: {
        lead: {
          select: { id: true, name: true, company: true, score: true },
        },
      },
    }),
  ]);

  return {
    consultations,
    meta: buildPaginationMeta(total, page, limit),
  };
}

export async function getConsultationById(id: string) {
  const consultation = await prisma.consultationRequest.findFirst({
    where: { id, deletedAt: null },
    include: {
      lead: {
        include: {
          events: { orderBy: { createdAt: 'desc' }, take: 10 },
          attributions: true,
        },
      },
    },
  });

  if (!consultation) throw new NotFoundError('ConsultationRequest');
  return consultation;
}

export async function updateConsultation(
  id: string,
  data: z.infer<typeof updateConsultationSchema>,
) {
  const consultation = await prisma.consultationRequest.findFirst({
    where: { id, deletedAt: null },
  });
  if (!consultation) throw new NotFoundError('ConsultationRequest');

  return prisma.consultationRequest.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });
}

export async function softDeleteConsultation(id: string) {
  const consultation = await prisma.consultationRequest.findFirst({
    where: { id, deletedAt: null },
  });
  if (!consultation) throw new NotFoundError('ConsultationRequest');

  return prisma.consultationRequest.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export { updateConsultationSchema };
