/**
 * Inventory & Supply-Chain data layer (Phase 26.19). Persists the new
 * registries (serials/batches/holds/counts/shipments) over the EXISTING
 * `inv_moves` ledger and costing engine — never a second stock ledger. GL
 * postings reuse the shared posting primitives + the Numbering Engine.
 */
import { pgQuery, getPool } from '@/lib/db'
import { nextNumber } from '@/lib/numbering/integrate'
import { loadProductLevels } from '@/lib/erp/inventoryData'
import { postingBalanced } from '@/lib/erp/sales'
import {
  stockState, canHold, canTransitionShipment, shipmentIssuesStock, shipmentReturnsStock,
  canTransitionCount, countVariances, inventoryAdjustmentPostingLines, economicOrderQty,
  type Hold, type StockState, type ShipmentStatus, type CountStatus,
} from './stockOps'
import { canTransitionSerial, isValidImei, isValidSerial, warrantyStatus, batchDatesValid, type SerialStatus } from './serials'
import {
  abcAnalysis, xyzClass, movementClass, turnoverRatio, expiryStatus, nearExpiry,
  reorderSuggestions, intelligenceKpis, agingBucket,
  type ProductFact, type IntelligenceKpis, type AbcClass, type MovementClass, type XyzClass,
} from './intelligence'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const today = () => new Date().toISOString().slice(0, 10)

// ── Warehouse layout (PART 2) ────────────────────────────────────────────────
export async function setWarehouseProfile(id: number, d: { wtype?: string; capacity?: number; temperatureControlled?: boolean }): Promise<void> {
  await pgQuery(`UPDATE inv_warehouses SET wtype=COALESCE($2,wtype), capacity=COALESCE($3,capacity), temperature_controlled=COALESCE($4,temperature_controlled)
    WHERE id=$1`, [id, d.wtype ?? null, d.capacity ?? null, d.temperatureControlled == null ? null : d.temperatureControlled ? 1 : 0])
}
export async function upsertLocation(d: { warehouseId: number; code: string; zone?: string; aisle?: string; rack?: string; shelf?: string; bin?: string }): Promise<{ id: number }> {
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO inv_locations (warehouse_id, code, zone, aisle, rack, shelf, bin, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,1)
     ON CONFLICT (warehouse_id, code) DO UPDATE SET zone=EXCLUDED.zone, aisle=EXCLUDED.aisle, rack=EXCLUDED.rack, shelf=EXCLUDED.shelf, bin=EXCLUDED.bin, active=1
     RETURNING id`, [d.warehouseId, d.code, d.zone ?? null, d.aisle ?? null, d.rack ?? null, d.shelf ?? null, d.bin ?? null]))[0]
  return row
}
export async function warehouseLayout(warehouseId: number) {
  return pgQuery(
    `SELECT id, code, zone, aisle, rack, shelf, bin, active FROM inv_locations WHERE warehouse_id=$1 ORDER BY zone NULLS LAST, aisle NULLS LAST, code`, [warehouseId])
}

// ── Batches (PART 4) ─────────────────────────────────────────────────────────
export async function registerBatch(d: { productId: number; warehouseId: number; batchNo: string; qty: number; productionDate?: string | null; expiryDate?: string | null; manufacturer?: string | null }, userId?: string): Promise<{ id: number }> {
  if (!batchDatesValid({ batchNo: d.batchNo, productionDate: d.productionDate, expiryDate: d.expiryDate })) throw new Error('Production date must precede expiry date')
  if (d.qty <= 0) throw new Error('Batch quantity must be positive')
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO inv_batches (product_id, warehouse_id, batch_no, production_date, expiry_date, manufacturer, qty_received, qty_remaining, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$7,${NOW})
     ON CONFLICT (product_id, warehouse_id, batch_no)
     DO UPDATE SET qty_received=inv_batches.qty_received+EXCLUDED.qty_received, qty_remaining=inv_batches.qty_remaining+EXCLUDED.qty_received
     RETURNING id`, [d.productId, d.warehouseId, d.batchNo, d.productionDate ?? null, d.expiryDate ?? null, d.manufacturer ?? null, d.qty]))[0]
  // The batch receipt is a real stock movement on the existing ledger.
  await pgQuery(`INSERT INTO inv_moves (product_id, warehouse_id, type, qty, unit_cost, lot, ref, created_by, created_at)
    VALUES ($1,$2,'receipt',$3,(SELECT cost FROM inv_products WHERE id=$1),$4,$5,$6,${NOW})`,
    [d.productId, d.warehouseId, d.qty, d.batchNo, `Batch ${d.batchNo}`, userId ?? null])
  return row
}
export interface BatchRow { id: number; productId: number; sku: string; nameEn: string; warehouseId: number; batchNo: string; productionDate: string | null; expiryDate: string | null; manufacturer: string | null; qtyRemaining: number; expiry: string }
export async function listBatches(): Promise<BatchRow[]> {
  const rows = await pgQuery<Omit<BatchRow, 'expiry'>>(
    `SELECT b.id, b.product_id AS "productId", p.sku, p.name_en AS "nameEn", b.warehouse_id AS "warehouseId", b.batch_no AS "batchNo",
            b.production_date AS "productionDate", b.expiry_date AS "expiryDate", b.manufacturer, b.qty_remaining::float AS "qtyRemaining"
     FROM inv_batches b JOIN inv_products p ON p.id=b.product_id ORDER BY b.expiry_date NULLS LAST, b.id DESC LIMIT 500`)
  const t = today()
  return rows.map(r => ({ ...r, expiry: expiryStatus(r.expiryDate, t) }))
}

