/**
 * SLA engine (Phase 26.13, M5) — pure, unit-tested.
 * Business-hours elapsed time (with a working-day window + holiday calendar),
 * SLA status/breach and escalation-stage resolution. Generalises the approval
 * SLA (26.12) to customer/internal/support SLAs.
 */

export interface BusinessHours { startHour: number; endHour: number; workingDays: number[] } // days: 0=Sun..6=Sat
export const DEFAULT_HOURS: BusinessHours = { startHour: 8, endHour: 17, workingDays: [6, 0, 1, 2, 3] } // Sat–Wed (Iran week)

function ymd(d: Date): string { return d.toISOString().slice(0, 10) }

/** Business hours elapsed between two instants, skipping non-working days/holidays. */
export function businessHoursBetween(fromIso: string, toIso: string, hours: BusinessHours = DEFAULT_HOURS, holidays: string[] = []): number {
  let start = new Date(fromIso), end = new Date(toIso)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return 0
  const hol = new Set(holidays)
  const dayLen = Math.max(0, hours.endHour - hours.startHour)
  let total = 0
  const cursor = new Date(start)
  cursor.setUTCHours(0, 0, 0, 0)
  const guard = 366 * 3 // cap iterations
  let n = 0
  while (cursor <= end && n++ < guard) {
    const day = cursor.getUTCDay()
    if (hours.workingDays.includes(day) && !hol.has(ymd(cursor))) {
      const winStart = new Date(cursor); winStart.setUTCHours(hours.startHour, 0, 0, 0)
      const winEnd = new Date(cursor); winEnd.setUTCHours(hours.endHour, 0, 0, 0)
      const s = start > winStart ? start : winStart
      const e = end < winEnd ? end : winEnd
      if (e > s) total += Math.min(dayLen, (e.getTime() - s.getTime()) / 3_600_000)
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return Math.round(total * 10) / 10
}

export type SlaState = 'within' | 'due_soon' | 'breached'
/** SLA state given elapsed business hours vs the target. */
export function slaState(elapsedBusinessHours: number, targetHours: number): SlaState {
  if (elapsedBusinessHours >= targetHours) return 'breached'
  if (elapsedBusinessHours >= targetHours * 0.8) return 'due_soon'
  return 'within'
}

export interface SlaEscalationRule { atPct: number; level: number; target?: string }
export const DEFAULT_SLA_ESCALATION: SlaEscalationRule[] = [
  { atPct: 50, level: 1 }, { atPct: 80, level: 2, target: 'manager' }, { atPct: 100, level: 3, target: 'director' },
]
/** Escalation levels due (by % of the SLA consumed) not yet fired. */
export function dueSlaEscalations(elapsedBusinessHours: number, targetHours: number, fired: number[], rules: SlaEscalationRule[] = DEFAULT_SLA_ESCALATION): SlaEscalationRule[] {
  const pct = targetHours <= 0 ? 100 : elapsedBusinessHours / targetHours * 100
  const done = new Set(fired)
  return rules.filter(r => pct >= r.atPct && !done.has(r.level)).sort((a, b) => a.level - b.level)
}

/** Priority → target business hours (customer/support SLAs). */
export const PRIORITY_HOURS: Record<string, number> = { critical: 4, high: 8, medium: 24, low: 72 }
