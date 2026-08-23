import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, requirePermission } from '@/lib/api/respond'
import { pgQuery, withTransaction, type TxQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { canIssueDirect } from '@/lib/inventory/stockOps'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — the move ledger, optionally filtered by product (?productId=).
export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.inventory', 'read')
  if ('error' in auth) return auth.error
  try {
    const productId = Number(req.nextUrl.searchParams.get('productId')) || 0
    const rows = await pgQuery(
      `SELECT m.id, m.type, m.qty::float AS qty, m.unit_cost::float AS "unitCost", m.lot, m.serial, m.ref, m.note,
              m.created_at AS "createdAt", p.sku, p.name_en AS "productEn", p.name_fa AS "productFa",
              w.code AS "warehouse", w.name_en AS "warehouseEn"
       FROM inv_moves m JOIN inv_products p ON p.id=m.product_id JOIN inv_warehouses w ON w.id=m.warehouse_id
       ${productId ? 'WHERE m.product_id=$1' : ''}
       ORDER BY m.created_at DESC, m.id DESC LIMIT 200`,
      productId ? [productId] : [])
    return NextResponse.json({ moves: rows })
  } catch (e) { return apiError(e, 'Failed to load moves') }
}

const moveSchema = z.object({
  productId: z.number().int().positive(),
  type: z.enum(['receipt', 'issue', 'transfer', 'adjustment', 'return', 'count']),
  warehouseId: z.number().int().positive(),
  toWarehouseId: z.number().int().positive().optional(),   // transfers
  locationId: z.number().int().positive().optional(),
  qty: z.number().positive(),
  unitCost: z.number().min(0).default(0),
  lot: z.string().max(80).optional(),
  serial: z.string().max(120).optional(),
  ref: z.string().max(120).optional(),
  note: z.string().max(500).optional(),
})

/** Current on-hand for one product×warehouse, from the move ledger. */
async function onHandOf(query: TxQuery, productId: number, warehouseId: number): Promise<number> {
  const r = (await query<{ s: number }>(
    `SELECT COALESCE(SUM(qty),0)::float AS s FROM inv_moves WHERE product_id=$1 AND warehouse_id=$2`,
    [productId, warehouseId]))[0]
  return Number(r?.s ?? 0)
}

/**
 * POST — record a stock movement. Sign is derived from the type:
 *  receipt/return/count(+) add stock; issue subtract; adjustment can be ±;
 *  transfer writes TWO rows (issue from source, receipt into destination).
 *
 * Full-remediation RULE-012/RULE-013: both outbound legs (issue,
 * transfer-out) now run inside a REAL transaction (withTransaction — see
 * src/lib/db/index.ts), serialized per product×warehouse with a Postgres
 * advisory lock so two concurrent requests can't both read the same
 * on-hand and both pass the check (the classic race that produces
 * negative stock under load), and are BLOCKED (never silently written)
 * when the resulting on-hand would go negative. A transfer's two legs
 * either both commit or neither does — no more half-transfers on a
 * mid-write failure.
 */
export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.inventory', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, moveSchema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    const insertMove = (query: TxQuery, productId: number, warehouseId: number, type: string, qty: number, ref: string | null) =>
      query<{ id: number }>(
        `INSERT INTO inv_moves (product_id, warehouse_id, location_id, type, qty, unit_cost, lot, serial, ref, note, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [productId, warehouseId, d.locationId ?? null, type, qty, d.unitCost, d.lot ?? null, d.serial ?? null, ref, d.note ?? null, auth.user.id],
      )
    const lockProductWarehouse = (query: TxQuery, productId: number, warehouseId: number) =>
      query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`inv_move:${productId}:${warehouseId}`])

    if (d.type === 'transfer') {
      if (!d.toWarehouseId || d.toWarehouseId === d.warehouseId) return badRequest('Transfer needs a different destination warehouse')
      const ref = d.ref || `TR-${Date.now()}`
      const result = await withTransaction(async query => {
        await lockProductWarehouse(query, d.productId, d.warehouseId)
        const onHand = await onHandOf(query, d.productId, d.warehouseId)
        const check = canIssueDirect(onHand, d.qty)
        if (!check.ok) return { blocked: check.reason as string }
        await insertMove(query, d.productId, d.warehouseId, 'transfer', -d.qty, ref)      // out of source
        await insertMove(query, d.productId, d.toWarehouseId!, 'transfer', d.qty, ref)     // into destination — same tx, both or neither
        return { blocked: null }
      })
      if (result.blocked) return badRequest(result.blocked)
      await logAction(auth.user, 'inv.move.transfer', 'inv_product', d.productId, null, { qty: d.qty, from: d.warehouseId, to: d.toWarehouseId })
      return NextResponse.json({ ok: true })
    }

    // Single-row moves. Outbound types store negative qty.
    const outbound = d.type === 'issue'
    const signed = outbound ? -d.qty : d.qty
    const result = await withTransaction(async query => {
      if (outbound) {
        await lockProductWarehouse(query, d.productId, d.warehouseId)
        const onHand = await onHandOf(query, d.productId, d.warehouseId)
        const check = canIssueDirect(onHand, d.qty)
        if (!check.ok) return { id: null, blocked: check.reason as string }
      }
      const row = (await insertMove(query, d.productId, d.warehouseId, d.type, signed, d.ref ?? null))[0]
      return { id: row.id, blocked: null }
    })
    if (result.blocked) return badRequest(result.blocked)
    await logAction(auth.user, `inv.move.${d.type}`, 'inv_product', d.productId, null, { qty: signed })
    return NextResponse.json({ id: result.id })
  } catch (e) { return apiError(e, 'Failed to record movement') }
}