// ── Serials / IMEI (PART 4) ──────────────────────────────────────────────────
export async function registerSerials(d: { productId: number; warehouseId: number; serials: { serial: string; imei?: string | null }[]; batchId?: number | null; warrantyMonths?: number | null; ref?: string }, userId?: string): Promise<{ registered: number }> {
  let registered = 0
  for (const s of d.serials) {
    if (!isValidSerial(s.serial)) throw new Error(`Invalid serial "${s.serial}"`)
    if (s.imei && !isValidImei(s.imei)) throw new Error(`Invalid IMEI "${s.imei}" (Luhn check failed)`)
    await pgQuery(
      `INSERT INTO inv_serials (product_id, warehouse_id, batch_id, serial, imei, status, warranty_start, warranty_months, ref, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'in_stock',$6,$7,$8,${NOW},${NOW})`,
      [d.productId, d.warehouseId, d.batchId ?? null, s.serial.trim(), s.imei?.trim() ?? null, today(), d.warrantyMonths ?? null, d.ref ?? null])
    registered++
  }
  // One receipt move for the registered units (serial units are single pieces).
  await pgQuery(`INSERT INTO inv_moves (product_id, warehouse_id, type, qty, unit_cost, serial, ref, created_by, created_at)
    VALUES ($1,$2,'receipt',$3,(SELECT cost FROM inv_products WHERE id=$1),$4,$5,$6,${NOW})`,
    [d.productId, d.warehouseId, registered, d.serials.map(s => s.serial).join(','), d.ref ?? 'Serial receipt', userId ?? null])
  return { registered }
}

export async function setSerialStatus(id: number, to: SerialStatus, note?: string): Promise<void> {
  const cur = (await pgQuery<{ status: SerialStatus }>(`SELECT status FROM inv_serials WHERE id=$1`, [id]))[0]
  if (!cur) throw new Error('Serial not found')
  if (!canTransitionSerial(cur.status, to)) throw new Error(`Illegal serial transition ${cur.status} → ${to}`)
  await pgQuery(`UPDATE inv_serials SET status=$2, note=COALESCE($3,note), updated_at=${NOW} WHERE id=$1`, [id, to, note ?? null])
}

