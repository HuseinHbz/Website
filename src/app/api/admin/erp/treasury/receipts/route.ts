import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, requirePermission } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { createReceipt, reverseCustomerReceipt, listReceipts } from '@/lib/treasury/paymentData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const auth = await requirePermission('erp.treasury', 'read'); if ('error' in auth) return auth.error
  try { return NextResponse.json({ receipts: await listReceipts() }) } catch (e) { return apiError(e, 'Failed to load receipts') }
}
// action defaults to 'create' when absent — preserves every existing caller's
// exact request shape unchanged; 'reverse' is the only new, explicit branch
// (Phase 16, the AR-side mirror of the Treasury payments route's 'reverse').
const schema = z.preprocess(
  (v) => (v && typeof v === 'object' && !('action' in v) ? { ...v, action: 'create' } : v),
  z.discriminatedUnion('action', [
    z.object({ action: z.literal('create'), receiptType: z.enum(['customer_receipt','cash_receipt','card_receipt','foreign_receipt','advance_receipt']).optional(), customerId: z.number().int().positive().optional(), amount: z.number().positive(), currency: z.string().max(8).optional(), bankAccountId: z.number().int().positive().optional(), date: z.string().max(10).optional(), invoiceIds: z.array(z.number().int().positive()).max(100).optional() }),
    z.object({ action: z.literal('reverse'), id: z.number().int().positive() }),
  ]),
)
export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.treasury', 'write', 'edit'); if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema); if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    if (d.action === 'reverse') {
      // Reversal is at least as sensitive as the original post — same
      // finance-admin guard the Treasury payments route already requires
      // for its own 'reverse' action (Phase 14).
      if (!['super_admin','administrator'].includes(auth.user.role)) return NextResponse.json({ error: 'Only finance admins may reverse receipts' }, { status: 403 })
      const r = await reverseCustomerReceipt(d.id, auth.user.id)
      await logAction(auth.user, 'treasury.receipt.reverse', 'receipt_transactions', d.id, null, r)
      return NextResponse.json(r)
    }
    const r = await createReceipt(d, auth.user.id)
    await logAction(auth.user, 'treasury.receipt.create', 'receipt_transactions', r.id, null, { amount: d.amount, advance: r.advance })
    return NextResponse.json(r)
  } catch (e) { return apiError(e, 'Receipt operation failed') }
}
