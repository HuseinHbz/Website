import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, requirePermission } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { PAYMENT_TYPES } from '@/lib/treasury/payments'
import { createPayment, listPayments, submitPayment, processPayment, reversePayment } from '@/lib/treasury/paymentData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.treasury', 'read'); if ('error' in auth) return auth.error
  try { return NextResponse.json({ payments: await listPayments(req.nextUrl.searchParams.get('status') ?? undefined) }) } catch (e) { return apiError(e, 'Failed to load payments') }
}
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), paymentType: z.enum(PAYMENT_TYPES), party: z.string().max(200).optional(), partyRef: z.string().max(60).optional(), amount: z.number().positive(), currency: z.string().max(8).optional(), bankAccountId: z.number().int().positive().optional(), date: z.string().max(10).optional(), memo: z.string().max(400).optional() }),
  z.object({ action: z.literal('submit'), id: z.number().int().positive() }),
  z.object({ action: z.literal('process'), id: z.number().int().positive() }),
  z.object({ action: z.literal('reverse'), id: z.number().int().positive() }),
])
export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.treasury', 'write', 'edit'); if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema); if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    if (d.action === 'create') { const r = await createPayment(d, auth.user.id); await logAction(auth.user, 'treasury.payment.create', 'payment_orders', r.id, null, { type: d.paymentType, amount: d.amount }); return NextResponse.json(r) }
    if (d.action === 'submit') { const r = await submitPayment(d.id, auth.user.id); await logAction(auth.user, 'treasury.payment.submit', 'payment_orders', d.id, null, r); return NextResponse.json(r) }
    // process/reverse → GL posting requires finance/admin authority — reversal
    // is at least as sensitive as the original post (Phase 14), same guard.
    if (!['super_admin','administrator'].includes(auth.user.role)) return NextResponse.json({ error: `Only finance admins may ${d.action} payments` }, { status: 403 })
    if (d.action === 'reverse') { const r = await reversePayment(d.id, auth.user.id); await logAction(auth.user, 'treasury.payment.reverse', 'payment_orders', d.id, null, r); return NextResponse.json(r) }
    const r = await processPayment(d.id, auth.user); await logAction(auth.user, 'treasury.payment.process', 'payment_orders', d.id, null, r); return NextResponse.json(r)
  } catch (e) { return apiError(e, 'Payment operation failed') }
}
