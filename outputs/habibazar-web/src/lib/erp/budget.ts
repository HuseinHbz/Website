/**
 * Budget engine (Phase 26.11, M1/M2) — pure, side-effect-free, unit-tested.
 *
 * Turns budget lines + real actuals (from POSTED GL / sales / purchase) into
 * variance analysis: consumption %, over/under status, remaining and a full-year
 * projection. The data layer (`budgetData.ts`) supplies the numbers; this file
 * only computes. No DB, no I/O.
 */

export const BUDGET_TYPES = ['annual', 'monthly', 'department', 'project', 'branch', 'company', 'cost_center'] as const
export type BudgetType = (typeof BUDGET_TYPES)[number]

export const BUDGET_STATUSES = ['draft', 'review', 'approved', 'locked'] as const
export type BudgetStatus = (typeof BUDGET_STATUSES)[number]

/** Legal status transitions: draft→review→approved→locked (+ approved→review revise). */
const NEXT: Record<BudgetStatus, BudgetStatus[]> = {
  draft: ['review'],
  review: ['approved', 'draft'],
  approved: ['locked', 'review'],
  locked: [],
}
export function canTransition(from: BudgetStatus, to: BudgetStatus): boolean {
  return NEXT[from]?.includes(to) ?? false
}
/** A locked budget is immutable (no line edits). */
export function isEditable(status: BudgetStatus): boolean {
  return status === 'draft' || status === 'review'
}

export interface BudgetLine { category: string; costCenterId?: number | null; accountId?: number | null; period?: string | null; amount: number }
export interface ActualEntry { category?: string | null; costCenterId?: number | null; accountId?: number | null; period?: string | null; amount: number }

function round2(n: number): number { return Math.round(n * 100) / 100 }

export function budgetTotal(lines: BudgetLine[]): number {
  return round2(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0))
}
export function actualTotal(actuals: ActualEntry[]): number {
  return round2(actuals.reduce((s, a) => s + (Number(a.amount) || 0), 0))
}

export type VarianceStatus = 'under' | 'on_track' | 'warning' | 'over'

/** Status from consumption %: >100 over, ≥90 warning, <50 under, else on_track. */
export function consumptionStatus(consumptionPct: number): VarianceStatus {
  if (consumptionPct > 100) return 'over'
  if (consumptionPct >= 90) return 'warning'
  if (consumptionPct < 50) return 'under'
  return 'on_track'
}

export interface VarianceRow {
  key: string
  budget: number
  actual: number
  variance: number        // actual − budget (positive = over budget)
  variancePct: number     // variance / budget × 100
  consumptionPct: number  // actual / budget × 100
  remaining: number       // budget − actual (may be negative when over)
  status: VarianceStatus
}

function varianceOf(key: string, budget: number, actual: number): VarianceRow {
  const variance = round2(actual - budget)
  const variancePct = budget > 0 ? round2(variance / budget * 100) : (actual > 0 ? 100 : 0)
  const consumptionPct = budget > 0 ? round2(actual / budget * 100) : (actual > 0 ? 100 : 0)
  return { key, budget: round2(budget), actual: round2(actual), variance, variancePct, consumptionPct, remaining: round2(budget - actual), status: consumptionStatus(consumptionPct) }
}

/** Group key extractor per dimension. */
function keyFor(dim: 'category' | 'costCenter' | 'period' | 'account', x: BudgetLine | ActualEntry): string {
  if (dim === 'category') return (x as BudgetLine).category ?? (x as ActualEntry).category ?? '—'
  if (dim === 'costCenter') return x.costCenterId != null ? String(x.costCenterId) : '—'
  if (dim === 'account') return x.accountId != null ? String(x.accountId) : '—'
  return x.period ?? '—'
}

/** Budget vs actual, grouped by a dimension → one variance row per group. */
export function budgetVariance(lines: BudgetLine[], actuals: ActualEntry[], groupBy: 'category' | 'costCenter' | 'period' | 'account' = 'category'): VarianceRow[] {
  const budgets = new Map<string, number>()
  for (const l of lines) budgets.set(keyFor(groupBy, l), (budgets.get(keyFor(groupBy, l)) ?? 0) + (Number(l.amount) || 0))
  const acts = new Map<string, number>()
  for (const a of actuals) acts.set(keyFor(groupBy, a), (acts.get(keyFor(groupBy, a)) ?? 0) + (Number(a.amount) || 0))
  const keys = new Set([...budgets.keys(), ...acts.keys()])
  return [...keys].map(k => varianceOf(k, budgets.get(k) ?? 0, acts.get(k) ?? 0)).sort((a, b) => b.actual - a.actual)
}

export interface BudgetSummary {
  budget: number
  actual: number
  variance: number
  variancePct: number
  consumptionPct: number
  remaining: number
  status: VarianceStatus
  overBudget: VarianceRow[]   // rows over 100%
  atRisk: VarianceRow[]       // rows ≥ 90% (warning) and not yet over
}
export function budgetSummary(rows: VarianceRow[]): BudgetSummary {
  const budget = round2(rows.reduce((s, r) => s + r.budget, 0))
  const actual = round2(rows.reduce((s, r) => s + r.actual, 0))
  const top = varianceOf('total', budget, actual)
  return {
    budget, actual, variance: top.variance, variancePct: top.variancePct, consumptionPct: top.consumptionPct,
    remaining: top.remaining, status: top.status,
    overBudget: rows.filter(r => r.status === 'over'),
    atRisk: rows.filter(r => r.status === 'warning'),
  }
}

/**
 * Project the full-period spend from what's consumed so far and how much of the
 * period has elapsed (0..1), then the forecast remaining budget.
 */
export function forecastRemaining(budget: number, actual: number, elapsedFraction: number): { projected: number; remaining: number; forecastVariance: number } {
  const frac = Math.min(1, Math.max(0, elapsedFraction))
  const projected = frac > 0 ? round2(actual / frac) : round2(actual)
  return { projected, remaining: round2(budget - actual), forecastVariance: round2(projected - budget) }
}
