import { z } from 'zod';
import { LeadSource, ConsultationKind } from '@prisma/client';
import prisma from '../../db/prisma';
import { sendLeadNotification, sendLeadAcknowledgement } from '../../services/mailer';
import { env } from '../../config/env';
import logger from '../../lib/logger';

const createLeadSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().toLowerCase().optional(),
  phone: z.string().max(50).optional(),
  company: z.string().max(255).optional(),
  source: z.nativeEnum(LeadSource).default('WEBSITE'),
  notes: z.string().max(2000).optional(),
  marketingConsent: z.boolean().default(false),
  serviceInterest: z.string().max(255).optional(),
  // UTM parameters
  utmSource: z.string().max(255).optional(),
  utmMedium: z.string().max(255).optional(),
  utmCampaign: z.string().max(255).optional(),
  utmContent: z.string().max(255).optional(),
});

const createConsultationSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().toLowerCase(),
  phone: z.string().max(50).optional(),
  kind: z.nativeEnum(ConsultationKind).default('INTRO_CALL'),
  message: z.string().max(2000).optional(),
  preferredDate: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
  marketingConsent: z.boolean().default(false),
});

const createSubscriberSchema = z.object({
  email: z.string().email().toLowerCase(),
  locale: z.enum(['FA', 'EN']).default('FA'),
});

/**
 * Score a lead based on available data.
 * Scores are config-driven via env SCORE_* thresholds.
 */
function scoreLead(data: {
  company?: string | null;
  phone?: string | null;
  serviceInterest?: string | null;
  isConsultation?: boolean;
  isSubscriber?: boolean;
}): number {
  let score = 0;

  if (data.company) score += 20;        // Has company = B2B intent
  if (data.phone) score += 20;          // Phone = higher commitment
  if (data.serviceInterest) score += 10; // Has specific interest
  if (data.isConsultation) score += 15;  // Consultation = highest intent
  if (data.isSubscriber) score += 5;     // Already subscribed

  return Math.min(score, 100);
}

export async function createLead(data: z.infer<typeof createLeadSchema>) {
  // Check if subscriber
  let isSubscriber = false;
  if (data.email) {
    const subscriber = await prisma.subscriber.findFirst({
      where: { email: data.email, status: 'ACTIVE' },
    });
    isSubscriber = !!subscriber;
  }

  const score = scoreLead({
    company: data.company,
    phone: data.phone,
    serviceInterest: data.serviceInterest,
    isSubscriber,
  });

  const lead = await prisma.lead.create({
    data: {
      name: data.name,
      email: data.email ?? null,
      phone: data.phone ?? null,
      company: data.company ?? null,
      source: data.source,
      score,
      notes: data.notes ?? null,
      marketingConsent: data.marketingConsent,
      metadata: data.serviceInterest ? { serviceInterest: data.serviceInterest } : null,
    },
  });

  // Create attribution if UTM data provided
  if (data.utmSource || data.utmMedium || data.utmCampaign) {
    await prisma.attribution.create({
      data: {
        leadId: lead.id,
        source: data.utmSource ?? null,
        medium: data.utmMedium ?? null,
        campaign: data.utmCampaign ?? null,
        content: data.utmContent ?? null,
      },
    });
  }

  // Create initial lead event
  await prisma.leadEvent.create({
    data: {
      leadId: lead.id,
      event: 'created',
      metadata: { source: data.source, score },
    },
  });

  // Fire and forget: notify owner and send acknowledgement
  sendLeadNotification(lead).catch((err) =>
    logger.error({ err, leadId: lead.id }, 'Lead notification failed'),
  );

  if (lead.email && lead.marketingConsent) {
    sendLeadAcknowledgement(lead).catch((err) =>
      logger.error({ err, leadId: lead.id }, 'Lead acknowledgement failed'),
    );
  }

  return lead;
}

export async function createConsultationRequest(
  data: z.infer<typeof createConsultationSchema>,
) {
  // Try to find or create lead
  let leadId: string | null = null;
  const existingLead = data.email
    ? await prisma.lead.findFirst({
        where: { email: data.email, deletedAt: null },
      })
    : null;

  if (existingLead) {
    leadId = existingLead.id;

    // Score boost for consultation intent
    const newScore = Math.min(existingLead.score + 15, 100);
    await prisma.lead.update({
      where: { id: existingLead.id },
      data: { score: newScore },
    });
  } else {
    const newLead = await createLead({
      name: data.name,
      email: data.email,
      phone: data.phone,
      source: 'WEBSITE',
      marketingConsent: data.marketingConsent,
      notes: data.message,
    });
    leadId = newLead.id;
  }

  const consultation = await prisma.consultationRequest.create({
    data: {
      leadId,
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      kind: data.kind,
      message: data.message ?? null,
      preferredDate: data.preferredDate ?? null,
      status: 'PENDING',
    },
  });

  return consultation;
}

export async function createSubscriber(data: z.infer<typeof createSubscriberSchema>) {
  return prisma.subscriber.upsert({
    where: { email: data.email },
    create: {
      email: data.email,
      locale: data.locale,
      status: 'ACTIVE',
    },
    update: {
      status: 'ACTIVE',
      locale: data.locale,
    },
  });
}

export { createLeadSchema, createConsultationSchema, createSubscriberSchema };
