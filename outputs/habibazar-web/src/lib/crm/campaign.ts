/**
 * Campaign engine (Phase 26.25 بند ۴) — pure send-eligibility, normalization and
 * attribution/ROI math. The data layer owns the queue + provider dispatch; this
 * module decides who may be sent to and computes the campaign report.
 */

export type CampaignChannel = 'sms' | 'email'

/** Normalize a target so opt-out matching is robust (Iranian phone / email). */
export function normalizeTarget(channel: CampaignChannel, raw: string): string {
  const t = (raw ?? '').trim()
  if (channel === 'email') return t.toLowerCase()
  // Phone: strip non-digits, normalise +98/0098/98 → leading 0.
  let d = t.replace(/[^\d]/g, '')
  if (d.startsWith('0098')) d = d.slice(4)
  else if (d.startsWith('98') && d.length === 12) d = d.slice(2)
  if (!d.startsWith('0')) d = '0' + d
  return d
}

/**
 * May this recipient be sent to? Blocks empty targets and anyone on the opt-out
 * set (matched on the normalized target). The opt-out set MUST be the source of
 * truth — a server-side block that no campaign can override (بند ۴.۵).
 */
export function canSend(channel: CampaignChannel, target: string, optOut: Set<string>): boolean {
  const n = normalizeTarget(channel, target)
  if (!n || n === '0') return false
  return !optOut.has(n)
}

export interface CampaignReport {
  sent: number
  failed: number
  skippedOptOut: number
  leads: number
  conversions: number
  wonValue: number
  cost: number
  /** Customer-acquisition cost = cost / conversions (0 conversions → Infinity). */
  cac: number
  /** ROI = (wonValue − cost) / cost (0 cost → Infinity when there is value). */
  roi: number
}

export function campaignReport(input: {
  sent: number; failed: number; skippedOptOut: number
  leads: number; conversions: number; wonValue: number; cost: number
}): CampaignReport {
  const cac = input.conversions > 0 ? Math.round((input.cost / input.conversions) * 100) / 100 : Infinity
  const roi = input.cost > 0 ? Math.round(((input.wonValue - input.cost) / input.cost) * 100) / 100 : (input.wonValue > 0 ? Infinity : 0)
  return { ...input, cac, roi }
}
