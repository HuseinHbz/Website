/**
 * Sales ↔ Inventory ↔ Fulfillment (Phase 6). Audit found ZERO structural
 * link between `sales_documents` and the inventory module (`inv_moves`/
 * `inv_reservations`/`inv_shipments`) — this bridges them WITHOUT
 * duplicating either side's existing engine: reservation reuses
 * `createHold`/`inv_reservations` (Phase 26.19) tagged with a
 * `SO-{orderId}-{lineId}` ref, exactly like `inv_shipments` already tags
 * its own holds `SHP-{shipmentId}`.
 */
import { pgQuery, withTransaction, type TxQuery } from '@/lib/db'
import { createHold } from '@/lib/inventory/inventoryOpsData'
import { accountIdByCode, insertPostedEntry, loadGlMap } from './glPosting'
import { nextNumber } from '@/lib/numbering/integrate'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const today = () => new Date().toISOString().slice(0, 10)
const num = (v: unknown) => Number(v ?? 0)

export interface ReserveResult { ok: boolean; error?: string; lineId?: number }

/**
 * Reserve every product line of a sales ORDER against its fulfillment
 * warehouse. Must run inside the SAME transaction as the order's status
 * write (the route's existing confirm-transaction, mirroring the credit-
 * check precedent) so a rejected line rolls back the confirm itself —
 * no partial reservation, no confirmed-but-unreserved order.
 * Lines with no linked product (services) are skipped — nothing to
 * physically reserve, not an error.
 */
export async function reserveSalesOrderTx(query: TxQuery, orderId: number, warehouseId: number, userId?: string): Promise<ReserveResult> {
  const lines = await query<{ id: number; product_id: number | null; qty: number }>(
    `SELECT id, product_id, qty::float AS qty FROM sales_document_lines WHERE document_id=$1`, [orderId])
  for (const l of lines) {
    if (!l.product_id) continue
    try {
      await createHold({ productId: l.product_id, warehouseId, kind: 'reserve', qty: num(l.qty), ref: `SO-${orderId}-${l.id}` }, userId, query)
    } catch (e) {
      return { ok: false, error: `Product ${l.product_id} (line ${l.id}): ${e instanceof Error ? e.message : String(e)}`, lineId: l.id }
    }
  }
  return { ok: true }
}

/** Release every active reservation held against a sales order (cancel/void
 * before delivery). Idempotent — releasing an already-released order is a no-op. */
export async function releaseSalesOrderReservation(orderId: number): Promise<number> {
  const rows = await pgQuery<{ id: number }>(
    `UPDATE inv_reservations SET status='released', released_at=${NOW} WHERE ref LIKE $1 AND status='active' RETURNING id`, [`SO-${orderId}-%`])
  return rows.length
}

export interface DeliverResult { ok: boolean; error?: string; shipmentId?: number; cogsEntryId?: number }

/**
 * Deliver (ship) part or all of a confirmed sales order's reserved stock.
 * ONE self-contained transaction, serialized per order via
 * pg_advisory_xact_lock — the whole delivery (order-hold consumption,
 * shipment header+lines, real inv_moves issue rows, COGS posting) commits
 * together or not at all. Two concurrent deliver calls against the SAME
 * order correctly serialize: the second blocks until the first commits,
 * then re-reads the now-reduced reservation and is rejected if it would
 * exceed what remains.
 *
 * delivery_qty <= reserved_remaining is enforced directly against the
 * live `inv_reservations` row for that line (the reservation IS the
 * remaining-to-deliver ledger — no separate denormalized counter, so it
 * can never drift out of sync with it). A partial delivery shrinks the
 * existing hold (consume it, re-create the remainder) rather than
 * mutating its quantity in place, matching the append-only-ledger
 * discipline used everywhere else in this codebase (GL reversal, not
 * void; purchase line replace, not update).
 *
 * COGS: Dr 5000 (COGS) / Cr inventory (mapped account) for the delivered
 * lines' cost, idempotent per shipment via inv_shipments.gl_entry_id, and
 * — because this whole function is one transaction — atomically tied to
 * the SAME commit as the inventory issue moves: no inv_moves issue can
 * exist here without its COGS posting, and vice versa.
 */
