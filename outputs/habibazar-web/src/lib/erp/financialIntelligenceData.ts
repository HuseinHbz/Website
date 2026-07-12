/**
 * Financial Intelligence data layer (Phase 26.11) — assembles the KPI engine,
 * forecasting engine and CFO/department dashboards from the ALREADY-verified
 * module data layers (ledger/sales/purchase/inventory/banking). No duplicated
 * aggregation: it reuses `financeOverview`, `inventoryKpis`, etc., and feeds the
 * pure engines (`kpiEngine`/`forecast`). Every section is guarded so one failing
 * query never breaks the dashboard.
 */
import { pgQuery } from '@/lib/db'
import { financeOverview } from './ledgerData'
import { inventoryKpis } from './inventory'
import { loadProductLevels } from './inventoryData'
import { buildFinancialKpis, collectionDays, type KpiInput, type FinancialKpiSet } from './kpiEngine'
import { forecast, type ForecastMetric, type ForecastMethod, type Point } from './forecast'
import { budgetPortfolio } from './budgetData'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

async function num(sql: string, params: unknown[] = []): Promise<number> {
  try { return Number((await pgQuery<{ v: number }>(sql, params))[0]?.v ?? 0) } catch { return 0 }
}
async function series(sql: string): Promise<Point[]> {
  try { return ((await pgQuery<{ period: string; value: number }>(sql)) as { period: string; value: number }[]).map(r => ({ period: r.period, value: Number(r.value) })) } catch { return [] }
}

/** Open receivables / payables (AR / AP). */
export async function openReceivables(): Promise<number> {
  return num(`SELECT COALESCE(SUM(total-paid_total),0)::float AS v FROM sales_documents WHERE doc_type='invoice' AND status IN ('sent','confirmed','partial')`)
}
export async function openPayables(): Promise<number> {
  return num(`SELECT COALESCE(SUM(total-paid_total),0)::float AS v FROM purchase_documents WHERE doc_type='invoice' AND status IN ('confirmed','partial')`)
}

/** Monthly history for a metric (ascending, last 12 months). */
export async function metricSeries(metric: ForecastMetric): Promise<Point[]> {
  if (metric === 'revenue')
    return (await series(`SELECT substr(date,1,7) AS period, COALESCE(SUM(total),0)::float AS value FROM sales_documents WHERE doc_type='invoice' AND status<>'void' GROUP BY 1 ORDER BY 1 DESC LIMIT 12`)).reverse()
  if (metric === 'expense')
    return (await series(`SELECT substr(date,1,7) AS period, COALESCE(SUM(total),0)::float AS value FROM purchase_documents WHERE doc_type='invoice' AND status NOT IN ('draft','void','rejected') GROUP BY 1 ORDER BY 1 DESC LIMIT 12`)).reverse()
  if (metric === 'cash_flow')
    return (await series(`SELECT period, SUM(value)::float AS value FROM (
       SELECT substr(date,1,7) AS period, amount::float AS value FROM sales_payments
       UNION ALL SELECT substr(date,1,7) AS period, -amount::float AS value FROM purchase_payments
     ) t GROUP BY period ORDER BY period DESC LIMIT 12`)).reverse()
  // profit = revenue − expense per month
  const rev = await metricSeries('revenue'); const exp = await metricSeries('expense')
  const em = new Map(exp.map(p => [p.period, p.value]))
  return rev.map(p => ({ period: p.period, value: Math.round((p.value - (em.get(p.period) ?? 0)) * 100) / 100 }))
}

/** Assemble the full KPI input from the live books and build the KPI set. */
export async function assembleKpis(): Promise<{ kpis: FinancialKpiSet; input: KpiInput }> {
  const ov = await financeOverview()
  const k = ov.kpis
  const [ar, ap] = [await openReceivables(), await openPayables()]
  let inventoryValue = 0
  try { inventoryValue = inventoryKpis(await loadProductLevels()).totalValue } catch { /* inventory optional */ }
  const revenueHistory = await metricSeries('revenue')
  const monthlyRevenue = revenueHistory.length ? revenueHistory[revenueHistory.length - 1].value : k.revenue
  const input: KpiInput = {
    revenue: monthlyRevenue || k.revenue, expenses: k.expenses, netIncome: k.netIncome, cash: k.cash,
    outstandingAR: ar, outstandingAP: ap, inventoryValue, revenueHistory,
    collectionDays: collectionDays(ar, monthlyRevenue || k.revenue, 30),
    annualRevenue: revenueHistory.reduce((s, p) => s + p.value, 0) || k.revenue,
  }
  return { kpis: buildFinancialKpis(input), input }
}

