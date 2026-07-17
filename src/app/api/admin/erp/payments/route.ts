import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { createPayment, verifyPayment } from '@/lib/erp/payments/paymentData'
import { SITE } from '@/lib/site'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — recent gateway transactions.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const rows = await pgQuery(
      `SELECT t.id, t.provider, t.amount::float AS amount, t.status, t.ref_id AS "refId",
              t.document_id AS "documentId", d.doc_no AS "docNo", t.created_at AS "createdAt"
       FROM payment_transactions t LEFT JOIN sales_documents d ON d.id=t.document_id
       ORDER BY t.id DESC LIMIT 100`)
    return NextResponse.json({ transactions: rows })
  } catch (e) { return apiError(e, 'Failed to load payments') }
}

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), provider: z.enum(['zarinpal', 'saman', 'mellat']).default('zarinpal'),
    documentId: z.number().int().positive(), mobile: z.string().max(20).optional() }),
  z.object({ action: z.literal('verify'), txId: z.number().int().positive() }),
])

// POST — create a gateway payment for a sales invoice → redirect URL, or verify.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    if (d.action === 'verify') {
      const res = await verifyPayment(d.txId, auth.user.id)
      await logAction(auth.user, 'payment.verify', 'payment_transactions', d.txId, null, res)
      return NextResponse.json(res)
    }
    const doc = (await pgQuery<{ total: number; paid: number; customer_id: number; doc_no: string }>(
      `SELECT d.total::float AS total, d.customer_id, d.doc_no,
              COALESCE((SELECT SUM(amount) FROM sales_payments p WHERE p.document_id=d.id),0)::float AS paid
       FROM sales_documents d WHERE d.id=$1 AND d.doc_type='invoice'`, [d.documentId]))[0]
    if (!doc) return NextResponse.json({ error: 'Invoice not found' }, { status: 400 })
    const due = Number(doc.total) - Number(doc.paid)
    if (due <= 0) return NextResponse.json({ error: 'Invoice already settled' }, { status: 400 })
    const res = await createPayment({
      provider: d.provider, documentId: d.documentId, customerId: doc.customer_id, amount: due,
      description: `پرداخت فاکتور ${doc.doc_no}`, callbackUrl: `${SITE.url}/api/pay/callback`, mobile: d.mobile,
    })
    await logAction(auth.user, 'payment.create', 'payment_transactions', res.txId ?? '', null, { provider: d.provider, amount: due })
    return NextResponse.json(res)
  } catch (e) { return apiError(e, 'Payment operation failed') }
}
