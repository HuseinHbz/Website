/**
 * Enterprise Inventory — domain logic (Phase 21 ERP, Module 4).
 *
 * Pure, deterministic functions for stock valuation and replenishment. No DB
 * access here, so every rule is unit-tested. The API layer reads the move
 * ledger and hands ordered rows to these functions; dashboards and reports reuse
 * the same code (one source of truth, no duplication).
 *
 * Valuation methods: FIFO, LIFO and weighted-average cost — the three standard
 * inventory costing methods. Each consumes an ordered list of stock moves and
 * returns on-hand quantity, remaining inventory value and cost-of-goods-sold.
 */

export const VALUATION_METHODS = ['fifo', 'lifo', 'wavg'] as const
export type ValuationMethod = (typeof VALUATION_METHODS)[number]

export const MOVE_TYPES = ['receipt', 'issue', 'transfer', 'adjustment', 'return', 'count'] as const
export type MoveType = (typeof MOVE_TYPES)[number]

/** A single stock movement, oldest-first when passed to valuation. */
export interface Move {
  type: MoveType
  /** Positive = stock in, negative = stock out. */
  qty: number
  /** Unit cost for inbound moves (receipt/return/positive adjustment). */
  unitCost: number
}

export interface Valuation {
  onHand: number
  /** Remaining inventory value at cost. */
  value: number
  /** Weighted-average unit cost of remaining stock (0 when empty). */
  avgCost: number
  /** Cumulative cost of goods issued. */
  cogs: number
}

function isInbound(m: Move): boolean {
  return m.qty > 0
}

/**
 * Value a product's stock from its ordered move history under the given method.
 * Inbound moves add a cost layer; outbound moves consume layers (FIFO/LIFO) or
 * draw down at the running average (WAVG). Outbound qty beyond stock is clamped.
 */
export function valuate(moves: Move[], method: ValuationMethod): Valuation {
  if (method === 'wavg') return valuateWavg(moves)
  return valuateLayers(moves, method)
}

function valuateWavg(moves: Move[]): Valuation {
  let onHand = 0
  let value = 0
  let cogs = 0
  for (const m of moves) {
    if (isInbound(m)) {
      onHand += m.qty
      value += m.qty * m.unitCost
    } else {
      const out = Math.min(-m.qty, onHand)
      const avg = onHand > 0 ? value / onHand : 0
      const cost = out * avg
      onHand -= out
      value -= cost
      cogs += cost
    }
  }
  return { onHand, value: round2(value), avgCost: onHand > 0 ? round2(value / onHand) : 0, cogs: round2(cogs) }
}

interface Layer { qty: number; unitCost: number }

function valuateLayers(moves: Move[], method: 'fifo' | 'lifo'): Valuation {
  const layers: Layer[] = []
  let cogs = 0
  for (const m of moves) {
    if (isInbound(m)) {
      layers.push({ qty: m.qty, unitCost: m.unitCost })
    } else {
      let out = -m.qty
      while (out > 0 && layers.length > 0) {
        // FIFO consumes the oldest layer (front); LIFO the newest (back).
        const idx = method === 'fifo' ? 0 : layers.length - 1
        const layer = layers[idx]
        const take = Math.min(out, layer.qty)
        cogs += take * layer.unitCost
        layer.qty -= take
        out -= take
        if (layer.qty === 0) layers.splice(idx, 1)
      }
    }
  }
  const onHand = layers.reduce((s, l) => s + l.qty, 0)
  const value = layers.reduce((s, l) => s + l.qty * l.unitCost, 0)
  return { onHand, value: round2(value), avgCost: onHand > 0 ? round2(value / onHand) : 0, cogs: round2(cogs) }
}

export type StockStatus = 'out' | 'below_safety' | 'reorder' | 'ok' | 'overstock'

export interface ReorderInput {
  onHand: number
  reorderPoint: number
  minStock: number
  maxStock: number
  safetyStock: number
}

/** Replenishment status of a product from on-hand vs its stocking policy. */
export function stockStatus(i: ReorderInput): StockStatus {
  if (i.onHand <= 0) return 'out'
  if (i.safetyStock > 0 && i.onHand < i.safetyStock) return 'below_safety'
  if (i.reorderPoint > 0 && i.onHand <= i.reorderPoint) return 'reorder'
  if (i.maxStock > 0 && i.onHand > i.maxStock) return 'overstock'
  return 'ok'
}

/** Suggested reorder quantity to bring stock up to max (0 if not needed). */
export function suggestedReorderQty(i: ReorderInput): number {
  const status = stockStatus(i)
  if (status === 'ok' || status === 'overstock') return 0
  const target = i.maxStock > 0 ? i.maxStock : Math.max(i.reorderPoint, i.minStock, i.safetyStock)
  return Math.max(0, target - i.onHand)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export interface InventoryKpis {
  totalProducts: number
  totalOnHand: number
  totalValue: number
  outOfStock: number
  needReorder: number
  overstock: number
}

/** Roll a set of per-product valuations + statuses into dashboard KPIs. */
export function inventoryKpis(rows: { onHand: number; value: number; status: StockStatus }[]): InventoryKpis {
  return {
    totalProducts: rows.length,
    totalOnHand: rows.reduce((s, r) => s + r.onHand, 0),
    totalValue: round2(rows.reduce((s, r) => s + r.value, 0)),
    outOfStock: rows.filter(r => r.status === 'out').length,
    needReorder: rows.filter(r => r.status === 'reorder' || r.status === 'below_safety').length,
    overstock: rows.filter(r => r.status === 'overstock').length,
  }
}
