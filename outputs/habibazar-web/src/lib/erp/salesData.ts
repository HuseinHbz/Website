/**
 * Sales server data layer — loads customers with their live credit position and
 * assembles the sales dashboard, from PostgreSQL. Credit/KPIs are computed via
 * the pure engine (lib/erp/sales.ts): one source of truth shared by the customer
 * list, the credit check and the dashboard.
 */
import { pgQuery } from '@/lib/db'
import { customerCredit, salesKpis } from './sales'

export interface CustomerWithCredit {
  id: number; code: string; name: string; email: string | null; phone: string | null
  company: string | null; taxId: string | null; creditLimit: number; active: number
  invoiced: number; paid: number; creditNotes: number
  outstanding: number; available: number; overLimit: boolean; utilizationPct: number
}

/** Aggregate a customer's posted invoices, payments and credit notes. */
async function billing(): Promise<Map<number, { invoiced: number; paid: number; creditNotes: number }>> {
  const inv = (await pgQuery(
    `SELECT customer_id AS "cid",
            COALESCE(SUM(CASE WHEN doc_type='invoice' AND status<>'void' THEN total ELSE 0 END),0)::float AS invoiced,
            COALESCE(SUM(CASE WHEN doc_type='credit_note' AND status<>'void' THEN total ELSE 0 END),0)::float AS "creditNotes"
     FROM sales_documents GROUP BY customer_id`, [])) as { cid: number; invoiced: number; creditNotes: number }[]
  const pay = (await pgQuery(`SELECT customer_id AS "cid", COALESCE(SUM(amount),0)::float AS paid FROM sales_payments GROUP BY customer_id`, [])) as { cid: number; paid: number }[]
  const m = new Map<number, { invoiced: number; paid: number; creditNotes: number }>()
  for (const r of inv) m.set(r.cid, { invoiced: r.invoiced, paid: 0, creditNotes: r.creditNotes })
  for (const r of pay) { const e = m.get(r.cid) ?? { invoiced: 0, paid: 0, creditNotes: 0 }; e.paid = r.paid; m.set(r.cid, e) }
  return m
}

export async function loadCustomers(): Promise<CustomerWithCredit[]> {
  const rows = (await pgQuery(
    `SELECT id, code, name, email, phone, company, tax_id AS "taxId", kind, national_id AS "nationalId", reg_no AS "regNo", economic_code AS "economicCode", credit_limit::float AS "creditLimit", active
     FROM sales_customers ORDER BY name`, [])) as Omit<CustomerWithCredit, 'invoiced' | 'paid' | 'creditNotes' | 'outstanding' | 'available' | 'overLimit' | 'utilizationPct'>[]
  const bill = await billing()
  return rows.map(c => {
    const b = bill.get(c.id) ?? { invoiced: 0, paid: 0, creditNotes: 0 }
    const cc = customerCredit({ creditLimit: c.creditLimit, invoicedTotal: b.invoiced, paidTotal: b.paid, creditNotesTotal: b.creditNotes })
    return { ...c, invoiced: b.invoiced, paid: b.paid, creditNotes: b.creditNotes, ...cc }
  })
}

export async function salesOverview() {
  const [agg, ordersValue, recent, topCustomers] = await Promise.all([
    pgQuery(
      `SELECT
         (SELECT COUNT(*)::int FROM sales_customers WHERE active=1) AS customers,
         (SELECT COUNT(*)::int FROM sales_documents WHERE doc_type='quote') AS quotes,
         (SELECT COUNT(*)::int FROM sales_documents WHERE doc_type='order') AS orders,
         COALESCE((SELECT SUM(total) FROM sales_documents WHERE doc_type='invoice' AND status<>'void'),0)::float AS invoiced,
         COALESCE((SELECT SUM(amount) FROM sales_payments),0)::float AS collected,
         COALESCE((SELECT SUM(total) FROM sales_documents WHERE doc_type='credit_note' AND status<>'void'),0)::float AS "creditNotes",
         COALESCE((SELECT SUM(tax_total) FROM sales_documents WHERE doc_type='invoice' AND status<>'void'),0)::float AS "taxCollected"`, []),
    pgQuery(`SELECT COALESCE(SUM(total),0)::float AS v FROM sales_documents WHERE doc_type='order' AND status<>'void'`, []),
    pgQuery(
      `SELECT d.id, d.doc_type AS "docType", d.doc_no AS "docNo", d.date, d.status, d.total::float AS total, c.name AS "customer"
       FROM sales_documents d JOIN sales_customers c ON c.id=d.customer_id WHERE d.deleted_at IS NULL ORDER BY d.created_at DESC LIMIT 12`, []),
    pgQuery(
      `SELECT c.name, COALESCE(SUM(CASE WHEN d.doc_type='invoice' AND d.status<>'void' THEN d.total ELSE 0 END),0)::float AS invoiced
       FROM sales_customers c LEFT JOIN sales_documents d ON d.customer_id=c.id
       GROUP BY c.id, c.name ORDER BY invoiced DESC LIMIT 6`, []),
  ])
  const a = (agg as Record<string, number>[])[0]
  const kpis = salesKpis({
    customers: a.customers, quotes: a.quotes, orders: a.orders,
    invoiced: a.invoiced, collected: a.collected, creditNotes: a.creditNotes,
    taxCollected: a.taxCollected, ordersValue: (ordersValue as { v: number }[])[0].v,
  })
  return { kpis, recent, topCustomers }
}

