import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, requirePermission } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { createReceipt, listReceipts } from '@/lib/treasury/paymentData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const auth = await requirePermission('erp.treasury', 'read'); if ('error' in auth) return auth.error
  try { return NextResponse.json({ receipts: await listReceipts() }) } catch (e) { return apiError(e, 'Failed to load receipts') }
}
const schema = z.object({ receiptType: z.enum(['customer_receipt','cash_receipt','card_receipt','foreign_receipt','advance_receipt']).optional(), customerId: z.number().int().positive().optional(), amount: z.number().positive(), currency: z.string().max(8).optional(), bankAccountId: z.number().int().positive().optional(), date: z.string().max(10).optional(), invoiceIds: z.array(z.number().int().positive()).max(100).optional() })
export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.treasury', 'write', 'edit'); if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema); if ('error' in parsed) return parsed.error
  try { const r = await createReceipt(parsed.data, auth.user.id); await logAction(auth.user, 'treasury.receipt.create', 'receipt_transactions', r.id, null, { amount: parsed.data.amount, advance: r.advance }); return NextResponse.json(r) }
  catch (e) { return apiError(e, 'Receipt failed') }
}
