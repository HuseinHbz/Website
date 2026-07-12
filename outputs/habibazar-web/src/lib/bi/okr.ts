/**
 * OKR engine (Phase 26.13, M3) — pure, unit-tested.
 * Objective progress rolls up from its key results (each 0..100% of its own
 * start→target range), with a confidence signal and company/dept/employee
 * alignment roll-up.
 */

export interface KeyResult { start: number; target: number; current: number; weight?: number }

/** A key result's progress %, clamped 0..100, honouring start→target direction. */
export function krProgress(kr: KeyResult): number {
  const span = kr.target - kr.start
  if (span === 0) return kr.current >= kr.target ? 100 : 0
  const pct = (kr.current - kr.start) / span * 100
  return Math.round(Math.min(100, Math.max(0, pct)) * 10) / 10
}

/** Objective progress = weighted average of its key results. */
export function objectiveProgress(krs: KeyResult[]): number {
  const tw = krs.reduce((s, k) => s + (k.weight ?? 1), 0)
  if (tw === 0) return 0
  const sum = krs.reduce((s, k) => s + krProgress(k) * (k.weight ?? 1), 0)
  return Math.round(sum / tw * 10) / 10
}

export type OkrStatus = 'on_track' | 'at_risk' | 'behind' | 'not_started'
/** Status vs the fraction of the period elapsed (0..1). */
export function okrStatus(progressPct: number, timeElapsedFraction: number): OkrStatus {
  if (progressPct <= 0) return 'not_started'
  const expected = Math.min(100, Math.max(0, timeElapsedFraction * 100))
  if (progressPct >= expected - 5) return 'on_track'
  if (progressPct >= expected - 20) return 'at_risk'
  return 'behind'
}

/** Confidence 0..1: how far progress keeps pace with elapsed time. */
export function confidence(progressPct: number, timeElapsedFraction: number): number {
  const expected = Math.max(1, timeElapsedFraction * 100)
  return Math.round(Math.min(1, progressPct / expected) * 100) / 100
}

/** Roll a set of objective progress values (with weights) into an alignment score. */
export function alignmentRollup(objectives: { progress: number; weight?: number }[]): number {
  const tw = objectives.reduce((s, o) => s + (o.weight ?? 1), 0)
  if (tw === 0) return 0
  return Math.round(objectives.reduce((s, o) => s + o.progress * (o.weight ?? 1), 0) / tw * 10) / 10
}
