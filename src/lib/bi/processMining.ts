/**
 * Process mining engine (Phase 26.13, M4) — pure, unit-tested.
 * Turns an ordered list of process events (stage + timestamp) into per-stage
 * durations, bottleneck detection, month-over-month delay signals and a 0..100
 * process performance score.
 */

export interface ProcessEvent { stage: string; at: string }   // ISO timestamps, ordered

function hours(a: string, b: string): number {
  const x = Date.parse(a), y = Date.parse(b)
  return isNaN(x) || isNaN(y) ? 0 : Math.max(0, (y - x) / 3_600_000)
}

export interface StageDuration { fromStage: string; toStage: string; hours: number }
/** Durations between consecutive events of a single case. */
export function caseDurations(events: ProcessEvent[]): StageDuration[] {
  const out: StageDuration[] = []
  for (let i = 1; i < events.length; i++) out.push({ fromStage: events[i - 1].stage, toStage: events[i].stage, hours: Math.round(hours(events[i - 1].at, events[i].at) * 10) / 10 })
  return out
}
/** Total cycle time of a case. */
export function cycleTime(events: ProcessEvent[]): number {
  return events.length < 2 ? 0 : Math.round(hours(events[0].at, events[events.length - 1].at) * 10) / 10
}

export interface StageStat { transition: string; avgHours: number; count: number; maxHours: number }
/** Aggregate transition stats across many cases → sorted slowest-first (bottlenecks). */
export function aggregateStages(cases: ProcessEvent[][]): StageStat[] {
  const m = new Map<string, { total: number; count: number; max: number }>()
  for (const c of cases) for (const d of caseDurations(c)) {
    const key = `${d.fromStage}→${d.toStage}`
    const cur = m.get(key) ?? { total: 0, count: 0, max: 0 }
    cur.total += d.hours; cur.count++; cur.max = Math.max(cur.max, d.hours)
    m.set(key, cur)
  }
  return [...m.entries()].map(([transition, v]) => ({ transition, avgHours: Math.round(v.total / v.count * 10) / 10, count: v.count, maxHours: Math.round(v.max * 10) / 10 }))
    .sort((a, b) => b.avgHours - a.avgHours)
}

/** The slowest transition = the bottleneck. */
export function bottleneck(stats: StageStat[]): StageStat | null { return stats[0] ?? null }

/** Delay signal: % change of an average vs a baseline (e.g. previous month). */
export function delayChangePct(current: number, baseline: number): number {
  if (baseline === 0) return current > 0 ? 100 : 0
  return Math.round((current - baseline) / baseline * 1000) / 10
}

/**
 * Process performance score 0..100: faster than target = higher. `targetHours`
 * is the acceptable average cycle time; failures drag the score down.
 */
export function performanceScore(avgCycleHours: number, targetHours: number, failureRatePct: number): number {
  const speed = targetHours <= 0 ? 100 : Math.min(100, targetHours / (avgCycleHours || Number.EPSILON) * 100)
  const score = speed * (1 - Math.min(1, Math.max(0, failureRatePct) / 100))
  return Math.round(Math.max(0, Math.min(100, score)) * 10) / 10
}
