import { describe, it, expect } from 'vitest'
import { valuate, stockStatus, suggestedReorderQty, inventoryKpis, type Move } from '../inventory'

// Classic worked example: buy 10@$1, buy 10@$2, sell 15.
const MOVES: Move[] = [
  { type: 'receipt', qty: 10, unitCost: 1 },
  { type: 'receipt', qty: 10, unitCost: 2 },
  { type: 'issue', qty: -15, unitCost: 0 },
]

describe('inventory valuation', () => {
  it('FIFO consumes oldest layers first', () => {
    const v = valuate(MOVES, 'fifo')
    expect(v.onHand).toBe(5)
    // sold 10@1 + 5@2 = 20 COGS; remaining 5@2 = 10
    expect(v.cogs).toBe(20)
    expect(v.value).toBe(10)
    expect(v.avgCost).toBe(2)
  })

  it('LIFO consumes newest layers first', () => {
    const v = valuate(MOVES, 'lifo')
    expect(v.onHand).toBe(5)
    // sold 10@2 + 5@1 = 25 COGS; remaining 5@1 = 5
    expect(v.cogs).toBe(25)
    expect(v.value).toBe(5)
    expect(v.avgCost).toBe(1)
  })

  it('weighted-average draws down at the running average', () => {
    const v = valuate(MOVES, 'wavg')
    expect(v.onHand).toBe(5)
    // avg after both receipts = $1.50; sell 15 → COGS 22.5; remaining 5*1.5 = 7.5
    expect(v.cogs).toBe(22.5)
    expect(v.value).toBe(7.5)
    expect(v.avgCost).toBe(1.5)
  })

  it('clamps issues that exceed available stock', () => {
    const v = valuate([{ type: 'receipt', qty: 5, unitCost: 3 }, { type: 'issue', qty: -20, unitCost: 0 }], 'fifo')
    expect(v.onHand).toBe(0)
    expect(v.value).toBe(0)
    expect(v.cogs).toBe(15)
  })

  it('empty history yields zero value', () => {
    const v = valuate([], 'wavg')
    expect(v).toEqual({ onHand: 0, value: 0, avgCost: 0, cogs: 0 })
  })
})

describe('reorder logic', () => {
  const base = { reorderPoint: 20, minStock: 10, maxStock: 100, safetyStock: 5 }
  it('flags out of stock', () => {
    expect(stockStatus({ ...base, onHand: 0 })).toBe('out')
  })
  it('flags below safety stock', () => {
    expect(stockStatus({ ...base, onHand: 4 })).toBe('below_safety')
  })
  it('flags reorder at/below the reorder point', () => {
    expect(stockStatus({ ...base, onHand: 20 })).toBe('reorder')
    expect(stockStatus({ ...base, onHand: 15 })).toBe('reorder')
  })
  it('reports ok in the healthy band and overstock above max', () => {
    expect(stockStatus({ ...base, onHand: 50 })).toBe('ok')
    expect(stockStatus({ ...base, onHand: 120 })).toBe('overstock')
  })
  it('suggests topping up to max when replenishment is needed', () => {
    expect(suggestedReorderQty({ ...base, onHand: 15 })).toBe(85)
    expect(suggestedReorderQty({ ...base, onHand: 50 })).toBe(0)
  })
})

describe('inventory KPIs', () => {
  it('rolls per-product rows into portfolio KPIs', () => {
    const k = inventoryKpis([
      { onHand: 0, value: 0, status: 'out' },
      { onHand: 5, value: 10, status: 'reorder' },
      { onHand: 200, value: 400, status: 'overstock' },
    ])
    expect(k.totalProducts).toBe(3)
    expect(k.totalOnHand).toBe(205)
    expect(k.totalValue).toBe(410)
    expect(k.outOfStock).toBe(1)
    expect(k.needReorder).toBe(1)
    expect(k.overstock).toBe(1)
  })
})