// ── Performance: targets · commission · forecast (Phase 26.4) ────────────────
import { salesPerformance, runStatement, type StatementEntry } from './salesPerformance'

const NOW_SQL = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

/** Trailing monthly invoiced revenue joined with sales_targets → engine. */
export async function performanceData(months = 12) {
  const now = new Date().toISOString().slice(0, 7)
  // Trailing window of month keys ending this month (matches the treasury window).
  const keys: string[] = [now]
  while (keys.length < months) {
    const [y, m] = keys[0].split('-').map(Number)
    keys.unshift(m <= 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`)
  }
  const rows = (await pgQuery(
    `SELECT substr(date,1,7) AS month, COALESCE(SUM(total),0)::float AS invoiced
     FROM sales_documents WHERE doc_type='invoice' AND status<>'void' AND substr(date,1,7)>=$1
     GROUP BY substr(date,1,7)`, [keys[0]])) as { month: string; invoiced: number }[]
  const byMonth = new Map(rows.map(r => [r.month, r.invoiced]))
  const sales = keys.map(k => ({ month: k, invoiced: Number(byMonth.get(k) ?? 0) }))
  const targets = (await pgQuery(
    `SELECT period, target::float AS target, commission_pct::float AS "commissionPct" FROM sales_targets`)) as
    { period: string; target: number; commissionPct: number }[]
  return salesPerformance(sales, targets)
}

/** Upsert the monthly target + commission rate (period = YYYY-MM). */
export async function setTarget(period: string, target: number, commissionPct: number, userId?: string) {
  await pgQuery(
    `INSERT INTO sales_targets (period, target, commission_pct, created_by, created_at)
     VALUES ($1,$2,$3,$4,${NOW_SQL})
     ON CONFLICT (period) DO UPDATE SET target=$2, commission_pct=$3`,
    [period, target, commissionPct, userId ?? null])
}

// ── Customer statement (Phase 26.4) ──────────────────────────────────────────
/** Full ledger for one customer: invoices/credit notes vs payments, running balance. */
export async function customerStatement(customerId: number) {
  const customer = (await pgQuery(
    `SELECT id, code, name, email, credit_limit::float AS "creditLimit" FROM sales_customers WHERE id=$1`, [customerId]))[0]
  if (!customer) return null
  const docs = (await pgQuery(
    `SELECT doc_type AS kind, doc_no AS ref, date, total::float AS total
     FROM sales_documents WHERE customer_id=$1 AND doc_type IN ('invoice','credit_note') AND status<>'void'`, [customerId])) as
    { kind: 'invoice' | 'credit_note'; ref: string; date: string; total: number }[]
  const pays = (await pgQuery(
    `SELECT id, date, amount::float AS amount, method, reference FROM sales_payments WHERE customer_id=$1`, [customerId])) as
    { id: number; date: string; amount: number; method: string; reference: string | null }[]
  const entries: StatementEntry[] = [
    ...docs.map(d => d.kind === 'invoice'
      ? { date: d.date, kind: 'invoice' as const, ref: d.ref, debit: d.total, credit: 0 }
      : { date: d.date, kind: 'credit_note' as const, ref: d.ref, debit: 0, credit: d.total }),
    ...pays.map(p => ({ date: p.date, kind: 'payment' as const, ref: p.reference || `${p.method.toUpperCase()}-${p.id}`, debit: 0, credit: p.amount })),
  ]
  return { customer, ...runStatement(entries) }
}