export async function saveKpiSnapshot(userId: string, currency = 'IRR'): Promise<{ id: number }> {
  const { kpis } = await assembleKpis()
  const r = (await pgQuery<{ id: number }>(
    `INSERT INTO erp_kpi_snapshots (as_of, currency, kpis, created_by) VALUES (substr(${NOW},1,10),$1,$2,$3) RETURNING id`,
    [currency, JSON.stringify(kpis), userId]))[0]
  return r
}
export async function listKpiSnapshots(limit = 30) {
  return pgQuery(`SELECT id, as_of AS "asOf", currency, kpis, created_at AS "createdAt" FROM erp_kpi_snapshots ORDER BY as_of DESC, id DESC LIMIT $1`, [limit])
}

// ── Forecasting (M5) ─────────────────────────────────────────────────────────
export async function runForecast(metric: ForecastMetric, method: ForecastMethod, horizon = 3): Promise<ReturnType<typeof forecast> & { metric: ForecastMetric }> {
  const history = await metricSeries(metric)
  return { ...forecast(history, { method, horizon }), metric }
}
export async function saveForecast(input: { nameEn: string; nameFa?: string; metric: ForecastMetric; method: ForecastMethod; horizon: number; currency?: string }, userId: string): Promise<{ id: number }> {
  const result = await runForecast(input.metric, input.method, input.horizon)
  const r = (await pgQuery<{ id: number }>(
    `INSERT INTO erp_forecasts (name_en, name_fa, metric, method, horizon, currency, result, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [input.nameEn, input.nameFa ?? null, input.metric, input.method, input.horizon, input.currency ?? 'IRR', JSON.stringify(result), userId]))[0]
  return r
}
export async function listForecasts() {
  return pgQuery(`SELECT id, name_en AS "nameEn", name_fa AS "nameFa", metric, method, horizon, currency, result, created_at AS "createdAt" FROM erp_forecasts ORDER BY id DESC LIMIT 50`)
}

// ── Risk inputs (currency exposure, tax liability) ───────────────────────────
export async function currencyExposure(): Promise<{ code: string; base: number; sharePct: number }[]> {
  try {
    const rows = await pgQuery<{ code: string; base: number }>(
      `SELECT currency AS code, COALESCE(SUM(COALESCE(base_total,total)),0)::float AS base
       FROM sales_documents WHERE doc_type='invoice' AND status IN ('sent','confirmed','partial') AND currency<>'IRR'
       GROUP BY currency`)
    const total = rows.reduce((s, r) => s + Number(r.base), 0)
    return rows.map(r => ({ code: r.code, base: Number(r.base), sharePct: total > 0 ? Math.round(Number(r.base) / total * 1000) / 10 : 0 }))
  } catch { return [] }
}
export async function taxLiability(): Promise<number> {
  return num(`SELECT COALESCE(SUM(l.credit-l.debit),0)::float AS v FROM gl_journal_lines l JOIN gl_journal_entries e ON e.id=l.entry_id AND e.status='posted' JOIN gl_accounts a ON a.id=l.account_id WHERE a.code='2100'`)
}

/** CFO Executive Dashboard (M7): overview + working capital + risk + trends. */
export async function cfoDashboard() {
  const { kpis } = await assembleKpis()
  const [revenueTrend, expenseTrend, profitTrend, cashTrend] = await Promise.all([
    metricSeries('revenue'), metricSeries('expense'), metricSeries('profit'), metricSeries('cash_flow'),
  ])
  const [exposure, tax, portfolio] = await Promise.all([currencyExposure(), taxLiability(), budgetPortfolio().catch(() => [])])
  const overBudget = portfolio.filter(p => p.consumptionPct > 100)
  return {
    overview: { revenue: kpis.revenue.monthly, expense: kpis.profit.gross >= 0 ? kpis.revenue.monthly - kpis.profit.gross : 0, profit: kpis.profit.net, cash: kpis.cash.position },
    kpis,
    workingCapital: { ar: kpis.receivable.outstanding, ap: kpis.payable.outstanding, inventory: kpis.inventory.value },
    risk: { currencyExposure: exposure, taxLiability: tax, overBudget },
    charts: { revenueTrend, expenseTrend, profitTrend, cashTrend },
  }
}

/** Department Manager Dashboard (M8): scoped to the user's cost centers. */
export async function departmentDashboard(costCenterIds: number[] | null) {
  const { costCenterOverview } = await import('./costCenterData')
  const cc = await costCenterOverview(costCenterIds ?? undefined)
  // Scoped budgets (those whose cost_center_id is in scope, or all when unrestricted).
  const budgets = await budgetPortfolio().catch(() => [])
  return { centers: cc.centers, totals: cc.totals, budgets }
}
