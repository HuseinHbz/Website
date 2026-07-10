import { describe, it, expect } from 'vitest'
import {
  normalSide, entryBalanced, accountBalance, trialBalance,
  incomeStatement, balanceSheet, financialKpis, type AccountTally,
} from '../ledger'

describe('double-entry core', () => {
  it('assigns normal sides correctly', () => {
    expect(normalSide('asset')).toBe('debit')
    expect(normalSide('expense')).toBe('debit')
    expect(normalSide('liability')).toBe('credit')
    expect(normalSide('equity')).toBe('credit')
    expect(normalSide('revenue')).toBe('credit')
  })

  it('accepts a balanced entry and rejects an unbalanced one', () => {
    expect(entryBalanced([{ accountId: 1, debit: 100, credit: 0 }, { accountId: 2, debit: 0, credit: 100 }]).ok).toBe(true)
    const bad = entryBalanced([{ accountId: 1, debit: 100, credit: 0 }, { accountId: 2, debit: 0, credit: 90 }])
    expect(bad.ok).toBe(false)
    expect(bad.reason).toMatch(/debits must equal credits/)
  })

  it('rejects single-line, negative, and both-sided lines', () => {
    expect(entryBalanced([{ accountId: 1, debit: 100, credit: 0 }]).ok).toBe(false)
    expect(entryBalanced([{ accountId: 1, debit: -1, credit: 0 }, { accountId: 2, debit: 0, credit: -1 }]).ok).toBe(false)
    expect(entryBalanced([{ accountId: 1, debit: 50, credit: 50 }, { accountId: 2, debit: 0, credit: 0 }]).ok).toBe(false)
  })

  it('computes signed balances by normal side', () => {
    expect(accountBalance({ id: 1, code: '1000', nameEn: 'Cash', type: 'asset', debit: 500, credit: 200 })).toBe(300)
    expect(accountBalance({ id: 2, code: '4000', nameEn: 'Sales', type: 'revenue', debit: 0, credit: 800 })).toBe(800)
    expect(accountBalance({ id: 3, code: '2000', nameEn: 'AP', type: 'liability', debit: 100, credit: 400 })).toBe(300)
  })
})

// A tiny but complete set of books:
//  Cash 1000 (asset), Equity 3000, Sales 4000 (revenue), Rent 5000 (expense)
//  - Owner invests 10000: Dr Cash 10000 / Cr Equity 10000
//  - Sale for cash 3000:  Dr Cash 3000  / Cr Sales 3000
//  - Pay rent 500:        Dr Rent 500   / Cr Cash 500
const BOOKS: AccountTally[] = [
  { id: 1, code: '1000', nameEn: 'Cash', type: 'asset', debit: 13000, credit: 500 },     // bal 12500
  { id: 2, code: '3000', nameEn: 'Owner Equity', type: 'equity', debit: 0, credit: 10000 }, // bal 10000
  { id: 3, code: '4000', nameEn: 'Sales', type: 'revenue', debit: 0, credit: 3000 },      // bal 3000
  { id: 4, code: '5000', nameEn: 'Rent', type: 'expense', debit: 500, credit: 0 },        // bal 500
]

describe('financial statements', () => {
  it('trial balance ties out', () => {
    const tb = trialBalance(BOOKS)
    expect(tb.balanced).toBe(true)
    expect(tb.totalDebit).toBe(tb.totalCredit)
    // debit side: Cash 12500 + Rent 500 = 13000; credit side: Equity 10000 + Sales 3000 = 13000
    expect(tb.totalDebit).toBe(13000)
  })

  it('income statement nets revenue minus expenses', () => {
    const is = incomeStatement(BOOKS)
    expect(is.totalRevenue).toBe(3000)
    expect(is.totalExpenses).toBe(500)
    expect(is.netIncome).toBe(2500)
  })

  it('balance sheet balances with net income folded into equity', () => {
    const bs = balanceSheet(BOOKS)
    expect(bs.totalAssets).toBe(12500)
    expect(bs.totalLiabilities).toBe(0)
    expect(bs.totalEquity).toBe(12500) // 10000 equity + 2500 net income
    expect(bs.balanced).toBe(true)
  })

  it('KPIs surface cash and the accounting identity', () => {
    const k = financialKpis(BOOKS, code => code.startsWith('10'))
    expect(k.cash).toBe(12500)
    expect(k.totalAssets).toBe(k.totalLiabilities + k.totalEquity)
    expect(k.netIncome).toBe(2500)
  })
})

import { consolidateTallies } from '../ledger'

describe('multi-company consolidation (Phase 26)', () => {
  it('merges per-company tallies by account, summing debits/credits', () => {
    const hq = [{ id: 1, code: '1000', nameEn: 'Cash', type: 'asset' as const, debit: 1000, credit: 200 }]
    const br = [
      { id: 1, code: '1000', nameEn: 'Cash', type: 'asset' as const, debit: 500, credit: 100 },
      { id: 2, code: '4000', nameEn: 'Revenue', type: 'revenue' as const, debit: 0, credit: 700 },
    ]
    const c = consolidateTallies([hq, br])
    expect(c.find(t => t.id === 1)).toMatchObject({ debit: 1500, credit: 300 })
    expect(c.find(t => t.id === 2)).toMatchObject({ credit: 700 })
    expect(c.map(t => t.code)).toEqual(['1000', '4000'])
  })
})
