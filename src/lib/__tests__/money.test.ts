import { describe, it, expect } from 'vitest'
import { toMinorUnits, fromMinorUnits, sumMinorUnits, exactlyBalanced } from '../money'

describe('exact decimal money (ERPFIX-8, BUG-ERP-23)', () => {
  it('converts to/from minor units exactly', () => {
    expect(toMinorUnits(1090)).toBe(BigInt(109000))
    expect(fromMinorUnits(BigInt(109000))).toBe(1090)
    expect(toMinorUnits(-500.5)).toBe(BigInt(-50050))
  })
  it('sums classic float-error cases exactly', () => {
    // 0.1 + 0.2 !== 0.3 in IEEE-754 float
    expect(0.1 + 0.2 === 0.3).toBe(false)
    expect(sumMinorUnits([0.1, 0.2])).toBe(sumMinorUnits([0.3]))
  })
  it('a genuinely balanced set of lines passes exactly', () => {
    const r = exactlyBalanced([{ debit: 1_234_567.89, credit: 0 }, { debit: 0, credit: 1_234_567.89 }])
    expect(r.ok).toBe(true)
    expect(r.diffUnits).toBe(BigInt(0))
  })
  it('a one-cent imbalance is caught, never hidden by an epsilon', () => {
    const r = exactlyBalanced([{ debit: 1000.01, credit: 0 }, { debit: 0, credit: 1000 }])
    expect(r.ok).toBe(false)
    expect(r.diffUnits).toBe(BigInt(1)) // exactly 1 cent, not rounded away
  })
  it('large multi-line real-world chains stay exact (sum of many rate-converted amounts)', () => {
    const lines = Array.from({ length: 50 }, (_, i) => ({ debit: 33_333.33 + i * 0.07, credit: 0 }))
    const total = lines.reduce((s, l) => s + l.debit, 0)
    const r = exactlyBalanced([...lines, { debit: 0, credit: total }])
    expect(r.ok).toBe(true)
  })
})
