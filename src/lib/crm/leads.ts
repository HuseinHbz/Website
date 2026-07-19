/**
 * CRM lead domain logic (Phase 15 foundation).
 *
 * Pure, deterministic helpers so scoring/pipeline logic is unit-testable and
 * shared between the API and any future automation. No DB access here.
 */

export const LEAD_SOURCES = ['website', 'referral', 'consultation', 'contact_form', 'event', 'social', 'email', 'other'] as const
export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'] as const
export type LeadSource = (typeof LEAD_SOURCES)[number]
export type LeadStatus = (typeof LEAD_STATUSES)[number]

export interface LeadInput {
  name: string
  email?: string | null
  phone?: string | null
  company?: string | null
  source?: LeadSource
  status?: LeadStatus
  value?: number
}

// Higher weight = warmer inbound channel.
const SOURCE_WEIGHT: Record<LeadSource, number> = {
  referral: 30, consultation: 25, contact_form: 20, event: 18,
  website: 12, email: 10, social: 8, other: 5,
}
// Pipeline progress contributes to the score.
const STATUS_WEIGHT: Record<LeadStatus, number> = {
  new: 0, contacted: 10, qualified: 25, proposal: 40, won: 60, lost: 0,
}

/**
 * Lead score 0–100 from completeness (contactability), source quality, pipeline
 * stage and deal value. Deterministic — same input always yields the same score.
 */
export function scoreLead(lead: LeadInput): number {
  let score = 0
  if (lead.email && lead.email.trim()) score += 15
  if (lead.phone && lead.phone.trim()) score += 10
  if (lead.company && lead.company.trim()) score += 15
  score += SOURCE_WEIGHT[lead.source ?? 'other'] ?? 5
  score += STATUS_WEIGHT[lead.status ?? 'new'] ?? 0
  if ((lead.value ?? 0) > 0) score += Math.min(20, Math.floor((lead.value ?? 0) / 1000))
  return Math.max(0, Math.min(100, score))
}

/** Which statuses count as an open opportunity (for forecast/pipeline value). */
export function isOpen(status: LeadStatus): boolean {
  return status !== 'won' && status !== 'lost'
}

/**
 * Pure lead→customer conversion decision (26.24b بند ۲.۳). Given a lead's current
 * state and any active customer matched on email/phone, decides whether to short-
 * circuit (already converted), link to the existing customer, create a new one,
 * or reject. Keeps the route thin and makes dedup/idempotency unit-testable.
 */
export type ConversionDecision =
  | { action: 'already'; customerId: number }
  | { action: 'reject'; reason: string }
  | { action: 'link'; customerId: number }
  | { action: 'create' }
export function decideLeadConversion(
  lead: { status: string; convertedCustomerId: number | null },
  existingMatchId: number | null,
): ConversionDecision {
  if (lead.convertedCustomerId) return { action: 'already', customerId: lead.convertedCustomerId }
  if (!['qualified', 'proposal', 'won'].includes(lead.status)) return { action: 'reject', reason: 'Only qualified/proposal/won leads can be converted' }
  if (existingMatchId) return { action: 'link', customerId: existingMatchId }
  return { action: 'create' }
}

/** Aggregate pipeline metrics for the sales dashboard. */
export interface PipelineStats {
  total: number
  byStatus: Record<LeadStatus, number>
  openValue: number
  wonValue: number
  winRate: number
  avgScore: number
}
export function pipelineStats(leads: { status: LeadStatus; value: number; score: number }[]): PipelineStats {
  const byStatus = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<LeadStatus, number>
  let openValue = 0, wonValue = 0, scoreSum = 0
  for (const l of leads) {
    byStatus[l.status] = (byStatus[l.status] ?? 0) + 1
    if (l.status === 'won') wonValue += l.value
    else if (isOpen(l.status)) openValue += l.value
    scoreSum += l.score
  }
  const decided = byStatus.won + byStatus.lost
  return {
    total: leads.length,
    byStatus,
    openValue,
    wonValue,
    winRate: decided ? Math.round((byStatus.won / decided) * 1000) / 10 : 0,
    avgScore: leads.length ? Math.round(scoreSum / leads.length) : 0,
  }
}
