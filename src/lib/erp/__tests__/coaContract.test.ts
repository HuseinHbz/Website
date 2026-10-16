import { describe, it, expect } from 'vitest'
import { findCoaCollisions, coaExpectationFor } from '../coaContract'

describe('coaContract — findCoaCollisions (ERPFIX-1 BUG-ERP-10 gate)', () => {
  it('reports zero collisions for a clean seed list', () => {
    const seeds = [
      { code: '6000', nameEn: 'Salaries Expense', type: 'expense' },
      { code: '6100', nameEn: 'Rent Expense', type: 'expense' },
    ]
    expect(findCoaCollisions(seeds)).toEqual([])
  })

  it('catches the exact BUG-ERP-10 shape — one code seeded with two different names/types', () => {
    const seeds = [
      { code: '6100', nameEn: 'Rent Expense', type: 'expense' },
      { code: '6100', nameEn: 'Salaries', type: 'expense' }, // the real-world collision
    ]
    const collisions = findCoaCollisions(seeds)
    expect(collisions).toHaveLength(1)
    expect(collisions[0].code).toBe('6100')
    expect(collisions[0].variants).toHaveLength(2)
  })

  it('does NOT flag the same code seeded twice with the IDENTICAL name/type (idempotent re-seed)', () => {
    const seeds = [
      { code: '6000', nameEn: 'Salaries Expense', type: 'expense' },
      { code: '6000', nameEn: 'Salaries Expense', type: 'expense' },
    ]
    expect(findCoaCollisions(seeds)).toEqual([])
  })

  it('coaExpectationFor resolves the payroll-critical codes correctly', () => {
    expect(coaExpectationFor('6000')).toEqual({ code: '6000', nameEn: 'Salaries Expense', type: 'expense' })
    expect(coaExpectationFor('6100')).toEqual({ code: '6100', nameEn: 'Rent Expense', type: 'expense' })
    expect(coaExpectationFor('9999')).toBeUndefined()
  })
})
