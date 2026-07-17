/**
 * Project Costing — domain logic (Phase 21 ERP, Module 7).
 *
 * Pure, deterministic cost/profit/forecast maths that build on Project
 * Management. No DB access → fully unit-tested. Costs are grouped by category
 * (labor / equipment / purchase / travel / expense / other); labor is usually
 * derived from timesheet hours × rate. Profit = revenue − cost; forecast uses
 * earned-value (estimate-at-completion) from actual cost vs % progress.
 */

export const COST_CATEGORIES = ['labor', 'equipment', 'purchase', 'travel', 'expense', 'other'] as const
export type CostCategory = (typeof COST_CATEGORIES)[number]

export const REVENUE_CATEGORIES = ['sales', 'service', 'milestone', 'other'] as const
export type RevenueCategory = (typeof REVENUE_CATEGORIES)[number]

export interface CostEntry { category: CostCategory; amount: number }
export interface RevenueEntry { amount: number }

function round2(n: number): number { return Math.round(n * 100) / 100 }

/** Sum cost entries per category (categories with no entries omitted). */
export function costByCategory(entries: CostEntry[], laborFromTimesheets = 0): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of entries) out[e.category] = round2((out[e.category] ?? 0) + Math.max(0, e.amount || 0))
  if (laborFromTimesheets > 0) out.labor = round2((out.labor ?? 0) + laborFromTimesheets)
  return out
}

export interface CostingSummary {
  totalCost: number
  totalRevenue: number
  profit: number          // revenue − cost
  marginPct: number       // profit / revenue
  isLoss: boolean
  budget: number
  variance: number        // budget − cost (positive = under budget)
  variancePct: number
  overBudget: boolean
  // Earned-value forecast
  eac: number             // estimate at completion (forecast total cost)
  vac: number             // variance at completion (budget − eac)
  forecastOverrun: boolean
}

/**
 * Full costing summary for a project.
 * `progressPct` (0..100) drives the earned-value forecast: EAC = actual cost
 * scaled up to 100% completion (falls back to budget when there's no progress).
 */
export function costingSummary(i: {
  budget: number
  costEntries: CostEntry[]
  revenueEntries: RevenueEntry[]
  laborFromTimesheets?: number
  progressPct: number
}): CostingSummary {
  const byCat = costByCategory(i.costEntries, i.laborFromTimesheets ?? 0)
  const totalCost = round2(Object.values(byCat).reduce((s, v) => s + v, 0))
  const totalRevenue = round2(i.revenueEntries.reduce((s, r) => s + Math.max(0, r.amount || 0), 0))
  const profit = round2(totalRevenue - totalCost)
  const variance = round2(i.budget - totalCost)
  const eac = i.progressPct > 0 ? round2(totalCost / (i.progressPct / 100)) : (i.budget || totalCost)
  const vac = round2(i.budget - eac)
  return {
    totalCost,
    totalRevenue,
    profit,
    marginPct: totalRevenue > 0 ? round2((profit / totalRevenue) * 100) : 0,
    isLoss: profit < 0,
    budget: round2(i.budget),
    variance,
    variancePct: i.budget > 0 ? round2((variance / i.budget) * 100) : 0,
    overBudget: i.budget > 0 && totalCost > i.budget,
    eac,
    vac,
    forecastOverrun: i.budget > 0 && eac > i.budget,
  }
}

export interface CostingKpis {
  projects: number
  budget: number
  cost: number
  revenue: number
  profit: number
  overBudget: number
}

/** Portfolio costing rollup across projects. */
export function costingKpis(rows: { budget: number; cost: number; revenue: number }[]): CostingKpis {
  const budget = round2(rows.reduce((s, r) => s + r.budget, 0))
  const cost = round2(rows.reduce((s, r) => s + r.cost, 0))
  const revenue = round2(rows.reduce((s, r) => s + r.revenue, 0))
  return {
    projects: rows.length,
    budget, cost, revenue,
    profit: round2(revenue - cost),
    overBudget: rows.filter(r => r.budget > 0 && r.cost > r.budget).length,
  }
}
