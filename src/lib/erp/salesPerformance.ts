/**
 * Sales performance engine (Phase 26.4) — targets, commission, forecast.
 *
 * Pure and deterministic: monthly invoiced revenue is compared against the
 * `sales_targets` table (period = YYYY-MM), commission is a straight revenue
 * commission (invoiced × commission%), and the forecast is a least-squares
 * linear trend over the actual months (clamped at zero, moving-average
 * fallback under 3 points). The data layer feeds real ledger sums in.
 */

const round2 = (n: number) => Math.round(n * 100) / 100

export interface MonthlySales { month: string; invoiced: number }
export interface TargetRow { period: string; target: number; commissionPct: number }
export type AttainmentStatus = 'above' | 'near' | 'below' | 'no_target'

export interface PerformanceMonth {
  month: string
  invoiced: number
  target: number
  commissionPct: number
  /** invoiced / target × 100 (0 when no target). */
  attainmentPct: number
  /** Straight revenue commission: invoiced × commission%. */
  commission: number
  status: AttainmentStatus
}

export interface PerformanceResult {
  months: PerformanceMonth[]
  totals: { invoiced: number; target: number; attainmentPct: number; commission: number }
  forecast: { month: string; invoiced: number }[]
}

/** ≥100% above · ≥80% near · else below · no_target when target is 0. */
export function attainmentStatus(attainmentPct: number, target: number): AttainmentStatus {
  if (target <= 0) return 'no_target'
  if (attainmentPct >= 100) return 'above'
  if (attainmentPct >= 80) return 'near'
  return 'below'
}

/** Next 'YYYY-MM' key. */
function nextMonth(key: string): string {
  const y = Number(key.slice(0, 4)), m = Number(key.slice(5, 7))
  return m >= 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

/**
 * Least-squares linear trend projected `horizon` months forward (never below
 * zero). Under 3 actual points it falls back to the plain average.
 */
export function forecastSales(actuals: MonthlySales[], horizon = 3): { month: string; invoiced: number }[] {
  if (!actuals.length || horizon <= 0) return []
  const ys = actuals.map(a => a.invoiced)
  const n = ys.length
  let predict: (step: number) => number
  if (n < 3) {
    const avg = ys.reduce((s, v) => s + v, 0) / n
    predict = () => avg
  } else {
    const xs = ys.map((_, i) => i)
    const mx = xs.reduce((s, v) => s + v, 0) / n
    const my = ys.reduce((s, v) => s + v, 0) / n
    const denom = xs.reduce((s, x) => s + (x - mx) * (x - mx), 0)
    const slope = denom === 0 ? 0 : xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / denom
    predict = (step) => my + slope * (n - 1 + step - mx)
  }
  const out: { month: string; invoiced: number }[] = []
  let cursor = actuals[actuals.length - 1].month
  for (let i = 1; i <= horizon; i++) {
    cursor = nextMonth(cursor)
    out.push({ month: cursor, invoiced: round2(Math.max(0, predict(i))) })
  }
  return out
}

/**
 * Join monthly revenue with targets into the performance series + totals +
 * forecast. `sales` should cover the reporting window in month order.
 */
export function salesPerformance(sales: MonthlySales[], targets: TargetRow[], forecastMonths = 3): PerformanceResult {
  const tmap = new Map(targets.map(t => [t.period, t]))
  const months: PerformanceMonth[] = sales.map(s => {
    const t = tmap.get(s.month)
    const target = round2(t?.target ?? 0)
    const pct = round2(t?.commissionPct ?? 0)
    const attainment = target > 0 ? round2((s.invoiced / target) * 100) : 0
    return {
      month: s.month, invoiced: round2(s.invoiced), target, commissionPct: pct,
      attainmentPct: attainment,
      commission: round2(s.invoiced * pct / 100),
      status: attainmentStatus(attainment, target),
    }
  })
  const invoiced = round2(months.reduce((s, m) => s + m.invoiced, 0))
  const target = round2(months.reduce((s, m) => s + m.target, 0))
  return {
    months,
    totals: {
      invoiced, target,
      attainmentPct: target > 0 ? round2((invoiced / target) * 100) : 0,
      commission: round2(months.reduce((s, m) => s + m.commission, 0)),
    },
    forecast: forecastSales(sales, forecastMonths),
  }
}

// ── Customer statement (pure ledger math) ────────────────────────────────────
export interface StatementEntry {
  date: string
  kind: 'invoice' | 'credit_note' | 'debit_note' | 'payment'
  ref: string
  debit: number
  credit: number
}
export interface StatementLine extends StatementEntry { balance: number }

/** Chronological ledger with a running balance (debits raise what the customer owes). */
export function runStatement(entries: StatementEntry[]): { lines: StatementLine[]; totals: { debit: number; credit: number; balance: number } } {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref))
  let balance = 0
  const lines = sorted.map(e => {
    balance = round2(balance + e.debit - e.credit)
    return { ...e, debit: round2(e.debit), credit: round2(e.credit), balance }
  })
  return {
    lines,
    totals: {
      debit: round2(lines.reduce((s, l) => s + l.debit, 0)),
      credit: round2(lines.reduce((s, l) => s + l.credit, 0)),
      balance,
    },
  }
}
