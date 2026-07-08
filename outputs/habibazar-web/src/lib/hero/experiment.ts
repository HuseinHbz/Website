/**
 * Hero A/B Experiment engine (Phase 23) — pure, deterministic.
 *
 * Assigns a stable variant per subject (deterministic bucketing → same visitor
 * always sees the same variant), and computes experiment results + winner
 * detection from aggregated event counts. No I/O → unit-tested.
 */

export interface ExperimentVariant {
  id: string
  heroId: number
  /** Traffic share 0..100. Shares are normalised if they don't sum to 100. */
  weight: number
}
export interface Experiment {
  id: number
  key: string
  status: 'draft' | 'running' | 'stopped' | 'completed'
  variants: ExperimentVariant[]
}

/** Deterministic 0..99 bucket from a subject id (djb2 hash). */
export function bucketOf(subjectId: string, salt = ''): number {
  let h = 5381
  const s = `${salt}:${subjectId}`
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h % 100
}

/** Pick a variant for a subject by weighted deterministic bucketing. */
export function pickVariant(exp: Experiment, subjectId: string): ExperimentVariant | null {
  const variants = exp.variants.filter(v => v.weight > 0)
  if (variants.length === 0) return null
  const total = variants.reduce((s, v) => s + v.weight, 0)
  const bucket = bucketOf(subjectId, exp.key)
  let acc = 0
  for (const v of variants) {
    acc += (v.weight / total) * 100
    if (bucket < acc) return v
  }
  return variants[variants.length - 1]
}

export interface VariantCounts { variantId: string; views: number; clicks: number; conversions: number }
export interface VariantResult extends VariantCounts { ctr: number; conversionRate: number }
export interface ExperimentResult {
  variants: VariantResult[]
  winner: string | null
  significant: boolean
}

const rate = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 10000) / 100 : 0)

/**
 * Compute per-variant CTR/conversion + a winner. Winner = highest conversion
 * rate with ≥ `minSample` views and a lift over the runner-up ≥ `minLift` (pp).
 */
export function experimentResult(counts: VariantCounts[], minSample = 100, minLift = 1): ExperimentResult {
  const variants: VariantResult[] = counts.map(c => ({
    ...c, ctr: rate(c.clicks, c.views), conversionRate: rate(c.conversions, c.views),
  }))
  const eligible = variants.filter(v => v.views >= minSample).sort((a, b) => b.conversionRate - a.conversionRate)
  if (eligible.length === 0) return { variants, winner: null, significant: false }
  if (eligible.length === 1) return { variants, winner: eligible[0].variantId, significant: true }
  const [first, second] = eligible
  const significant = first.conversionRate - second.conversionRate >= minLift
  return { variants, winner: significant ? first.variantId : null, significant }
}