export interface SerialHit { id: number; serial: string; imei: string | null; status: SerialStatus; sku: string; nameEn: string; warehouseId: number; batchNo: string | null; warranty: string; createdAt: string; history: { type: string; qty: number; ref: string | null; createdAt: string }[] }
/** Search by serial OR IMEI (exact-or-prefix) with full move traceability. */
export async function searchSerial(q: string): Promise<SerialHit[]> {
  const term = `${q.trim()}%`
  const rows = await pgQuery<Omit<SerialHit, 'warranty' | 'history'> & { warranty_start: string | null; warranty_months: number | null }>(
    `SELECT s.id, s.serial, s.imei, s.status, p.sku, p.name_en AS "nameEn", s.warehouse_id AS "warehouseId",
            b.batch_no AS "batchNo", s.warranty_start, s.warranty_months, s.created_at AS "createdAt"
     FROM inv_serials s JOIN inv_products p ON p.id=s.product_id LEFT JOIN inv_batches b ON b.id=s.batch_id
     WHERE s.serial ILIKE $1 OR s.imei LIKE $1 ORDER BY s.id DESC LIMIT 25`, [term])
  const out: SerialHit[] = []
  for (const r of rows) {
    const history = await pgQuery<{ type: string; qty: number; ref: string | null; createdAt: string }>(
      `SELECT type, qty::float AS qty, ref, created_at AS "createdAt" FROM inv_moves WHERE serial ILIKE '%' || $1 || '%' ORDER BY id DESC LIMIT 20`, [r.serial])
    out.push({ ...r, warranty: warrantyStatus(r.warranty_start, r.warranty_months, today()), history })
  }
  return out
}

/** Recall every recallable serial of a product (optionally one batch). */
export async function recallSerials(productId: number, batchId?: number | null): Promise<{ recalled: number }> {
  const rows = await pgQuery<{ id: number }>(
    `UPDATE inv_serials SET status='recalled', updated_at=${NOW}
     WHERE product_id=$1 AND ($2::int IS NULL OR batch_id=$2) AND status IN ('in_stock','sold','returned','damaged') RETURNING id`,
    [productId, batchId ?? null])
  return { recalled: rows.length }
}

