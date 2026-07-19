import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson, badRequest } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { clientIp } from '@/lib/api/clientIp'
import {
  setWarehouseProfile, upsertLocation, warehouseLayout,
  registerBatch, listBatches, registerSerials, setSerialStatus, searchSerial, recallSerials,
  stockStateFor, createHold, releaseHold, listHolds,
  createCount, enterCount, transitionCount, postCount, listCounts, countDetail,
  createShipment, advanceShipment, listShipments,
  stockIntelligence, revalueInventory,
} from '@/lib/inventory/inventoryOpsData'
import { SERIAL_STATUSES } from '@/lib/inventory/serials'
import { WAREHOUSE_TYPES, SHIPMENT_STATUSES, COUNT_STATUSES } from '@/lib/inventory/stockOps'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — inventory ops views (Phase 26.19).
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const sp = req.nextUrl.searchParams
  try {
    const view = sp.get('view')
    if (view === 'intelligence') return NextResponse.json(await stockIntelligence())
    if (view === 'serial-search') {
      const q = (sp.get('q') ?? '').trim()
      if (q.length < 2) return NextResponse.json({ hits: [] })
      return NextResponse.json({ hits: await searchSerial(q) })
    }
    if (view === 'batches') return NextResponse.json({ batches: await listBatches() })
    if (view === 'holds') return NextResponse.json({ holds: await listHolds() })
    if (view === 'stock-state') {
      const productId = Number(sp.get('productId')), warehouseId = Number(sp.get('warehouseId'))
      if (!productId || !warehouseId) return badRequest('productId and warehouseId required')
      return NextResponse.json({ state: await stockStateFor(productId, warehouseId) })
    }
    if (view === 'counts') return NextResponse.json({ counts: await listCounts() })
    if (view === 'count-detail') {
      const id = Number(sp.get('id'))
      if (!id) return badRequest('id required')
      return NextResponse.json({ lines: await countDetail(id) })
    }
    if (view === 'shipments') return NextResponse.json({ shipments: await listShipments() })
    if (view === 'layout') {
      const id = Number(sp.get('warehouseId'))
      if (!id) return badRequest('warehouseId required')
      return NextResponse.json({ locations: await warehouseLayout(id) })
    }
    return badRequest('Unknown view')
  } catch (e) { return apiError(e, 'Failed to load inventory ops') }
}

const schema = z.object({
  action: z.enum([
    'warehouse.profile', 'location.upsert',
    'batch.register', 'serial.register', 'serial.status', 'serial.recall',
    'hold.create', 'hold.release',
    'count.create', 'count.enter', 'count.transition', 'count.post',
    'shipment.create', 'shipment.advance',
    'revalue',
  ]),
  payload: z.record(z.string(), z.unknown()).default({}),
})

const isAdmin = (role: string) => ['administrator', 'super_admin'].includes(role)

