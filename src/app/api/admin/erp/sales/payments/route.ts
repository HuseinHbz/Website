import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, requirePermission, requireOp } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { rialRateFor } from '@/lib/erp/currencyData'
import { logAction } from '@/lib/admin/audit'
import { invoiceStatus, validatePayment } from '@/lib/erp/sales'
import { postSalesPaymentToGl } from '@/lib/erp/glPosting'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — payments ledger (optionally for one customer ?customerId=).
export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.sales', 'read')
  if ('error' in auth) return auth.error
  try {
    const cid = Number(req.nextUrl.searchParams.get('customerId')) || 0
    const rows = await pgQuery(
      `SELECT p.id, p.date, p.amount::float AS amount, p.method, p.reference, p.note,
              c.name AS "customer", d.doc_no AS "docNo"
       FROM sales_payments p JOIN sales_customers c ON c.id=p.customer_id
       LEFT JOIN sales_documents d ON d.id=p.document_id
       ${cid ? 'WHERE p.customer_id=$1' : ''}
       ORDER BY p.date DESC, p.id DESC LIMIT 200`, cid ? [cid] : [])
    return NextResponse.json({ payments: rows })
  } catch (e) { return apiError(e, 'Failed to load payments') }
}

const schema = z.object({
  customerId: z.number().int().positive(),
  documentId: z.number().int().positive().optional(),
  date: z.string().min(1).max(30),
  amount: z.number().positive(),
  method: z.enum(['cash', 'bank', 'card', 'cheque', 'gateway', 'other']).default('cash'),
  reference: z.string().max(120).optional(),
  note: z.string().max(500).optional(),
  currency: z.enum(['IRR', 'IRT', 'USD', 'EUR']).default('IRR'),
})

// POST — record a payment. If it targets an invoice, recompute its paid status.
export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.sales', 'write', 'edit')
  if ('error' in auth) return auth.error
  { const deny = await requireOp(auth.user, 'erp.sales:payment_create', 'edit'); if (deny) return deny }
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    // 26.26 بند ۲ (CFO hunt): guard payments against a void/draft invoice and
    // block overpayment beyond the invoice total (would silently create a negative
    // AR / unmanaged customer credit). Only checked when the payment targets a doc.
    if (d.documentId) {
      const inv = (await pgQuery(`SELECT total::float AS total, status, doc_type AS "docType" FROM sales_documents WHERE id=$1`, [d.documentId]))[0] as { total: number; status: string; docType: string } | undefined
      if (inv?.docType === 'invoice') {
        const already = (await pgQuery(`SELECT COALESCE(SUM(amount),0)::float AS s FROM sales_payments WHERE document_id=$1`, [d.documentId]))[0] as { s: number }
        const v = validatePayment({ status: inv.status, invoiceTotal: Number(inv.total), alreadyPaid: Number(already.s), amount: d.amount })
        if (!v.ok) return badRequest(v.error === 'cannot pay a void/draft invoice' ? 'Cannot record a payment against a void/draft invoice' : `Overpayment: invoice total ${inv.total}, already paid ${already.s}, this ${d.amount}`)
      }
    }
    const rate = (await rialRateFor(d.currency)) ?? 1
    const row = (await pgQuery(
      `INSERT INTO sales_payments (customer_id, document_id, date, amount, method, reference, note, created_by, currency, exchange_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [d.customerId, d.documentId ?? null, d.date, d.amount, d.method, d.reference ?? null, d.note ?? null, auth.user.id, d.currency, rate]))[0] as { id: number }

    if (d.documentId) {
      const doc = (await pgQuery(`SELECT total::float AS total, doc_type AS "docType" FROM sales_documents WHERE id=$1`, [d.documentId]))[0] as { total: number; docType: string } | undefined
      if (doc?.docType === 'invoice') {
        const paid = (await pgQuery(`SELECT COALESCE(SUM(amount),0)::float AS paid FROM sales_payments WHERE document_id=$1`, [d.documentId]))[0] as { paid: number }
        await pgQuery(`UPDATE sales_documents SET status=$2, updated_at=to_char(now(),'YYYY-MM-DD HH24:MI:SS') WHERE id=$1`, [d.documentId, invoiceStatus(doc.total, paid.paid)])
      }
    }
    // 26.23 (بند ۱.۱): every customer receipt books Dr Bank / Cr AR (idempotent;
    // a closed period leaves the payment recorded — self-heal can post later).
    let entryId: number | null = null
    try { entryId = (await postSalesPaymentToGl(row.id, auth.user.id)).entryId } catch { /* stays unposted */ }
    await logAction(auth.user, 'sales.payment.create', 'sales_payment', row.id, null, { amount: d.amount, entryId })
    return NextResponse.json({ id: row.id, entryId })
  } catch (e) { return apiError(e, 'Failed to record payment') }
}