// ── Stock states + holds (PART 3) ────────────────────────────────────────────
async function onHandOf(productId: number, warehouseId: number): Promise<number> {
  return (await pgQuery<{ q: number }>(`SELECT COALESCE(SUM(qty),0)::float AS q FROM inv_moves WHERE product_id=$1 AND warehouse_id=$2`, [productId, warehouseId]))[0].q
}
async function holdsOf(productId: number, warehouseId: number): Promise<Hold[]> {
  return pgQuery<Hold>(`SELECT kind, qty::float AS qty, status FROM inv_reservations WHERE product_id=$1 AND warehouse_id=$2`, [productId, warehouseId])
}
async function inTransitOf(productId: number, warehouseId: number): Promise<number> {
  return (await pgQuery<{ q: number }>(
    `SELECT COALESCE(SUM(l.qty),0)::float AS q FROM inv_shipment_lines l JOIN inv_shipments s ON s.id=l.shipment_id
     WHERE l.product_id=$1 AND s.warehouse_id=$2 AND s.status IN ('picking','packed')`, [productId, warehouseId]))[0].q
}
export async function stockStateFor(productId: number, warehouseId: number): Promise<StockState> {
  const [onHand, holds, transit] = await Promise.all([onHandOf(productId, warehouseId), holdsOf(productId, warehouseId), inTransitOf(productId, warehouseId)])
  return stockState(onHand, holds, transit)
}
export async function createHold(d: { productId: number; warehouseId: number; kind: 'reserve' | 'block' | 'damage'; qty: number; ref?: string }, userId?: string): Promise<{ id: number }> {
  const state = await stockStateFor(d.productId, d.warehouseId)
  const chk = canHold(state, d.qty)
  if (!chk.ok) throw new Error(chk.reason)
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO inv_reservations (product_id, warehouse_id, kind, qty, ref, status, created_by, created_at)
     VALUES ($1,$2,$3,$4,$5,'active',$6,${NOW}) RETURNING id`,
    [d.productId, d.warehouseId, d.kind, d.qty, d.ref ?? null, userId ?? null]))[0]
  return row
}
export async function releaseHold(id: number, consumed = false): Promise<void> {
  await pgQuery(`UPDATE inv_reservations SET status=$2, released_at=${NOW} WHERE id=$1 AND status='active'`, [id, consumed ? 'consumed' : 'released'])
}
export async function listHolds(): Promise<{ id: number; sku: string; nameEn: string; warehouseId: number; kind: string; qty: number; ref: string | null; status: string; createdAt: string }[]> {
  return pgQuery(
    `SELECT r.id, p.sku, p.name_en AS "nameEn", r.warehouse_id AS "warehouseId", r.kind, r.qty::float AS qty, r.ref, r.status, r.created_at AS "createdAt"
     FROM inv_reservations r JOIN inv_products p ON p.id=r.product_id ORDER BY r.id DESC LIMIT 300`) as never
}

// ── Cycle counting (PART 3/9) ────────────────────────────────────────────────
export async function createCount(warehouseId: number, userId?: string): Promise<{ id: number; lines: number }> {
  const count = (await pgQuery<{ id: number }>(
    `INSERT INTO inv_counts (warehouse_id, status, created_by, created_at, updated_at) VALUES ($1,'counting',$2,${NOW},${NOW}) RETURNING id`, [warehouseId, userId ?? null]))[0]
  // Snapshot live system stock for every product with movement in this warehouse.
  const stock = await pgQuery<{ product_id: number; qty: number; cost: number }>(
    `SELECT m.product_id, COALESCE(SUM(m.qty),0)::float AS qty, MAX(p.cost)::float AS cost
     FROM inv_moves m JOIN inv_products p ON p.id=m.product_id WHERE m.warehouse_id=$1 GROUP BY m.product_id HAVING COALESCE(SUM(m.qty),0) <> 0`, [warehouseId])
  for (const s of stock) {
    await pgQuery(`INSERT INTO inv_count_lines (count_id, product_id, system_qty, unit_cost) VALUES ($1,$2,$3,$4)`, [count.id, s.product_id, s.qty, s.cost ?? 0])
  }
  return { id: count.id, lines: stock.length }
}
export async function enterCount(countId: number, entries: { productId: number; countedQty: number }[]): Promise<void> {
  const c = (await pgQuery<{ status: CountStatus }>(`SELECT status FROM inv_counts WHERE id=$1`, [countId]))[0]
  if (!c || c.status !== 'counting') throw new Error('Count is not open for entry')
  for (const e of entries) {
    await pgQuery(`UPDATE inv_count_lines SET counted_qty=$3 WHERE count_id=$1 AND product_id=$2`, [countId, e.productId, e.countedQty])
  }
}
export async function transitionCount(countId: number, to: CountStatus, userId?: string): Promise<void> {
  const c = (await pgQuery<{ status: CountStatus }>(`SELECT status FROM inv_counts WHERE id=$1`, [countId]))[0]
  if (!c) throw new Error('Count not found')
  if (!canTransitionCount(c.status, to)) throw new Error(`Illegal count transition ${c.status} → ${to}`)
  await pgQuery(`UPDATE inv_counts SET status=$2, approved_by=CASE WHEN $2='approved' THEN $3 ELSE approved_by END, updated_at=${NOW} WHERE id=$1`, [countId, to, userId ?? null])
}
/** Post an approved count: adjustment moves per variance + one balanced GL entry. */
export async function postCount(countId: number, userId?: string): Promise<{ adjusted: number; valueDelta: number; glEntryId: number | null }> {
  const c = (await pgQuery<{ status: CountStatus; warehouse_id: number }>(`SELECT status, warehouse_id FROM inv_counts WHERE id=$1`, [countId]))[0]
  if (!c) throw new Error('Count not found')
  if (c.status !== 'approved') throw new Error('Only an approved count can be posted')
  const lines = await pgQuery<{ product_id: number; system_qty: number; counted_qty: number | null; unit_cost: number }>(
    `SELECT product_id, system_qty::float AS system_qty, counted_qty::float AS counted_qty, unit_cost::float AS unit_cost FROM inv_count_lines WHERE count_id=$1`, [countId])
  const variances = countVariances(lines.map(l => ({ productId: l.product_id, systemQty: l.system_qty, countedQty: l.counted_qty })))
  let valueDelta = 0
  for (const v of variances) {
    const cost = lines.find(l => l.product_id === v.productId)?.unit_cost ?? 0
    valueDelta += v.variance * cost
    await pgQuery(`INSERT INTO inv_moves (product_id, warehouse_id, type, qty, unit_cost, ref, created_by, created_at)
      VALUES ($1,$2,'count',$3,$4,$5,$6,${NOW})`,
      [v.productId, c.warehouse_id, v.variance, cost, `Cycle count #${countId}`, userId ?? null])
  }
  valueDelta = Math.round(valueDelta * 100) / 100
  let glEntryId: number | null = null
  if (valueDelta !== 0) {
    const glLines = inventoryAdjustmentPostingLines(valueDelta)
    if (!postingBalanced(glLines)) throw new Error('Adjustment does not balance')
    const codes = glLines.map(l => l.accountCode)
    const accs = await pgQuery<{ id: number; code: string }>(`SELECT id, code FROM gl_accounts WHERE code = ANY($1)`, [codes])
    const idOf = new Map(accs.map(a => [a.code, a.id]))
    for (const code of codes) if (!idOf.has(code)) throw new Error(`GL account ${code} missing`)
    const entryNo = await nextNumber('journal', { legacyPrefix: 'JV' })
    const entry = (await pgQuery<{ id: number }>(
      `INSERT INTO gl_journal_entries (entry_no, date, memo, reference, status, total, created_by, created_at, posted_at)
       VALUES ($1, to_char(now(),'YYYY-MM-DD'), $2, $3, 'posted', $4, $5, ${NOW}, ${NOW}) RETURNING id`,
      [entryNo, `Cycle count adjustment #${countId}`, `CNT-${countId}`, Math.abs(valueDelta), userId ?? null]))[0]
    let ln = 0
    for (const l of glLines) {
      await pgQuery(`INSERT INTO gl_journal_lines (entry_id, account_id, debit, credit, memo, line_no) VALUES ($1,$2,$3,$4,$5,$6)`,
        [entry.id, idOf.get(l.accountCode), l.debit, l.credit, l.memo, ln++])
    }
    glEntryId = entry.id
  }
  await pgQuery(`UPDATE inv_counts SET status='posted', gl_entry_id=$2, updated_at=${NOW} WHERE id=$1`, [countId, glEntryId])
  return { adjusted: variances.length, valueDelta, glEntryId }
}
export async function listCounts() {
  return pgQuery(
    `SELECT c.id, c.warehouse_id AS "warehouseId", w.name_en AS "warehouseName", c.status, c.gl_entry_id AS "glEntryId", c.created_at AS "createdAt",
            (SELECT COUNT(*)::int FROM inv_count_lines l WHERE l.count_id=c.id) AS lines,
            (SELECT COUNT(*)::int FROM inv_count_lines l WHERE l.count_id=c.id AND l.counted_qty IS NOT NULL AND l.counted_qty<>l.system_qty) AS variances
     FROM inv_counts c JOIN inv_warehouses w ON w.id=c.warehouse_id ORDER BY c.id DESC LIMIT 100`)
}
export async function countDetail(countId: number) {
  return pgQuery(
    `SELECT l.product_id AS "productId", p.sku, p.name_en AS "nameEn", l.system_qty::float AS "systemQty", l.counted_qty::float AS "countedQty", l.unit_cost::float AS "unitCost"
     FROM inv_count_lines l JOIN inv_products p ON p.id=l.product_id WHERE l.count_id=$1 ORDER BY p.sku`, [countId])
}

