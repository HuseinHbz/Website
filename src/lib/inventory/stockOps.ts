/**
 * Stock operations — pure engine (Phase 26.19, PARTS 2/3/6). Deterministic, no
 * DB. Owns the stock-state arithmetic (real / reserved / blocked / damaged /
 * in-transit / available), warehouse typing, the reservation + shipment state
 * machines, and EOQ. The costing engine stays in erp/inventory.ts (reused).
 */

export const WAREHOUSE_TYPES = ['standard', 'virtual', 'transit', 'damaged', 'reserved'] as const
export type WarehouseType = (typeof WAREHOUSE_TYPES)[number]

export const HOLD_KINDS = ['reserve', 'block', 'damage'] as const
export type HoldKind = (typeof HOLD_KINDS)[number]

export interface Hold { kind: HoldKind; qty: number; status: 'active' | 'released' | 'consumed' }

export interface StockState {
  onHand: number
  reserved: number
  blocked: number
  damaged: number
  inTransit: number
  available: number
}

/** Compute the stock-state breakdown for one product×warehouse. */
export function stockState(onHand: number, holds: Hold[], inTransit = 0): StockState {
  const sum = (k: HoldKind) => holds.filter(h => h.kind === k && h.status === 'active').reduce((s, h) => s + h.qty, 0)
  const reserved = sum('reserve')
  const blocked = sum('block')
  const damaged = sum('damage')
  return {
    onHand,
    reserved,
    blocked,
    damaged,
    inTransit,
    available: Math.max(0, onHand - reserved - blocked - damaged),
  }
}

/** A new hold is legal only when enough AVAILABLE stock remains to cover it. */
export function canHold(state: StockState, qty: number): { ok: boolean; reason?: string } {
  if (qty <= 0) return { ok: false, reason: 'Quantity must be positive' }
  if (qty > state.available) return { ok: false, reason: `Only ${state.available} available (on-hand ${state.onHand} − held ${state.reserved + state.blocked + state.damaged})` }
  return { ok: true }
}

// ── Shipment lifecycle (PART 6) ──────────────────────────────────────────────
export const SHIPMENT_STATUSES = ['draft', 'picking', 'packed', 'shipped', 'delivered', 'returned', 'cancelled'] as const
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number]

const SHIP_FLOW: Record<ShipmentStatus, ShipmentStatus[]> = {
  draft: ['picking', 'cancelled'],
  picking: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
  returned: [],
  cancelled: [],
}
export function canTransitionShipment(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return (SHIP_FLOW[from] ?? []).includes(to)
}
/** Stock leaves the warehouse exactly at the `shipped` transition. */
export function shipmentIssuesStock(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return from === 'packed' && to === 'shipped'
}
/** A return puts stock back. */
export function shipmentReturnsStock(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return (from === 'shipped' || from === 'delivered') && to === 'returned'
}

// ── Count lifecycle (PART 3/9 — approval reuse) ──────────────────────────────
export const COUNT_STATUSES = ['draft', 'counting', 'submitted', 'approved', 'posted', 'cancelled'] as const
export type CountStatus = (typeof COUNT_STATUSES)[number]
const COUNT_FLOW: Record<CountStatus, CountStatus[]> = {
  draft: ['counting', 'cancelled'],
  counting: ['submitted', 'cancelled'],
  submitted: ['approved', 'counting', 'cancelled'],
  approved: ['posted'],
  posted: [],
  cancelled: [],
}
export function canTransitionCount(from: CountStatus, to: CountStatus): boolean {
  return (COUNT_FLOW[from] ?? []).includes(to)
}

export interface CountLine { productId: number; systemQty: number; countedQty: number | null }
/** Variance rows (counted ≠ system) → the adjustment moves a posted count creates. */
export function countVariances(lines: CountLine[]): { productId: number; variance: number }[] {
  return lines
    .filter(l => l.countedQty != null && Math.abs(l.countedQty - l.systemQty) > 1e-9)
    .map(l => ({ productId: l.productId, variance: Math.round(((l.countedQty as number) - l.systemQty) * 1000) / 1000 }))
}

// ── EOQ (PART 3) ─────────────────────────────────────────────────────────────
/**
 * Economic Order Quantity: √(2 × annual demand × order cost / holding cost per
 * unit per year). Returns 0 when any input is non-positive.
 */
export function economicOrderQty(annualDemand: number, orderCost: number, holdingCostPerUnit: number): number {
  if (annualDemand <= 0 || orderCost <= 0 || holdingCostPerUnit <= 0) return 0
  return Math.round(Math.sqrt((2 * annualDemand * orderCost) / holdingCostPerUnit))
}

// ── Inventory value-adjustment GL lines (PART 5) ─────────────────────────────
import type { PostingLine } from '@/lib/erp/sales'
/**
 * Revaluation / count write-off posting: a positive delta raises inventory
 * (Dr 1200 / Cr 5000), a negative delta expenses shrinkage (Dr 5000 / Cr 1200).
 */
export function inventoryAdjustmentPostingLines(delta: number): PostingLine[] {
  const amt = Math.round(Math.abs(delta) * 100) / 100
  if (amt === 0) return []
  return delta > 0
    ? [
        { accountCode: '1200', debit: amt, credit: 0, memo: 'Inventory revaluation up' },
        { accountCode: '5000', debit: 0, credit: amt, memo: 'COGS relief' },
      ]
    : [
        { accountCode: '5000', debit: amt, credit: 0, memo: 'Inventory shrinkage/write-down' },
        { accountCode: '1200', debit: 0, credit: amt, memo: 'Inventory adjustment down' },
      ]
}
