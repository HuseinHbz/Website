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
       FROM sales_documents d JOIN sales_customers c ON c.id=d.customer_id ORDER BY d.created_at DESC LIMIT 12`, []),
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
