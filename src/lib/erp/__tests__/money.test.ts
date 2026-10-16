import { describe, it, expect } from 'vitest'
import { toBase, roundTo, balanceResidual } from '../money'

describe('money.ts (ERPFIX-2, BUG-ERP-03)', () => {
  it('converts a transaction-currency amount to Rial base', () => {
    expect(toBase(100, 600000)).toBe(60000000)
  })
  it('defaults a missing/zero rate to 1 (never divides by zero or drops the amount)', () => {
    expect(toBase(500, 0)).toBe(500)
  })
  it('rounds to the configured precision (default 2, matching round2 elsewhere in this codebase)', () => {
    expect(roundTo(100.444)).toBe(100.44)
    expect(roundTo(100.446)).toBe(100.45)
    expect(roundTo(100.4, 0)).toBe(100)
  })
  it('absorbs a rounding residual onto the designated control index so parts still sum to the total', () => {
    const parts = balanceResidual([33.333, 33.333, 33.334], 100, 2, 0)
    expect(parts.reduce((s, p) => s + p, 0)).toBe(100)
  })
})