// ── Shipments (PART 6) ───────────────────────────────────────────────────────
export async function createShipment(d: { warehouseId: number; customerId?: number | null; carrier?: string; ref?: string; lines: { productId: number; qty: number; serial?: string | null }[] }, userId?: string): Promise<{ id: number; shipmentNo: string }> {
  if (d.lines.length === 0) throw new Error('A shipment needs at least one line')
  for (const l of d.lines) {
    const state = await stockStateFor(l.productId, d.warehouseId)
    const chk = canHold(state, l.qty)
    if (!chk.ok) throw new Error(`Product ${l.productId}: ${chk.reason}`)
  }
  const shipmentNo = await nextNumber('shipment', { legacyPrefix: 'SHP' })
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO inv_shipments (shipment_no, warehouse_id, customer_id, carrier, status, ref, created_by, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'draft',$5,$6,${NOW},${NOW}) RETURNING id`,
    [shipmentNo, d.warehouseId, d.customerId ?? null, d.carrier ?? null, d.ref ?? null, userId ?? null]))[0]
  for (const l of d.lines) {
    await pgQuery(`INSERT INTO inv_shipment_lines (shipment_id, product_id, qty, serial) VALUES ($1,$2,$3,$4)`, [row.id, l.productId, l.qty, l.serial ?? null])
    await createHold({ productId: l.productId, warehouseId: d.warehouseId, kind: 'reserve', qty: l.qty, ref: `SHP-${row.id}` }, userId)
  }
  return { id: row.id, shipmentNo }
}

export async function advanceShipment(id: number, to: ShipmentStatus, d: { trackingNo?: string; containerNo?: string } = {}, userId?: string): Promise<void> {
  const s = (await pgQuery<{ status: ShipmentStatus; warehouse_id: number }>(`SELECT status, warehouse_id FROM inv_shipments WHERE id=$1`, [id]))[0]
  if (!s) throw new Error('Shipment not found')
  if (!canTransitionShipment(s.status, to)) throw new Error(`Illegal shipment transition ${s.status} → ${to}`)
  const lines = await pgQuery<{ product_id: number; qty: number; serial: string | null }>(
    `SELECT product_id, qty::float AS qty, serial FROM inv_shipment_lines WHERE shipment_id=$1`, [id])

  if (shipmentIssuesStock(s.status, to)) {
    // Ship: consume the reserve holds and write real issue moves.
    await pgQuery(`UPDATE inv_reservations SET status='consumed', released_at=${NOW} WHERE ref=$1 AND status='active'`, [`SHP-${id}`])
    for (const l of lines) {
      await pgQuery(`INSERT INTO inv_moves (product_id, warehouse_id, type, qty, unit_cost, serial, ref, created_by, created_at)
        VALUES ($1,$2,'issue',$3,(SELECT cost FROM inv_products WHERE id=$1),$4,$5,$6,${NOW})`,
        [l.product_id, s.warehouse_id, -Math.abs(l.qty), l.serial, `SHP-${id}`, userId ?? null])
      if (l.serial) await pgQuery(`UPDATE inv_serials SET status='sold', updated_at=${NOW} WHERE serial=$1 AND status IN ('in_stock','reserved')`, [l.serial])
    }
  }
  if (shipmentReturnsStock(s.status, to)) {
    for (const l of lines) {
      await pgQuery(`INSERT INTO inv_moves (product_id, warehouse_id, type, qty, unit_cost, serial, ref, created_by, created_at)
        VALUES ($1,$2,'return',$3,(SELECT cost FROM inv_products WHERE id=$1),$4,$5,$6,${NOW})`,
        [l.product_id, s.warehouse_id, Math.abs(l.qty), l.serial, `SHP-${id}-RET`, userId ?? null])
      if (l.serial) await pgQuery(`UPDATE inv_serials SET status='returned', updated_at=${NOW} WHERE serial=$1 AND status='sold'`, [l.serial])
    }
  }
  if (to === 'cancelled') {
    await pgQuery(`UPDATE inv_reservations SET status='released', released_at=${NOW} WHERE ref=$1 AND status='active'`, [`SHP-${id}`])
  }
  await pgQuery(
    `UPDATE inv_shipments SET status=$2, tracking_no=COALESCE($3,tracking_no), container_no=COALESCE($4,container_no),
       shipped_at=CASE WHEN $2='shipped' THEN to_char(now(),'YYYY-MM-DD HH24:MI:SS') ELSE shipped_at END,
       delivered_at=CASE WHEN $2='delivered' THEN to_char(now(),'YYYY-MM-DD HH24:MI:SS') ELSE delivered_at END,
       updated_at=${NOW} WHERE id=$1`, [id, to, d.trackingNo ?? null, d.containerNo ?? null])
}
export async function listShipments() {
  return pgQuery(
    `SELECT s.id, s.shipment_no AS "shipmentNo", s.warehouse_id AS "warehouseId", w.name_en AS "warehouseName", s.carrier, s.tracking_no AS "trackingNo",
            s.status, s.created_at AS "createdAt", s.shipped_at AS "shippedAt",
            (SELECT COALESCE(SUM(qty),0)::float FROM inv_shipment_lines l WHERE l.shipment_id=s.id) AS qty
     FROM inv_shipments s JOIN inv_warehouses w ON w.id=s.warehouse_id ORDER BY s.id DESC LIMIT 200`)
}

// ── Intelligence (PART 8) ────────────────────────────────────────────────────
export interface IntelligenceRow {
  id: number; sku: string; name: string; onHand: number; value: number
  abc: AbcClass; xyz: XyzClass; movement: MovementClass; turnover: number
  belowReorder: boolean; aging: string; eoq: number
}
export interface IntelligencePayload {
  kpis: IntelligenceKpis
  rows: IntelligenceRow[]
  reorder: ReturnType<typeof reorderSuggestions>
  nearExpiry: { id: number; sku: string; batchNo: string; expiryDate: string | null; qtyRemaining: number }[]
}
export async function stockIntelligence(): Promise<IntelligencePayload> {
  const levels = await loadProductLevels()
  const issues = await pgQuery<{ product_id: number; month: string; qty: number }>(
    `SELECT product_id, to_char(created_at::timestamp, 'YYYY-MM') AS month, COALESCE(SUM(ABS(qty)),0)::float AS qty
     FROM inv_moves WHERE qty < 0 AND created_at::timestamp > now() - interval '12 months' GROUP BY product_id, month`)
  const lastMoves = await pgQuery<{ product_id: number; days: number }>(
    `SELECT product_id, EXTRACT(EPOCH FROM (now() - MAX(created_at::timestamp)))/86400 AS days FROM inv_moves GROUP BY product_id`)
  const lastReceipt = await pgQuery<{ product_id: number; days: number }>(
    `SELECT product_id, EXTRACT(EPOCH FROM (now() - MAX(created_at::timestamp)))/86400 AS days FROM inv_moves WHERE qty > 0 GROUP BY product_id`)
  const lastOf = new Map(lastMoves.map(r => [r.product_id, Math.floor(Number(r.days))]))
  const receiptOf = new Map(lastReceipt.map(r => [r.product_id, Math.floor(Number(r.days))]))
  const monthly = new Map<number, number[]>()
  for (const r of issues) {
    const arr = monthly.get(r.product_id) ?? []
    arr.push(r.qty)
    monthly.set(r.product_id, arr)
  }
  const facts: ProductFact[] = levels.map(p => ({
    id: p.id, sku: p.sku, name: p.nameEn, onHand: p.onHand, value: p.value,
    annualIssueQty: (monthly.get(p.id) ?? []).reduce((s, v) => s + v, 0),
    monthlyIssues: monthly.get(p.id) ?? [],
    lastMoveDaysAgo: lastOf.get(p.id) ?? null,
    reorderPoint: p.reorderPoint ?? 0, safetyStock: p.safetyStock ?? 0, maxStock: p.maxStock ?? 0,
  }))
  const abc = abcAnalysis(facts.map(f => ({ id: f.id, value: f.value })))
  const rows: IntelligenceRow[] = facts.map(f => ({
    id: f.id, sku: f.sku, name: f.name, onHand: f.onHand, value: f.value,
    abc: abc.get(f.id) ?? 'C',
    xyz: xyzClass(f.monthlyIssues),
    movement: movementClass(f),
    turnover: turnoverRatio(f.annualIssueQty, Math.max(f.onHand, 1)),
    belowReorder: f.reorderPoint > 0 && f.onHand <= f.reorderPoint,
    aging: agingBucket(receiptOf.get(f.id) ?? 9999),
    eoq: economicOrderQty(f.annualIssueQty, 50, Math.max(1, f.value / Math.max(f.onHand, 1) * 0.2)),
  }))
  const batches = await pgQuery<{ id: number; sku: string; batch_no: string; expiry_date: string | null; qty_remaining: number }>(
    `SELECT b.id, p.sku, b.batch_no, b.expiry_date, b.qty_remaining::float AS qty_remaining FROM inv_batches b JOIN inv_products p ON p.id=b.product_id`)
  const near = nearExpiry(batches.map(b => ({ id: b.id, expiryDate: b.expiry_date, qtyRemaining: b.qty_remaining })), today())
  const nearRows = near.map(n => {
    const b = batches.find(x => x.id === n.id)!
    return { id: b.id, sku: b.sku, batchNo: b.batch_no, expiryDate: b.expiry_date, qtyRemaining: b.qty_remaining }
  })
  const reorder = reorderSuggestions(facts, f => rows.find(r => r.id === f.id)?.eoq ?? 0)
  return {
    kpis: intelligenceKpis(rows.map(r => ({ value: r.value, abc: r.abc, movement: r.movement, belowReorder: r.belowReorder, turnover: r.turnover })), nearRows.length),
    rows, reorder, nearExpiry: nearRows,
  }
}

// ── Explicit revaluation (PART 5) ────────────────────────────────────────────
export async function revalueInventory(d: { productId: number; warehouseId: number; newUnitCost: number }, userId?: string): Promise<{ valueDelta: number; glEntryId: number | null }> {
  const onHand = await onHandOf(d.productId, d.warehouseId)
  const cur = (await pgQuery<{ cost: number }>(`SELECT cost::float AS cost FROM inv_products WHERE id=$1`, [d.productId]))[0]
  if (!cur) throw new Error('Product not found')
  const valueDelta = Math.round((d.newUnitCost - cur.cost) * onHand * 100) / 100
  await pgQuery(`UPDATE inv_products SET cost=$2, updated_at=${NOW} WHERE id=$1`, [d.productId, d.newUnitCost])
  let glEntryId: number | null = null
  if (valueDelta !== 0) {
    const glLines = inventoryAdjustmentPostingLines(valueDelta)
    const accs = await pgQuery<{ id: number; code: string }>(`SELECT id, code FROM gl_accounts WHERE code = ANY($1)`, [glLines.map(l => l.accountCode)])
    const idOf = new Map(accs.map(a => [a.code, a.id]))
    const entryNo = await nextNumber('journal', { legacyPrefix: 'JV' })
    const entry = (await pgQuery<{ id: number }>(
      `INSERT INTO gl_journal_entries (entry_no, date, memo, reference, status, total, created_by, created_at, posted_at)
       VALUES ($1, to_char(now(),'YYYY-MM-DD'), $2, $3, 'posted', $4, $5, ${NOW}, ${NOW}) RETURNING id`,
      [entryNo, `Inventory revaluation product #${d.productId}`, `REVAL-${d.productId}`, Math.abs(valueDelta), userId ?? null]))[0]
    let ln = 0
    for (const l of glLines) {
      await pgQuery(`INSERT INTO gl_journal_lines (entry_id, account_id, debit, credit, memo, line_no) VALUES ($1,$2,$3,$4,$5,$6)`,
        [entry.id, idOf.get(l.accountCode), l.debit, l.credit, l.memo, ln++])
    }
    glEntryId = entry.id
  }
  return { valueDelta, glEntryId }
}
