import { describe, it, expect } from 'vitest'
import { depreciate, ageInYears, type DepreciationInput } from '../depreciation'

const base: Omit<DepreciationInput, 'method' | 'ageYears'> = {
  purchasePrice: 10000, residualValue: 1000, usefulLifeYears: 5,
}

describe('depreciation engine', () => {
  it('straight-line spreads the base evenly', () => {
    // base = 9000 over 5y → 1800/yr. At 2y: acc 3600, book 6400.
    const r = depreciate({ ...base, method: 'straight_line', ageYears: 2 })
    expect(r.depreciableBase).toBe(9000)
    expect(r.accumulated).toBe(3600)
    expect(r.bookValue).toBe(6400)
    expect(r.currentYearExpense).toBe(1800)
  })

  it('straight-line is fully depreciated at end of life (floored at residual)', () => {
    const r = depreciate({ ...base, method: 'straight_line', ageYears: 5 })
    expect(r.accumulated).toBe(9000)
    expect(r.bookValue).toBe(1000)
    expect(r.fullyDepreciated).toBe(true)
    expect(r.lifeUsedPct).toBe(100)
  })

  it('declining-balance is accelerated and never drops below residual', () => {
    // DDB rate = 2/5 = 40%. Yr1: 4000 (book 6000). Yr2: 2400 (book 3600).
    const r2 = depreciate({ ...base, method: 'declining_balance', ageYears: 2 })
    expect(r2.accumulated).toBe(6400)
    expect(r2.bookValue).toBe(3600)
    const rEnd = depreciate({ ...base, method: 'declining_balance', ageYears: 5 })
    expect(rEnd.bookValue).toBeGreaterThanOrEqual(1000)
  })

  it('sum-of-years-digits is accelerated vs straight line early on', () => {
    // SYD denom = 15. Yr1 = 9000*5/15 = 3000 (vs 1800 straight-line).
    const r1 = depreciate({ ...base, method: 'sum_of_years_digits', ageYears: 1 })
    expect(r1.accumulated).toBe(3000)
    expect(r1.bookValue).toBe(7000)
  })

  it('none keeps book value at purchase price', () => {
    const r = depreciate({ ...base, method: 'none', ageYears: 3 })
    expect(r.accumulated).toBe(0)
    expect(r.bookValue).toBe(10000)
  })

  it('clamps age beyond useful life', () => {
    const r = depreciate({ ...base, method: 'straight_line', ageYears: 99 })
    expect(r.bookValue).toBe(1000)
    expect(r.accumulated).toBe(9000)
  })

  it('ageInYears returns 0 for missing/invalid dates', () => {
    expect(ageInYears(null)).toBe(0)
    expect(ageInYears('not-a-date')).toBe(0)
    expect(ageInYears(new Date(Date.now() - 365.25 * 86400000).toISOString())).toBeCloseTo(1, 1)
  })
})
