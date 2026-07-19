/**
 * SLA + escalation engine (Phase 26.12, M6) — pure, unit-tested.
 *
 * A pending approval that waits past its SLA thresholds triggers staged
 * escalations: reminder → escalate to manager → escalate to CEO. Deterministic
 * from elapsed hours; the data layer records what fired so each stage runs once.
 */

export interface EscalationRule { afterHours: number; action: 'reminder' | 'escalate'; target?: string; stage: number }

/** Default SLA policy from the spec: 24h reminder, 48h → manager, 72h → CEO. */
export const DEFAULT_ESCALATION: EscalationRule[] = [
  { afterHours: 24, action: 'reminder', stage: 1 },
  { afterHours: 48, action: 'escalate', target: 'manager', stage: 2 },
  { afterHours: 72, action: 'escalate', target: 'ceo', stage: 3 },
]

export function hoursBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso), b = Date.parse(toIso)
  if (isNaN(a) || isNaN(b)) return 0
  return Math.max(0, (b - a) / 3_600_000)
}

/** Escalation stages that are due but not yet fired, given elapsed waiting time. */
export function dueEscalations(pendingSinceIso: string, nowIso: string, firedStages: number[], rules: EscalationRule[] = DEFAULT_ESCALATION): EscalationRule[] {
  const elapsed = hoursBetween(pendingSinceIso, nowIso)
  const fired = new Set(firedStages)
  return rules.filter(r => elapsed >= r.afterHours && !fired.has(r.stage)).sort((a, b) => a.stage - b.stage)
}

/** Is the SLA breached (past the first threshold)? */
export function slaBreached(pendingSinceIso: string, nowIso: string, rules: EscalationRule[] = DEFAULT_ESCALATION): boolean {
  const first = Math.min(...rules.map(r => r.afterHours))
  return hoursBetween(pendingSinceIso, nowIso) >= first
}

/** SLA status for display: on_track / due_soon (≥75% of first threshold) / breached. */
export function slaStatus(pendingSinceIso: string, nowIso: string, rules: EscalationRule[] = DEFAULT_ESCALATION): 'on_track' | 'due_soon' | 'breached' {
  const first = Math.min(...rules.map(r => r.afterHours))
  const elapsed = hoursBetween(pendingSinceIso, nowIso)
  if (elapsed >= first) return 'breached'
  if (elapsed >= first * 0.75) return 'due_soon'
  return 'on_track'
}
