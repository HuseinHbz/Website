/**
 * Customer 360 data layer (Phase 26.25 بند ۱). Aggregates a full customer view
 * from EXISTING tables (no parallel store): profile from sales_customers, orders
 * from sales_documents, payments from sales_payments + payment_transactions,
 * activities from crm_activities, source lead from crm_leads, tickets from
 * crm_tickets, and matching public requests from contact/consultation. Balance +
 * aging come from the pure engine over posted/open sales invoices.
 */
import { pgQuery } from '@/lib/db'
import { agingBuckets, creditDecision, type CreditGuardMode, type OpenInvoiceFact } from './aging'

const num = (v: unknown) => Number(v ?? 0)

/** Per-invoice outstanding (total − payments), with due date, for one customer. */
async function openInvoices(customerId: number): Promise<(OpenInvoiceFact & { docNo: string | null; total: number })[]> {
  const rows = await pgQuery<{ id: number; doc_no: string | null; total: number; due_date: string | null; date: string; paid: number }>(
    `SELECT d.id, d.doc_no, d.total::float AS total, d.due_date, d.date,
            COALESCE((SELECT SUM(amount) FROM sales_payments p WHERE p.document_id=d.id),0)::float AS paid
     FROM sales_documents d
     WHERE d.customer_id=$1 AND d.doc_type='invoice' AND d.status NOT IN ('void','draft') AND d.deleted_at IS NULL`,
    [customerId])
  return rows
    .map(r => ({ outstanding: Math.round((num(r.total) - num(r.paid)) * 100) / 100, dueDate: (r.due_date || r.date || '').slice(0, 10), docNo: r.doc_no, total: num(r.total) }))
    .filter(r => r.outstanding > 0.001)
}

/** Live AR balance = Σ outstanding on open invoices. */
export async function customerArBalance(customerId: number): Promise<number> {
  const open = await openInvoices(customerId)
  return Math.round(open.reduce((s, i) => s + i.outstanding, 0) * 100) / 100
}

export async function creditGuardMode(): Promise<CreditGuardMode> {
  const r = (await pgQuery<{ value: string }>(`SELECT value FROM erp_settings WHERE key='credit_guard_mode'`))[0]
  const v = r?.value as CreditGuardMode | undefined
  return v === 'off' || v === 'block' ? v : 'warn'
}

/**
 * Credit guard for a new sales amount on a customer (بند ۱.۳). Reads the
 * customer's limit + live balance + configured mode; returns the pure decision.
 */
export async function evaluateCredit(customerId: number, newAmount: number) {
  const c = (await pgQuery<{ credit_limit: number }>(`SELECT credit_limit::float AS credit_limit FROM sales_customers WHERE id=$1`, [customerId]))[0]
  const balance = await customerArBalance(customerId)
  return creditDecision({ creditLimit: num(c?.credit_limit), currentBalance: balance, newAmount, mode: await creditGuardMode() })
}

/** Full Customer 360 assembly. Each block is guarded so one failure never breaks the page. */
export async function customer360(customerId: number, asOf = new Date().toISOString().slice(0, 10)) {
  const customer = (await pgQuery<Record<string, unknown>>(
    `SELECT id, code, name, kind, email, phone, company, tax_id AS "taxId", national_id AS "nationalId",
            economic_code AS "economicCode", credit_limit::float AS "creditLimit", payment_terms AS "paymentTerms",
            address, active, created_at AS "createdAt"
     FROM sales_customers WHERE id=$1`, [customerId]))[0]
  if (!customer) return null
  const email = (customer.email as string) || ''
  const phone = (customer.phone as string) || ''

  const open = await openInvoices(customerId)
  const aging = agingBuckets(open, asOf)
  const balance = Math.round(open.reduce((s, i) => s + i.outstanding, 0) * 100) / 100

  const g = async (sql: string, p: unknown[]): Promise<Record<string, unknown>[]> => pgQuery<Record<string, unknown>>(sql, p).catch(() => [])

  const [orders, payments, gatewayTx, activities, tickets, sourceLead, contactReqs, consultReqs] = await Promise.all([
    g(`SELECT id, doc_no AS "docNo", doc_type AS "docType", date, status, total::float AS total, currency
        FROM sales_documents WHERE customer_id=$1 AND deleted_at IS NULL ORDER BY date DESC, id DESC LIMIT 100`, [customerId]),
    g(`SELECT id, date, amount::float AS amount, method, reference FROM sales_payments WHERE customer_id=$1 ORDER BY date DESC LIMIT 100`, [customerId]),
    g(`SELECT id, amount::float AS amount, status, ref_id AS "refId", created_at AS "createdAt" FROM payment_transactions WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 50`, [customerId]),
    g(`SELECT id, kind, subject, body, done, due_date AS "dueDate", created_at AS "createdAt" FROM crm_activities WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 100`, [customerId]),
    g(`SELECT id, ticket_no AS "ticketNo", subject, priority, status, created_at AS "createdAt" FROM crm_tickets WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 100`, [customerId]),
    g(`SELECT id, name, source, status, score, value::float AS value FROM crm_leads WHERE converted_customer_id=$1 LIMIT 5`, [customerId]),
    email || phone ? g(`SELECT id, name, email, phone, message, created_at AS "createdAt" FROM contact_requests WHERE ($1<>'' AND email=$1) OR ($2<>'' AND phone=$2) ORDER BY created_at DESC LIMIT 20`, [email, phone]) : Promise.resolve([]),
    email || phone ? g(`SELECT id, name, email, phone, created_at AS "createdAt" FROM consultation_requests WHERE ($1<>'' AND email=$1) OR ($2<>'' AND phone=$2) ORDER BY created_at DESC LIMIT 20`, [email, phone]) : Promise.resolve([]),
  ])

  // Unified, sortable timeline (بند ۱.۴).
  type TL = { at: string; type: string; label: string; ref?: string; amount?: number }
  const timeline: TL[] = [
    ...orders.map((o: Record<string, unknown>) => ({ at: String(o.date), type: 'order', label: String(o.docType), ref: String(o.docNo ?? ''), amount: num(o.total) })),
    ...payments.map((p: Record<string, unknown>) => ({ at: String(p.date), type: 'payment', label: String(p.method), ref: String(p.reference ?? ''), amount: num(p.amount) })),
    ...activities.map((a: Record<string, unknown>) => ({ at: String(a.createdAt).slice(0, 10), type: 'activity', label: String(a.kind), ref: String(a.subject ?? '') })),
    ...tickets.map((t: Record<string, unknown>) => ({ at: String(t.createdAt).slice(0, 10), type: 'ticket', label: String(t.status), ref: String(t.ticketNo ?? '') })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1))

  const purchaseTotal = Math.round(orders.filter((o: Record<string, unknown>) => o.docType === 'invoice' && o.status !== 'void').reduce((s: number, o: Record<string, unknown>) => s + num(o.total), 0) * 100) / 100

  return {
    customer, balance, aging,
    creditLimit: num(customer.creditLimit), paymentTerms: num(customer.paymentTerms),
    purchaseTotal, openInvoices: open,
    orders, payments, gatewayTx, activities, tickets, sourceLead, contactReqs, consultReqs, timeline,
  }
}
