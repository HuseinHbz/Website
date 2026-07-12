import { describe, it, expect } from 'vitest'
import { validateEntry, validateLedger } from '../accountingValidation'

const line = (debit: number, credit: number, extra: Partial<{ accountId: number | null; accountResolved: boolean; lineNo: number }> = {}) =>
  ({ debit, credit, accountId: 1, accountResolved: true, ...extra })

describe('validateEntry', () => {
  it('accepts a balanced two-line entry', () => {
    const r = validateEntry({ id: 1, status: 'posted', lines: [line(100, 0), line(0, 100)] })
    expect(r.ok).toBe(true)
    expect(r.totalDebit).toBe(100)
    expect(r.totalCredit).toBe(100)
    expect(r.difference).toBe(0)
  })
  it('flags an unbalanced entry as critical', () => {
    const r = validateEntry({ id: 2, status: 'posted', lines: [line(100, 0), line(0, 90)] })
    expect(r.ok).toBe(false)
    expect(r.difference).toBe(10)
    expect(r.issues.some(i => i.code === 'unbalanced' && i.severity === 'critical')).toBe(true)
  })
  it('flags an entry with fewer than two lines', () => {
    const r = validateEntry({ id: 3, lines: [line(100, 0)] })
    expect(r.issues.some(i => i.code === 'empty')).toBe(true)
  })
  it('flags a line carrying both a debit and a credit', () => {
    const r = validateEntry({ id: 4, lines: [line(100, 50, { lineNo: 0 }), line(0, 50)] })
    expect(r.issues.some(i => i.code === 'two_sided_line' && i.lineNo === 0)).toBe(true)
  })
  it('flags a line with neither debit nor credit', () => {
    const r = validateEntry({ id: 5, lines: [line(100, 0), line(0, 100), line(0, 0, { lineNo: 2 })] })
    expect(r.issues.some(i => i.code === 'empty_line' && i.lineNo === 2)).toBe(true)
  })
  it('flags a negative amount', () => {
    const r = validateEntry({ id: 6, lines: [line(-100, 0), line(0, -100)] })
    expect(r.issues.some(i => i.code === 'negative_amount')).toBe(true)
  })
  it('flags a line whose account did not resolve', () => {
    const r = validateEntry({ id: 7, lines: [line(100, 0, { accountResolved: false, accountId: null, lineNo: 0 }), line(0, 100)] })
    expect(r.issues.some(i => i.code === 'missing_account' && i.lineNo === 0)).toBe(true)
  })
  it('flags a posted entry with a zero total', () => {
    const r = validateEntry({ id: 8, status: 'posted', lines: [line(0, 0), line(0, 0)] })
    expect(r.issues.some(i => i.code === 'zero_total')).toBe(true)
  })
})

describe('validateLedger', () => {
  it('scores a fully clean ledger at 100', () => {
    const s = validateLedger([
      { id: 1, status: 'posted', lines: [line(100, 0), line(0, 100)] },
      { id: 2, status: 'posted', lines: [line(50, 0), line(0, 50)] },
    ])
    expect(s.entriesChecked).toBe(2)
    expect(s.clean).toBe(2)
    expect(s.withIssues).toBe(0)
    expect(s.score).toBe(100)
  })
  it('rolls up issue counts and drops the score below 100', () => {
    const s = validateLedger([
      { id: 1, status: 'posted', lines: [line(100, 0), line(0, 100)] },
      { id: 2, status: 'posted', lines: [line(100, 0), line(0, 90)] }, // unbalanced
    ])
    expect(s.withIssues).toBe(1)
    expect(s.criticalCount).toBeGreaterThanOrEqual(1)
    expect(s.byCode.unbalanced).toBe(1)
    expect(s.score).toBeLessThan(100)
    expect(s.entries).toHaveLength(1)
    expect(s.entries[0].entryId).toBe(2)
  })
  it('handles an empty ledger', () => {
    const s = validateLedger([])
    expect(s.entriesChecked).toBe(0)
    expect(s.score).toBe(100)
  })
})
