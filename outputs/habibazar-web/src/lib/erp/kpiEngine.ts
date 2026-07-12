/**
 * Financial KPI engine (Phase 26.11, M6) — pure, unit-tested.
 *
 * Derives the enterprise KPI set (revenue, profit, cash, AR, AP, inventory) from
 * numbers the data layer already computes via the verified ledger/sales/purchase/
 * inventory engines. No DB here — just the ratios/derivations, so it's testable.
 */

function round2(n: number): number { return Math.round(n * 100) / 100 }

export interface KpiInput {
  // profitability
  revenue: number
  cogs?: number            // cost of goods sold (for gross profit); falls back to expenses
  expenses: number
  netIncome: number
  revenueHistory?: { period: string; value: number }[]   // ascending months, for growth
  annualRevenue?: number
  // cash
  cash: number
  monthlyBurn?: number     // net monthly cash outflow (expense − revenue if positive)
  // working capital
  outstandingAR: number
  outstandingAP: number
  inventoryValue: number
  // efficiency (optional; supplied when derivable)
  collectionDays?: number
  inventoryTurnover?: number
}

export interface FinancialKpiSet {
  revenue: { monthly: number; annual: number; growthRatePct: number }
  profit: { gross: number; net: number; grossMarginPct: number; netMarginPct: number }
  cash: { position: number; burnRate: number; runwayMonths: number | null }
  receivable: { outstanding: number; collectionDays: number | null }
  payable: { outstanding: number }
  inventory: { value: number; turnover: number | null }
}

/** Month-over-month growth from the last two points of an ascending history. */
export function growthRate(history: { period: string; value: number }[] | undefined): number {
  if (!history || history.length < 2) return 0
  const prev = history[history.length - 2].value
  const cur = history[history.length - 1].value
  if (prev === 0) return cur > 0 ? 100 : 0
  return round2((cur - prev) / prev * 100)
}

export function buildFinancialKpis(input: KpiInput): FinancialKpiSet {
  const cogs = input.cogs ?? input.expenses
  const grossProfit = round2(input.revenue - cogs)
  const grossMarginPct = input.revenue > 0 ? round2(grossProfit / input.revenue * 100) : 0
  const netMarginPct = input.revenue > 0 ? round2(input.netIncome / input.revenue * 100) : 0
  const burn = input.monthlyBurn ?? Math.max(0, round2(input.expenses - input.revenue))
  const runwayMonths = burn > 0 ? round2(input.cash / burn) : null
  return {
    revenue: {
      monthly: round2(input.revenue),
      annual: round2(input.annualRevenue ?? input.revenue * 12),
      growthRatePct: growthRate(input.revenueHistory),
    },
    profit: { gross: grossProfit, net: round2(input.netIncome), grossMarginPct, netMarginPct },
    cash: { position: round2(input.cash), burnRate: round2(burn), runwayMonths },
    receivable: { outstanding: round2(input.outstandingAR), collectionDays: input.collectionDays ?? null },
    payable: { outstanding: round2(input.outstandingAP) },
    inventory: { value: round2(input.inventoryValue), turnover: input.inventoryTurnover ?? null },
  }
}

/** Average collection period (DSO) = AR / revenue × days-in-period. */
export function collectionDays(outstandingAR: number, periodRevenue: number, daysInPeriod = 30): number {
  if (periodRevenue <= 0) return 0
  return round2(outstandingAR / periodRevenue * daysInPeriod)
}

/** Inventory turnover = COGS / average inventory value. */
export function inventoryTurnover(cogs: number, avgInventory: number): number {
  if (avgInventory <= 0) return 0
  return round2(cogs / avgInventory)
}
