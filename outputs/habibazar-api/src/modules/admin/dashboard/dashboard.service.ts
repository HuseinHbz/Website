import prisma from '../../../db/prisma';
import { LeadStatus, ConsultationStatus } from '../../../lib/enums';

export async function getDashboardStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    leadsByStatus,
    consultationsByStatus,
    engagementPipeline,
    recentLeads,
    recentConsultations,
    aiConversationsThisMonth,
  ] = await Promise.all([
    // Leads by status
    prisma.lead.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { id: true },
    }),

    // Consultations by status
    prisma.consultationRequest.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { id: true },
    }),

    // Engagement pipeline total value
    prisma.engagement.aggregate({
      where: {
        stage: { notIn: ['COMPLETED', 'LOST'] },
      },
      _sum: { value: true },
      _count: { id: true },
    }),

    // Recent leads (last 5)
    prisma.lead.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
        source: true,
        status: true,
        score: true,
        createdAt: true,
      },
    }),

    // Recent consultations (last 5)
    prisma.consultationRequest.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        kind: true,
        status: true,
        createdAt: true,
      },
    }),

    // AI conversations this month
    prisma.conversation.count({
      where: {
        createdAt: { gte: startOfMonth },
      },
    }),
  ]);

  // Format leads by status into object
  const leadCounts: Record<string, number> = {};
  for (const status of Object.values(LeadStatus)) {
    leadCounts[status] = 0;
  }
  for (const item of leadsByStatus) {
    leadCounts[item.status] = item._count.id;
  }

  // Format consultations by status
  const consultationCounts: Record<string, number> = {};
  for (const status of Object.values(ConsultationStatus)) {
    consultationCounts[status] = 0;
  }
  for (const item of consultationsByStatus) {
    consultationCounts[item.status] = item._count.id;
  }

  return {
    leads: {
      byStatus: leadCounts,
      total: Object.values(leadCounts).reduce((a, b) => a + b, 0),
    },
    consultations: {
      byStatus: consultationCounts,
      total: Object.values(consultationCounts).reduce((a, b) => a + b, 0),
    },
    engagementPipeline: {
      activeCount: engagementPipeline._count.id,
      totalValue: engagementPipeline._sum.value ?? 0,
    },
    recentLeads,
    recentConsultations,
    aiConversationsThisMonth,
  };
}
