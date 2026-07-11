import { describe, it, expect } from 'vitest'
import { intercompanyEntries, icBalanced, IC_ACCOUNTS } from '../intercompany'
import { scanPaymentAnomalies } from '../financeAi'

describe('intercompanyEntries', () => {
  it('transfer books Due-From/Bank at the sender and Bank/Due-To at the receiver, both balanced', () => {
    const [a, b] = intercompanyEntries({ kind: 'transfer', fromCompanyId: 1, toCompanyId: 2, amount: 500 })
    expect(a.companyId).toBe(1)
    expect(a.lines).toEqual([
      expect.objectContaining({ accountCode: IC_ACCOUNTS.dueFrom, debit: 500, credit: 0 }),
      expect.objectContaining({ accountCode: IC_ACCOUNTS.bank, debit: 0, credit: 500 }),
    ])
    expect(b.companyId).toBe(2)
    expect(b.lines).toEqual([
      expect.objectContaining({ accountCode: IC_ACCOUNTS.bank, debit: 500, credit: 0 }),
      expect.objectContaining({ accountCode: IC_ACCOUNTS.dueTo, debit: 0, credit: 500 }),
    ])
    expect(icBalanced([a, b])).toBe(true)
  })
  it('settle reverses the clearing accounts', () => {
    const [a, b] = intercompanyEntries({ kind: 'settle', fromCompanyId: 2, toCompanyId: 1, amount: 500 })
    expect(a.lines[0].accountCode).toBe(IC_ACCOUNTS.dueTo)
    expect(b.lines[1].accountCode).toBe(IC_ACCOUNTS.dueFrom)
    expect(icBalanced([a, b])).toBe(true)
  })
  it('rejects same-company and non-positive amounts', () => {
    expect(() => intercompanyEntries({ kind: 'transfer', fromCompanyId: 1, toCompanyId: 1, amount: 10 })).toThrow()
    expect(() => intercompanyEntries({ kind: 'transfer', fromCompanyId: 1, toCompanyId: 2, amount: 0 })).toThrow()
  })
})

describe('scanPaymentAnomalies (26.6)', () => {
  it('flags duplicate same-party/amount/date payments and 5× outliers', () => {
    const payments = [
      { id: 1, party: 'Vendor A', date: '2026-07-01', amount: 100, source: 'purchase' as const },
      { id: 2, party: 'Vendor A', date: '2026-07-01', amount: 100, source: 'purchase' as const },
      { id: 3, party: 'Vendor B', date: '2026-07-02', amount: 120, source: 'purchase' as const },
      { id: 4, party: 'Vendor C', date: '2026-07-03', amount: 110, source: 'purchase' as const },
      { id: 5, party: 'Vendor D', date: '2026-07-04', amount: 900, source: 'purchase' as const },
    ]
    const a = scanPaymentAnomalies(payments)
    const dup = a.find(x => x.code === 'payment.duplicate')!
    expect(dup.entryIds).toEqual([1, 2])
    const out = a.find(x => x.code === 'payment.outlier')!
    expect(out.entryIds).toEqual([5]) // 900 > 5 × median(110... sorted [100,100,110,120,900] median=110)
  })
  it('same amount to different parties or dates is not a duplicate; small samples skip outliers', () => {
    const a = scanPaymentAnomalies([
      { id: 1, party: 'A', date: '2026-07-01', amount: 100, source: 'sales' },
      { id: 2, party: 'B', date: '2026-07-01', amount: 100, source: 'sales' },
      { id: 3, party: 'A', date: '2026-07-02', amount: 5000, source: 'sales' },
    ])
    expect(a).toEqual([])
  })
})
