/**
 * Portal data layer (Phase 26.25a بند ۲.۲/۲.۳). EVERY query is scoped to the
 * session's customerId — there is no code path that reads another customer's
 * data. Reuses the 26.25 AR aging engine + credit fields.
 */
import { pgQuery } from '@/lib/db'
import { agingBuckets, type OpenInvoiceFact } from '@/lib/crm/aging'

const num = (v: unknown) => Number(v ?? 0)

export async function portalDashboard(customerId: number) {
  const c = (await pgQuery<{ name: string; code: string; email: string | null; phone: string | null; credit_limit: number; payment_terms: number }>(
    `SELECT name, code, email, phone, credit_limit::float AS credit_limit, payment_terms FROM sales_customers WHERE id=$1`, [customerId]))[0]
  if (!c) return null
  const open = await pgQuery<{ total: number; due_date: string | null; date: string; paid: number }>(
    `SELECT d.total::float AS total, d.due_date, d.date,
            COALESCE((SELECT SUM(amount) FROM sales_payments p WHERE p.document_id=d.id),0)::float AS paid
     FROM sales_documents d WHERE d.customer_id=$1 AND d.doc_type='invoice' AND d.status NOT IN ('void','draft') AND d.deleted_at IS NULL`, [customerId])
  const facts: OpenInvoiceFact[] = open.map(r => ({ outstanding: num(r.total) - num(r.paid), dueDate: (r.due_date || r.date || '').slice(0, 10) })).filter(f => f.outstanding > 0.001)
  const balance = Math.round(facts.reduce((s, f) => s + f.outstanding, 0) * 100) / 100
  return {
    customer: { name: c.name, code: c.code, email: c.email, phone: c.phone },
    balance, aging: agingBuckets(facts, new Date().toISOString().slice(0, 10)),
    creditLimit: num(c.credit_limit), paymentTerms: num(c.payment_terms), openCount: facts.length,
  }
}

/** Own invoices only. */
export async function portalInvoices(customerId: number) {
  return pgQuery(
    `SELECT d.id, d.doc_no AS "docNo", d.date, d.due_date AS "dueDate", d.status, d.total::float AS total, d.currency,
            COALESCE((SELECT SUM(amount) FROM sales_payments p WHERE p.document_id=d.id),0)::float AS paid
     FROM sales_documents d WHERE d.customer_id=$1 AND d.doc_type='invoice' AND d.status NOT IN ('void','draft') AND d.deleted_at IS NULL
     ORDER BY d.date DESC, d.id DESC LIMIT 200`, [customerId])
}

/**
 * One invoice — ONLY if it belongs to the customer (IDOR guard: the WHERE clause
 * binds customer_id from the session). Returns null for a foreign/absent id.
 */
export async function portalInvoice(customerId: number, invoiceId: number) {
  const doc = (await pgQuery<Record<string, unknown>>(
    `SELECT d.id, d.doc_no AS "docNo", d.date, d.due_date AS "dueDate", d.status, d.subtotal::float AS subtotal,
            d.discount_total::float AS "discountTotal", d.tax_total::float AS "taxTotal", d.total::float AS total, d.currency
     FROM sales_documents d WHERE d.id=$1 AND d.customer_id=$2 AND d.doc_type='invoice' AND d.deleted_at IS NULL`, [invoiceId, customerId]))[0]
  if (!doc) return null
  const lines = await pgQuery(`SELECT description, qty::float AS qty, unit_price::float AS "unitPrice", line_total::float AS "lineTotal" FROM sales_document_lines WHERE document_id=$1 ORDER BY line_no, id`, [invoiceId])
  const paid = num((await pgQuery<{ p: number }>(`SELECT COALESCE(SUM(amount),0)::float AS p FROM sales_payments WHERE document_id=$1`, [invoiceId]))[0]?.p)
  return { doc, lines, paid, outstanding: Math.round((num(doc.total) - paid) * 100) / 100 }
}

/** Own payments only. */
export async function portalPayments(customerId: number) {
  return pgQuery(
    `SELECT p.id, p.date, p.amount::float AS amount, p.method, p.reference, d.doc_no AS "invoiceNo"
     FROM sales_payments p LEFT JOIN sales_documents d ON d.id=p.document_id
     WHERE p.customer_id=$1 ORDER BY p.date DESC, p.id DESC LIMIT 200`, [customerId])
}

/** Own communication channels + opt-in state. */
export async function portalChannels(customerId: number) {
  return pgQuery(`SELECT id, channel, address, opt_in AS "optIn" FROM crm_customer_channels WHERE customer_id=$1 ORDER BY channel`, [customerId])
}

/** Toggle a channel opt-in — only for a channel the customer owns. */
export async function setChannelOptIn(customerId: number, channelId: number, optIn: boolean): Promise<boolean> {
  const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
  const r = await pgQuery<{ id: number }>(
    `UPDATE crm_customer_channels SET opt_in=$3, opt_out_at=CASE WHEN $3=0 THEN ${NOW} ELSE NULL END, updated_at=${NOW}
     WHERE id=$1 AND customer_id=$2 RETURNING id`, [channelId, customerId, optIn ? 1 : 0])
  return r.length > 0
}
