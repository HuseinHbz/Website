/**
 * Treasury analytics data layer (Phase 26.14, M6/M7/M8/M9). Cash position,
 * liquidity forecast (AR/AP sourced), FX risk/exposure, cheque calendar/aging,
 * and the treasury overview — all from live data, feeding the pure engines.
 * Reuses banking (petty cash / cheques) and the currency rates.
 */
import { pgQuery } from '@/lib/db'
import { cashPosition, liquidityForecast, liquidityRisk, type DatedFlow } from './cash'
import { exposureByCurrency, riskSummary, type CurrencyPosition } from './risk'
import { chequeAging, chequeCalendar, type ChequeRow } from './cheque'
import { pettyCashSummary, type PettyEntry } from '@/lib/erp/banking'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
async function num(sql: string, p: unknown[] = []): Promise<number> { try { return Number((await pgQuery<{ v: number }>(sql, p))[0]?.v ?? 0) } catch { return 0 } }

// ── Cash position (M7) ───────────────────────────────────────────────────────
export async function currentCashPosition() {
  const bank = await num(`SELECT COALESCE(SUM(a.opening_balance + COALESCE((SELECT SUM(amount) FROM bank_statement_lines WHERE account_id=a.id),0)),0)::float AS v FROM bank_accounts a WHERE a.active=true`)
  const petty = pettyCashSummary((await pgQuery<{ kind: string; amount: number }>(`SELECT kind, amount::float AS amount FROM petty_cash_entries`)).map(r => ({ kind: r.kind as PettyEntry['kind'], amount: Number(r.amount) }))).balance
  const pendingReceipts = Math.max(0, await num(`SELECT COALESCE(SUM(total),0)::float AS v FROM sales_documents WHERE doc_type='invoice' AND status IN ('sent','confirmed','partial')`) - await num(`SELECT COALESCE(SUM(amount),0)::float AS v FROM sales_payments`))
  const pendingPayments = await num(`SELECT COALESCE(SUM(amount),0)::float AS v FROM payment_orders WHERE status IN ('approved','processing')`)
    + await num(`SELECT COALESCE(SUM(total-paid_total),0)::float AS v FROM purchase_documents WHERE doc_type='invoice' AND status IN ('confirmed','partial')`)
  return cashPosition({ bankBalances: bank, cashAccounts: petty, pendingReceipts, pendingPayments })
}
export async function saveCashSnapshot(userId: string): Promise<{ id: number }> {
  const p = await currentCashPosition()
  void userId
  return (await pgQuery<{ id: number }>(`INSERT INTO cash_positions (as_of, bank, cash, pending_receipts, pending_payments, projected) VALUES (substr(${NOW},1,10),$1,$2,$3,$4,$5) RETURNING id`,
    [p.bank, p.cash, p.pendingReceipts, p.pendingPayments, p.projected]))[0]
}

// ── Liquidity forecast (M8) ──────────────────────────────────────────────────
export async function liquidity() {
  const asOf = new Date().toISOString().slice(0, 10)
  const inflows = (await pgQuery<{ date: string; amount: number }>(`SELECT date, total::float AS amount FROM sales_documents WHERE doc_type='invoice' AND status IN ('sent','confirmed','partial')`)).map(r => ({ date: r.date, amount: Number(r.amount) })) as DatedFlow[]
  const outflows = [
    ...(await pgQuery<{ date: string; amount: number }>(`SELECT date, (total-paid_total)::float AS amount FROM purchase_documents WHERE doc_type='invoice' AND status IN ('confirmed','partial') AND (total-paid_total)>0`)).map(r => ({ date: r.date, amount: Number(r.amount) })),
    ...(await pgQuery<{ date: string; amount: number }>(`SELECT date, amount::float AS amount FROM payment_orders WHERE status IN ('approved','processing')`)).map(r => ({ date: r.date, amount: Number(r.amount) })),
  ] as DatedFlow[]
  const opening = (await currentCashPosition()).available
  const buckets = liquidityForecast(opening, inflows, outflows, asOf)
  return { asOf, opening, buckets, risk: liquidityRisk(buckets) }
}
export async function saveForecast(userId: string): Promise<{ id: number }> {
  const l = await liquidity()
  return (await pgQuery<{ id: number }>(`INSERT INTO treasury_forecasts (as_of, buckets, risk, created_by) VALUES ($1,$2,$3,$4) RETURNING id`, [l.asOf, JSON.stringify(l.buckets), l.risk, userId]))[0]
}

