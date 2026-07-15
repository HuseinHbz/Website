/**
 * CRM dashboard helpers (Phase 26.25b بند ۲). PURE + unit-tested. The dashboard
 * itself reuses the verified module engines (pipelineStats, agingBuckets,
 * campaignAnalytics, ticket SLA) — only the month-over-month delta math lives here.
 */
export interface MoM { current: number; previous: number; deltaPct: number | null; direction: 'up' | 'down' | 'flat' }

/**
 * Month-over-month change. deltaPct is null when there is no previous baseline
 * (can't divide by zero) — the UI shows "new" rather than a fake %.
 */
export function momChange(current: number, previous: number): MoM {
  let deltaPct: number | null = null
  if (previous !== 0) deltaPct = Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10
  const direction: MoM['direction'] = current > previous ? 'up' : current < previous ? 'down' : 'flat'
  return { current, previous, deltaPct, direction }
}

/** First day of the current and previous month as 'YYYY-MM-DD' given a reference date. */
export function monthBounds(ref: Date): { curStart: string; prevStart: string; prevEnd: string } {
  const y = ref.getUTCFullYear(), m = ref.getUTCMonth()
  const curStart = new Date(Date.UTC(y, m, 1))
  const prevStart = new Date(Date.UTC(y, m - 1, 1))
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { curStart: fmt(curStart), prevStart: fmt(prevStart), prevEnd: fmt(curStart) }
}
