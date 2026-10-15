import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, badRequest, readJson, requirePermission, requireOp } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { clientIp } from '@/lib/api/clientIp'
import {
  requestGoods, listSupplyNotes, convertSupplyNoteToPurchase, requestCashPurchasePayment,
  createServiceRequest, listServiceRequests, createServiceInvoice,
} from '@/lib/erp/supplyFlowData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET ?view=supply-notes[&status=] | ?view=service-requests[&status=]
export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.purchasing', 'read')
  if ('error' in auth) return auth.error
  try {
    const sp = req.nextUrl.searchParams
    const view = sp.get('view') ?? 'supply-notes'
    if (view === 'supply-notes') return NextResponse.json({ notes: await listSupplyNotes(sp.get('status') ?? undefined) })
    if (view === 'service-requests') return NextResponse.json({ requests: await listServiceRequests(sp.get('status') ?? undefined) })
    return badRequest('Unknown view')
  } catch (e) { return apiError(e, 'Failed to load supply-flow data') }
}

const schema = z.discriminatedUnion('action', [
  // بند۳.۱ step 1-2 — Warehouse Keeper's one entry point: real-inventory
  // check → direct delivery (issue move) or raise a supply note.
  z.object({ action: z.literal('requestGoods'), productId: z.number().int().positive(), warehouseId: z.number().int().positive(), qty: z.number().positive() }),
  // بند۳.۱ step 3 — Procurement converts a note into the EXISTING chain.
  z.object({ action: z.literal('convertToPurchase'), noteId: z.number().int().positive(), vendorId: z.number().int().positive().optional() }),
  // بند۳.۲ steps 1-3 ONLY (مانعِ ۳.۲.۴ — see supplyFlowData.ts doc comment).
  z.object({ action: z.literal('requestCashPayment'), noteId: z.number().int().positive(), amount: z.number().positive(), title: z.string().min(1).max(200) }),
  // بند۳.۳ step 1
  z.object({ action: z.literal('createServiceRequest'), description: z.string().min(1).max(2000), vendorId: z.number().int().positive().optional() }),
  // بند۳.۳ step 2
  z.object({ action: z.literal('createServiceInvoice'), requestId: z.number().int().positive(), lines: z.array(z.object({ description: z.string().min(1).max(500), amount: z.number().positive() })).min(1) }),
])

export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.purchasing', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  const ip = clientIp(req)
  try {
    if (d.action === 'requestGoods') {
      // Warehouse Keeper's authority: write on erp.inventory (separate from
      // generic erp.purchasing write) — raising a note or delivering stock
      // both move physical inventory.
      const inv = await requirePermission('erp.inventory', 'write', 'edit')
      if ('error' in inv) return inv.error
      const r = await requestGoods({ productId: d.productId, warehouseId: d.warehouseId, qty: d.qty }, auth.user.id)
      await logAction(auth.user, 'supplyflow.requestGoods', 'inv_supply_notes', r.noteId, null, r, ip)
      return NextResponse.json(r)
    }
    if (d.action === 'convertToPurchase') {
      const r = await convertSupplyNoteToPurchase(d.noteId, d.vendorId, auth.user.id)
      await logAction(auth.user, 'supplyflow.convertToPurchase', 'purchase_documents', r.purchaseDocumentId, null, { noteId: d.noteId }, ip)
      return NextResponse.json(r)
    }
    if (d.action === 'requestCashPayment') {
      const deny = await requireOp(auth.user, 'erp.purchasing:request_payment', 'edit'); if (deny) return deny
      const r = await requestCashPurchasePayment(d.noteId, d.amount, d.title, auth.user.id)
      await logAction(auth.user, 'supplyflow.requestCashPayment', 'approval_requests', r.approvalRequestId, null, { noteId: d.noteId, amount: d.amount }, ip)
      return NextResponse.json(r)
    }
    if (d.action === 'createServiceRequest') {
      const r = await createServiceRequest({ description: d.description, vendorId: d.vendorId }, auth.user.id)
      await logAction(auth.user, 'supplyflow.createServiceRequest', 'erp_service_requests', r.id, null, { description: d.description }, ip)
      return NextResponse.json(r)
    }
    if (d.action === 'createServiceInvoice') {
      const r = await createServiceInvoice(d.requestId, d.lines, auth.user.id)
      await logAction(auth.user, 'supplyflow.createServiceInvoice', 'purchase_documents', r.purchaseDocumentId, null, { requestId: d.requestId }, ip)
      return NextResponse.json(r)
    }
    return badRequest('Unknown action')
  } catch (e) { return apiError(e, 'Failed to process supply-flow request') }
}