// ── FX risk (M9) ─────────────────────────────────────────────────────────────
export async function currencyRisk() {
  // Assets = open receivables per currency; liabilities = open payables per currency.
  const ar = await pgQuery<{ currency: string; v: number }>(`SELECT currency, COALESCE(SUM(total),0)::float AS v FROM sales_documents WHERE doc_type='invoice' AND status IN ('sent','confirmed','partial') GROUP BY currency`).catch(() => [])
  const ap = await pgQuery<{ currency: string; v: number }>(`SELECT currency, COALESCE(SUM(total-paid_total),0)::float AS v FROM purchase_documents WHERE doc_type='invoice' AND status IN ('confirmed','partial') GROUP BY currency`).catch(() => [])
  const positions: CurrencyPosition[] = [
    ...ar.map(r => ({ currency: r.currency, assets: Number(r.v), liabilities: 0 })),
    ...ap.map(r => ({ currency: r.currency, assets: 0, liabilities: Number(r.v) })),
  ]
  const exposures = exposureByCurrency(positions.filter(p => p.currency && p.currency !== 'IRR'))
  const rateRows = await pgQuery<{ code: string; rate: number }>(`SELECT code, rate::float AS rate FROM erp_exchange_rates e WHERE date = (SELECT MAX(date) FROM erp_exchange_rates WHERE code=e.code)`).catch(() => [])
  const rates: Record<string, { booked: number; current: number }> = {}
  for (const r of rateRows) rates[r.code] = { booked: Number(r.rate), current: Number(r.rate) }   // booked≈current when no historical booked rate
  const baseTotal = await num(`SELECT COALESCE(SUM(CASE WHEN type='equity' THEN 0 ELSE 0 END),1)::float AS v FROM gl_accounts LIMIT 1`)
  const summary = riskSummary(exposures, rates, baseTotal || 1)
  return { exposures, summary }
}
export async function saveExposure(): Promise<{ saved: number }> {
  const { exposures } = await currencyRisk()
  for (const e of exposures) await pgQuery(`INSERT INTO currency_exposures (as_of, currency, assets, liabilities, net_exposure) VALUES (substr(${NOW},1,10),$1,$2,$3,$4)`, [e.currency, e.assets, e.liabilities, e.netExposure])
  return { saved: exposures.length }
}

// ── Cheques (M6) ─────────────────────────────────────────────────────────────
export async function chequeDashboard() {
  const rows = (await pgQuery<{ id: number; direction: string; amount: number; due_date: string | null; status: string; party: string }>(
    `SELECT id, direction, amount::float AS amount, due_date, status, party FROM cheques ORDER BY due_date NULLS LAST LIMIT 500`))
    .map(c => ({ id: c.id, direction: c.direction as ChequeRow['direction'], amount: Number(c.amount), dueDate: c.due_date, status: c.status, party: c.party })) as ChequeRow[]
  return { aging: chequeAging(rows), calendar: chequeCalendar(rows).slice(0, 30), cheques: rows.slice(0, 100) }
}

// ── Overview (M11) ───────────────────────────────────────────────────────────
export async function treasuryOverview() {
  const cash = await currentCashPosition()
  const liq = await liquidity()
  const risk = await currencyRisk()
  const banks = await num(`SELECT COUNT(*)::int AS v FROM bank_accounts WHERE active=true`)
  const unmatched = await num(`SELECT COUNT(*)::int AS v FROM bank_statement_lines WHERE status='unmatched'`)
  const pendingPayments = await num(`SELECT COUNT(*)::int AS v FROM payment_orders WHERE status IN ('pending_approval','approved','processing')`)
  const openCheques = await num(`SELECT COUNT(*)::int AS v FROM cheques WHERE status IN ('issued','received','deposited','pending')`)
  return { cash, liquidity: liq, risk: risk.summary, banks, unmatched, pendingPayments, openCheques, generatedAt: new Date().toISOString() }
}
