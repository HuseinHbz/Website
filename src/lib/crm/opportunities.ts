/**
 * Phase 27 بند۱ — the opportunity engine.
 *
 * Deal value used to live on the lead, which cannot describe a real account:
 * one customer commonly has several open deals at once (a network project and
 * a support contract). A lead is someone you are qualifying; an opportunity is
 * a deal you are working, and the two have different lifecycles.
 *
 * Everything here is pure so the numbers a sales manager acts on are testable
 * without a database.
 */

export const OPPORTUNITY_STAGES = [
  'identified', 'qualified', 'proposal', 'negotiation', 'won', 'lost',
] as const
export type OpportunityStage = typeof OPPORTUNITY_STAGES[number]

/** Stages still in play — the only ones that belong in a pipeline figure. */
export const OPEN_STAGES: OpportunityStage[] = ['identified', 'qualified', 'proposal', 'negotiation']

export const STAGE_LABELS: Record<OpportunityStage, { en: string; fa: string }> = {
  identified:  { en: 'Identified',  fa: 'شناسایی' },
  qualified:   { en: 'Qualified',   fa: 'واجد شرایط' },
  proposal:    { en: 'Proposal',    fa: 'پیشنهاد' },
  negotiation: { en: 'Negotiation', fa: 'مذاکره' },
  won:         { en: 'Won',         fa: 'برد' },
  lost:        { en: 'Lost',        fa: 'باخت' },
}

/**
 * Default probability per stage. A suggestion, not a lock — the owner can
 * override it, because they know the deal better than a table does.
 */
export const STAGE_DEFAULT_PROBABILITY: Record<OpportunityStage, number> = {
  identified: 10, qualified: 30, proposal: 50, negotiation: 75, won: 100, lost: 0,
}

export interface Opportunity {
  id?: number
  title: string
  amount: number
  probability: number
  stage: OpportunityStage
  expectedCloseDate?: string | null
  customerId?: number | null
  ownerId?: string | null
  outcomeReason?: string | null
}

/** A closed stage cannot go back to an open one without an explicit reopen. */
export function isClosed(stage: OpportunityStage): boolean {
  return stage === 'won' || stage === 'lost'
}

/**
 * Which stages may follow this one.
 *
 * Deliberately permissive between open stages — real deals move backwards
 * ("they went quiet, back to qualified") and a tool that forbids that just
 * gets worked around. What it does enforce is that closing requires an
 * outcome, and that a closed deal is reopened explicitly rather than drifting.
 */
export function allowedTransitions(from: OpportunityStage): OpportunityStage[] {
  if (isClosed(from)) return ['identified', 'qualified', 'proposal', 'negotiation']
  return OPPORTUNITY_STAGES.filter(s => s !== from)
}

export function canTransition(from: OpportunityStage, to: OpportunityStage): boolean {
  return allowedTransitions(from).includes(to)
}

/**
 * A loss must say why. Without a reason, the loss analysis in بند۴ has nothing
 * to aggregate and "why are we losing deals?" stays unanswerable.
 */
export function requiresReason(stage: OpportunityStage): boolean {
  return stage === 'lost'
}

/**
 * Weighted value — amount × probability.
 *
 * This is the number a sales manager actually needs: the raw sum of open deals
 * always flatters the forecast, because it counts a 10%-probability deal the
 * same as a signed one.
 */
export function weightedValue(o: Pick<Opportunity, 'amount' | 'probability'>): number {
  return Math.round((o.amount || 0) * (o.probability || 0)) / 100
}

export interface PipelineSummary {
  totalCount: number
  openCount: number
  openValue: number
  weightedValue: number
  wonValue: number
  lostValue: number
  winRatePct: number
  byStage: { stage: OpportunityStage; count: number; value: number; weighted: number }[]
}

/** Roll a set of opportunities into the pipeline figures. Pure. */
export function pipelineSummary(rows: Opportunity[]): PipelineSummary {
  const byStage = OPPORTUNITY_STAGES.map(stage => {
    const items = rows.filter(r => r.stage === stage)
    return {
      stage,
      count: items.length,
      value: items.reduce((s, r) => s + (r.amount || 0), 0),
      weighted: items.reduce((s, r) => s + weightedValue(r), 0),
    }
  })
  const open = rows.filter(r => OPEN_STAGES.includes(r.stage))
  const won = rows.filter(r => r.stage === 'won')
  const lost = rows.filter(r => r.stage === 'lost')
  const decided = won.length + lost.length
  return {
    totalCount: rows.length,
    openCount: open.length,
    openValue: open.reduce((s, r) => s + (r.amount || 0), 0),
    weightedValue: open.reduce((s, r) => s + weightedValue(r), 0),
    wonValue: won.reduce((s, r) => s + (r.amount || 0), 0),
    lostValue: lost.reduce((s, r) => s + (r.amount || 0), 0),
    // A win rate over zero decided deals is 0, not NaN and not 100.
    winRatePct: decided === 0 ? 0 : Math.round((won.length / decided) * 100),
    byStage,
  }
}

/** Aggregate loss reasons, biggest first — the input to "why do we lose?". */
export function lossBreakdown(rows: Opportunity[]): { reason: string; count: number; value: number }[] {
  const map = new Map<string, { count: number; value: number }>()
  for (const r of rows) {
    if (r.stage !== 'lost') continue
    const key = (r.outcomeReason || '').trim() || 'unspecified'
    const cur = map.get(key) ?? { count: 0, value: 0 }
    cur.count += 1
    cur.value += r.amount || 0
    map.set(key, cur)
  }
  return [...map].map(([reason, v]) => ({ reason, ...v })).sort((a, b) => b.count - a.count)
}

/** Line math for proposed items — reuses the sales convention: qty × price, then discount, then tax on net. */
export function itemTotal(i: { qty: number; unitPrice: number; discountPct?: number; taxPct?: number }): number {
  const gross = (i.qty || 0) * (i.unitPrice || 0)
  const net = gross - gross * ((i.discountPct || 0) / 100)
  return Math.round((net + net * ((i.taxPct || 0) / 100)) * 100) / 100
}

/** Sum of proposed items — what the opportunity amount becomes on conversion. */
export function itemsTotal(items: { qty: number; unitPrice: number; discountPct?: number; taxPct?: number }[]): number {
  return Math.round(items.reduce((s, i) => s + itemTotal(i), 0) * 100) / 100
}