export async function deliverSalesOrder(orderId: number, lines: { lineId: number; qty: number }[], userId?: string): Promise<DeliverResult> {
  if (lines.length === 0) return { ok: false, error: 'A delivery needs at least one line' }
  return withTransaction(async query => {
    await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`sales_order_delivery:${orderId}`])
    const order = (await query<{ status: string; warehouse_id: number | null; doc_type: string }>(
      `SELECT status, warehouse_id, doc_type FROM sales_documents WHERE id=$1`, [orderId]))[0]
    if (!order) return { ok: false, error: 'Order not found' }
    if (order.doc_type !== 'order') return { ok: false, error: 'Only a sales order can be delivered' }
    if (order.status !== 'confirmed') return { ok: false, error: 'Order must be confirmed before delivery' }
    if (!order.warehouse_id) return { ok: false, error: 'Order has no fulfillment warehouse set' }

    const shipmentNo = await nextNumber('shipment', { legacyPrefix: 'SHP' })
    const ship = (await query<{ id: number }>(
      `INSERT INTO inv_shipments (shipment_no, warehouse_id, sales_document_id, status, ref, created_by, created_at, updated_at, shipped_at)
       VALUES ($1,$2,$3,'shipped',$4,$5,${NOW},${NOW},${NOW}) RETURNING id`,
      [shipmentNo, order.warehouse_id, orderId, `SO-${orderId}`, userId ?? null]))[0]

    let cogsTotal = 0
    for (const l of lines) {
      if (l.qty <= 0) return { ok: false, error: `Line ${l.lineId}: quantity must be positive` }
      const line = (await query<{ product_id: number | null; cost: number | null }>(
        `SELECT sl.product_id, p.cost::float AS cost FROM sales_document_lines sl LEFT JOIN inv_products p ON p.id=sl.product_id WHERE sl.id=$1 AND sl.document_id=$2`,
        [l.lineId, orderId]))[0]
      if (!line || !line.product_id) return { ok: false, error: `Line ${l.lineId} has no linked inventory product — cannot deliver` }
      const ref = `SO-${orderId}-${l.lineId}`
      const hold = (await query<{ id: number; qty: number }>(
        `SELECT id, qty::float AS qty FROM inv_reservations WHERE ref=$1 AND status='active' ORDER BY id LIMIT 1`, [ref]))[0]
      if (!hold) return { ok: false, error: `Line ${l.lineId}: no active reservation — reserved_remaining is 0` }
      if (l.qty > hold.qty + 0.0001) return { ok: false, error: `Line ${l.lineId}: delivery qty ${l.qty} exceeds reserved_remaining ${hold.qty}` }

      await query(`UPDATE inv_reservations SET status='consumed', released_at=${NOW} WHERE id=$1`, [hold.id])
      const remainder = hold.qty - l.qty
      if (remainder > 0.0001) {
        await query(`INSERT INTO inv_reservations (product_id, warehouse_id, kind, qty, ref, status, created_by, created_at) VALUES ($1,$2,'reserve',$3,$4,'active',$5,${NOW})`,
          [line.product_id, order.warehouse_id, remainder, ref, userId ?? null])
      }
      const cost = num(line.cost)
      await query(`INSERT INTO inv_shipment_lines (shipment_id, product_id, qty) VALUES ($1,$2,$3)`, [ship.id, line.product_id, l.qty])
      await query(`INSERT INTO inv_moves (product_id, warehouse_id, type, qty, unit_cost, ref, created_by, created_at) VALUES ($1,$2,'issue',$3,$4,$5,$6,${NOW})`,
        [line.product_id, order.warehouse_id, -Math.abs(l.qty), cost, `SHP-${ship.id}`, userId ?? null])
      cogsTotal += Math.abs(l.qty) * cost
    }

    let cogsEntryId: number | undefined
    if (cogsTotal > 0) {
      const map = await loadGlMap()
      const [cogsAcc, invAcc] = await Promise.all([accountIdByCode('5000', query), accountIdByCode(map.inventory, query)])
      const entry = await insertPostedEntry(query, today(), `COGS — sales order ${orderId} delivery`, `SHP-COGS-${ship.id}`, cogsTotal, userId,
        [{ accountId: cogsAcc, debit: cogsTotal, credit: 0 }, { accountId: invAcc, debit: 0, credit: cogsTotal }])
      await query(`UPDATE inv_shipments SET gl_entry_id=$2 WHERE id=$1`, [ship.id, entry.id])
      cogsEntryId = entry.id
    }
    return { ok: true, shipmentId: ship.id, cogsEntryId }
  })
}

/** Live reserved/delivered snapshot for a sales order line, from real
 * inv_reservations/inv_moves rows — never a denormalized counter. */
export async function salesOrderLineFulfillment(orderId: number) {
  return pgQuery<{ lineId: number; productId: number | null; ordered: number; reserved: number; delivered: number }>(
    `SELECT sl.id AS "lineId", sl.product_id AS "productId", sl.qty::float AS ordered,
            COALESCE((SELECT SUM(r.qty) FROM inv_reservations r WHERE r.ref=CONCAT('SO-',$1::text,'-',sl.id::text) AND r.status='active'),0)::float AS reserved,
            COALESCE((SELECT SUM(shl.qty) FROM inv_shipment_lines shl JOIN inv_shipments sh ON sh.id=shl.shipment_id
                      WHERE sh.sales_document_id=$1 AND sh.status IN ('shipped','delivered') AND shl.product_id=sl.product_id),0)::float AS delivered
     FROM sales_document_lines sl WHERE sl.document_id=$1`, [orderId])
}
