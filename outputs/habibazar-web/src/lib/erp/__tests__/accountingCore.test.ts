import { describe, it, expect } from 'vitest'
import {
  accountLevel, buildAccountTree, isCyclicParent,
  periodForDate, canPostDate, canTransitionPeriod,
  openingBalanceLines, yearEndClosingLines,
} from '../accountingCore'
import type { AccountTally } from '../ledger'

describe('chart of accounts hierarchy (26.9)', () => {
  it('derives 4 levels from code shape', () => {
    expect(accountLevel('1')).toBe(1)       // Category
    expect(accountLevel('10')).toBe(2)      // Main
    expect(accountLevel('1010')).toBe(3)    // Control
    expect(accountLevel('1010.001')).toBe(4) // Detail
    expect(accountLevel('101020')).toBe(4)
  })
  it('builds a parent→child tree code-sorted', () => {
    const tree = buildAccountTree([
      { id: 1, code: '1', nameEn: 'Assets', type: 'asset', parentId: null },
      { id: 3, code: '1010.01', nameEn: 'Mellat 123', type: 'asset', parentId: 2 },
      { id: 2, code: '1010', nameEn: 'Bank', type: 'asset', parentId: 1 },
    ])
    expect(tree).toHaveLength(1)
    expect(tree[0].children[0].code).toBe('1010')
    expect(tree[0].children[0].children[0].nameEn).toBe('Mellat 123')
    expect(tree[0].children[0].children[0].level).toBe(4)
  })
  it('detects cyclic parent assignment', () => {
    const acc = [
      { id: 1, code: '1', nameEn: 'A', type: 'asset' as const, parentId: null },
      { id: 2, code: '10', nameEn: 'B', type: 'asset' as const, parentId: 1 },
    ]
    expect(isCyclicParent(acc, 1, 2)).toBe(true) // making 1 a child of its own child
    expect(isCyclicParent(acc, 2, 2)).toBe(true)
    expect(isCyclicParent(acc, 2, 1)).toBe(false)
  })
})

describe('fiscal period lifecycle (26.9)', () => {
  const periods = [
    { id: 1, name: 'FY1404', startDate: '2025-03-21', endDate: '2026-03-20', status: 'open' as const, kind: 'year' as const },
    { id: 2, name: '1404-M01', startDate: '2025-03-21', endDate: '2025-04-20', status: 'closed' as const, kind: 'period' as const, parentId: 1 },
    { id: 3, name: '1404-M02', startDate: '2025-04-21', endDate: '2025-05-21', status: 'open' as const, kind: 'period' as const, parentId: 1 },
  ]
  it('finds the narrowest containing period', () => {
    expect(periodForDate('2025-04-01', periods)!.id).toBe(2) // month beats year
    expect(periodForDate('2025-05-01', periods)!.id).toBe(3)
    expect(periodForDate('2030-01-01', periods)).toBeNull()
  })
  it('rejects posting into a closed period; allows open and ungoverned dates', () => {
    expect(canPostDate('2025-04-01', periods).ok).toBe(false) // month closed
    expect(canPostDate('2025-05-01', periods).ok).toBe(true)  // month open
    expect(canPostDate('2030-01-01', periods).ok).toBe(true)  // no period → allowed
  })
  it('governs status transitions (locked is terminal)', () => {
    expect(canTransitionPeriod('open', 'closed')).toBe(true)
    expect(canTransitionPeriod('closed', 'open')).toBe(true)
    expect(canTransitionPeriod('closed', 'locked')).toBe(true)
    expect(canTransitionPeriod('locked', 'open')).toBe(false)
    expect(canTransitionPeriod('open', 'locked')).toBe(false)
  })
})

describe('opening balance (26.9)', () => {
  it('places each account on its normal side and requires balance', () => {
    const lines = openingBalanceLines([
      { accountId: 10, type: 'asset', amount: 1000 },      // Dr
      { accountId: 20, type: 'liability', amount: 400 },   // Cr
      { accountId: 30, type: 'equity', amount: 600 },      // Cr
    ])
    expect(lines).toEqual([
      { accountId: 10, debit: 1000, credit: 0 },
      { accountId: 20, debit: 0, credit: 400 },
      { accountId: 30, debit: 0, credit: 600 },
    ])
  })
  it('throws when unbalanced', () => {
    expect(() => openingBalanceLines([
      { accountId: 10, type: 'asset', amount: 1000 },
      { accountId: 30, type: 'equity', amount: 600 },
    ])).toThrow(/unbalanced/i)
  })
})

describe('year-end closing (26.9)', () => {
  const RE = 99
  const tallies: AccountTally[] = [
    { id: 1, code: '4000', nameEn: 'Sales', type: 'revenue', debit: 0, credit: 5000 },
    { id: 2, code: '5000', nameEn: 'COGS', type: 'expense', debit: 3000, credit: 0 },
    { id: 3, code: '1000', nameEn: 'Cash', type: 'asset', debit: 2000, credit: 0 }, // untouched
  ]
  it('rolls revenue & expense into retained earnings (profit)', () => {
    const r = yearEndClosingLines(tallies, RE)
    expect(r.totalRevenue).toBe(5000)
    expect(r.totalExpense).toBe(3000)
    expect(r.netIncome).toBe(2000)
    // Dr Sales 5000 / Cr COGS 3000 / Cr RE 2000 → balanced, cash ignored
    expect(r.lines).toEqual([
      { accountId: 1, debit: 5000, credit: 0 },
      { accountId: 2, debit: 0, credit: 3000 },
      { accountId: 99, debit: 0, credit: 2000 },
    ])
    const d = r.lines.reduce((s, l) => s + l.debit, 0)
    const c = r.lines.reduce((s, l) => s + l.credit, 0)
    expect(d).toBe(c)
  })
  it('books a loss as a debit to retained earnings', () => {
    const r = yearEndClosingLines([
      { id: 1, code: '4000', nameEn: 'Sales', type: 'revenue', debit: 0, credit: 1000 },
      { id: 2, code: '5000', nameEn: 'COGS', type: 'expense', debit: 1500, credit: 0 },
    ], RE)
    expect(r.netIncome).toBe(-500)
    expect(r.lines.find(l => l.accountId === RE)).toEqual({ accountId: 99, debit: 500, credit: 0 })
    expect(r.lines.reduce((s, l) => s + l.debit - l.credit, 0)).toBe(0)
  })
})