export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const { action } = parsed.data
  const p = parsed.data.payload as Record<string, never>
  const ip = clientIp(req)
  const uid = auth.user.id
  try {
    if (action === 'warehouse.profile') {
      const wtype = p.wtype ? String(p.wtype) : undefined
      if (wtype && !WAREHOUSE_TYPES.includes(wtype as never)) return badRequest('Unknown warehouse type')
      await setWarehouseProfile(Number(p.id), { wtype, capacity: p.capacity != null ? Number(p.capacity) : undefined, temperatureControlled: p.temperatureControlled as boolean | undefined })
      await logAction(auth.user, 'inv.warehouse.profile', 'inv_warehouse', Number(p.id), null, p, ip)
      return NextResponse.json({ ok: true })
    }
    if (action === 'location.upsert') {
      const r = await upsertLocation({ warehouseId: Number(p.warehouseId), code: String(p.code), zone: p.zone, aisle: p.aisle, rack: p.rack, shelf: p.shelf, bin: p.bin })
      await logAction(auth.user, 'inv.location.upsert', 'inv_location', r.id, null, p, ip)
      return NextResponse.json(r)
    }
    if (action === 'batch.register') {
      const r = await registerBatch({ productId: Number(p.productId), warehouseId: Number(p.warehouseId), batchNo: String(p.batchNo), qty: Number(p.qty), productionDate: p.productionDate, expiryDate: p.expiryDate, manufacturer: p.manufacturer }, uid)
      await logAction(auth.user, 'inv.batch.register', 'inv_batch', r.id, null, p, ip)
      return NextResponse.json(r)
    }
    if (action === 'serial.register') {
      const serials = (p.serials as { serial: string; imei?: string }[] | undefined) ?? []
      if (serials.length === 0 || serials.length > 500) return badRequest('1–500 serials per registration')
      const r = await registerSerials({ productId: Number(p.productId), warehouseId: Number(p.warehouseId), serials, batchId: p.batchId != null ? Number(p.batchId) : null, warrantyMonths: p.warrantyMonths != null ? Number(p.warrantyMonths) : null, ref: p.ref }, uid)
      await logAction(auth.user, 'inv.serial.register', 'inv_serial', Number(p.productId), null, { count: r.registered }, ip)
      return NextResponse.json(r)
    }
    if (action === 'serial.status') {
      const to = String(p.to)
      if (!SERIAL_STATUSES.includes(to as never)) return badRequest('Unknown serial status')
      await setSerialStatus(Number(p.id), to as never, p.note)
      await logAction(auth.user, 'inv.serial.status', 'inv_serial', Number(p.id), null, { to }, ip)
      return NextResponse.json({ ok: true })
    }
    if (action === 'serial.recall') {
      if (!isAdmin(auth.user.role)) return badRequest('Recall requires an administrator')
      const r = await recallSerials(Number(p.productId), p.batchId != null ? Number(p.batchId) : null)
      await logAction(auth.user, 'inv.serial.recall', 'inv_product', Number(p.productId), null, r, ip)
      return NextResponse.json(r)
    }
    if (action === 'hold.create') {
      const kind = String(p.kind)
      if (!['reserve', 'block', 'damage'].includes(kind)) return badRequest('Unknown hold kind')
      const r = await createHold({ productId: Number(p.productId), warehouseId: Number(p.warehouseId), kind: kind as never, qty: Number(p.qty), ref: p.ref }, uid)
      await logAction(auth.user, 'inv.hold.create', 'inv_reservation', r.id, null, p, ip)
      return NextResponse.json(r)
    }
    if (action === 'hold.release') {
      await releaseHold(Number(p.id))
      await logAction(auth.user, 'inv.hold.release', 'inv_reservation', Number(p.id), null, null, ip)
      return NextResponse.json({ ok: true })
    }
    if (action === 'count.create') {
      const r = await createCount(Number(p.warehouseId), uid)
      await logAction(auth.user, 'inv.count.create', 'inv_count', r.id, null, r, ip)
      return NextResponse.json(r)
    }
    if (action === 'count.enter') {
      await enterCount(Number(p.id), (p.entries as { productId: number; countedQty: number }[]) ?? [])
      await logAction(auth.user, 'inv.count.enter', 'inv_count', Number(p.id), null, { entries: (p.entries as unknown[])?.length ?? 0 }, ip)
      return NextResponse.json({ ok: true })
    }
    if (action === 'count.transition') {
      const to = String(p.to)
      if (!COUNT_STATUSES.includes(to as never)) return badRequest('Unknown count status')
      // Approval is an administrator act (reuses the RBAC approval gate pattern).
      if (to === 'approved' && !isAdmin(auth.user.role)) return badRequest('Count approval requires an administrator')
      await transitionCount(Number(p.id), to as never, uid)
      await logAction(auth.user, `inv.count.${to}`, 'inv_count', Number(p.id), null, null, ip)
      return NextResponse.json({ ok: true })
    }
    if (action === 'count.post') {
      if (!isAdmin(auth.user.role)) return badRequest('Posting a count requires an administrator')
      const r = await postCount(Number(p.id), uid)
      await logAction(auth.user, 'inv.count.post', 'inv_count', Number(p.id), null, r, ip)
      return NextResponse.json(r)
    }
    if (action === 'shipment.create') {
      const lines = (p.lines as { productId: number; qty: number; serial?: string }[] | undefined) ?? []
      const r = await createShipment({ warehouseId: Number(p.warehouseId), customerId: p.customerId != null ? Number(p.customerId) : null, carrier: p.carrier, ref: p.ref, lines }, uid)
      await logAction(auth.user, 'inv.shipment.create', 'inv_shipment', r.id, null, { lines: lines.length }, ip)
      return NextResponse.json(r)
    }
    if (action === 'shipment.advance') {
      const to = String(p.to)
      if (!SHIPMENT_STATUSES.includes(to as never)) return badRequest('Unknown shipment status')
      await advanceShipment(Number(p.id), to as never, { trackingNo: p.trackingNo, containerNo: p.containerNo }, uid)
      await logAction(auth.user, `inv.shipment.${to}`, 'inv_shipment', Number(p.id), null, { to }, ip)
      return NextResponse.json({ ok: true })
    }
    if (action === 'revalue') {
      if (!isAdmin(auth.user.role)) return badRequest('Revaluation requires an administrator')
      const r = await revalueInventory({ productId: Number(p.productId), warehouseId: Number(p.warehouseId), newUnitCost: Number(p.newUnitCost) }, uid)
      await logAction(auth.user, 'inv.revalue', 'inv_product', Number(p.productId), null, r, ip)
      return NextResponse.json(r)
    }
    return badRequest('Unknown action')
  } catch (e) { return apiError(e, 'Inventory operation failed') }
}
