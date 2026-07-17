import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { readJson, badRequest } from '@/lib/api/respond'
import { requirePortal } from '@/lib/portal/guard'
import { portalInvoice } from '@/lib/portal/portalData'
import { createPayment } from '@/lib/erp/payments/paymentData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const schema = z.object({ invoiceId: z.number().int().positive() })

// POST — start an online payment for an OWN open invoice. Ownership is enforced
// via portalInvoice (binds session customer_id); a foreign id → 404. The gateway
// callback (/api/pay/callback, reused from 26.24) verifies server-side, reconciles
// to sales_payments and auto-posts the GL receipt (idempotent).
export async function POST(req: NextRequest) {
  const auth = await requirePortal(req)
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const inv = await portalInvoice(auth.identity.customerId, parsed.data.invoiceId)
  if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (inv.outstanding <= 0) return badRequest('Invoice is already settled')
  const origin = req.nextUrl.origin
  const r = await createPayment({
    provider: 'zarinpal', documentId: Number(inv.doc.id), customerId: auth.identity.customerId,
    amount: inv.outstanding, description: `Invoice ${inv.doc.docNo}`, callbackUrl: `${origin}/api/pay/callback`,
  })
  if (!r.ok) return NextResponse.json({ error: r.error ?? 'Payment init failed', txId: r.txId }, { status: 502 })
  return NextResponse.json({ ok: true, redirectUrl: r.redirectUrl, txId: r.txId })
}
