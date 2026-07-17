import { describe, it, expect } from 'vitest'
import { revaluate, revaluationEntryLines, exposureByCurrency, REVAL_ACCOUNTS } from '../revaluation'

// The mandate scenario: asset 2000 USD booked at 200,000 Toman (2,000,000 Rial),
// today 250,000 Toman (2,500,000 Rial) → 1,000,000,000 Rial gain (100M Toman).
const asset = { key: 'asset:1', label: 'Server', kind: 'asset' as const, currency: 'USD', amountForeign: 2000, bookedRate: 2_000_000 }

describe('revaluate', () => {
  it('computes the mandate example: 2000 USD, rate 2M → 2.5M Rial = 1,000,000,000 Rial gain', () => {
    const r = revaluate([asset], { USD: 2_500_000 })
    expect(r.positions[0].bookedValue).toBe(4_000_000_000)
    expect(r.positions[0].currentValue).toBe(5_000_000_000)
    expect(r.positions[0].gainLoss).toBe(1_000_000_000)
    expect(r.net).toBe(1_000_000_000)
  })
  it('payables invert: a rising rate on foreign debt is a loss', () => {
    const ap = { key: 'ap:1', label: 'Vendor', kind: 'payable' as const, currency: 'USD', amountForeign: 1000, bookedRate: 2_000_000 }
    const r = revaluate([ap], { USD: 2_500_000 })
    expect(r.positions[0].gainLoss).toBe(-500_000_000)
    expect(r.totalLoss).toBe(500_000_000)
    expect(r.net).toBe(-500_000_000)
  })
  it('skips positions without a current rate (never 1:1)', () => {
    const r = revaluate([{ ...asset, currency: 'AED' }], { USD: 2_500_000 })
    expect(r.positions.length).toBe(0)
    expect(r.net).toBe(0)
  })
})

describe('revaluationEntryLines', () => {
  it('gain: Dr adjustment / Cr currency gain, balanced', () => {
    const lines = revaluationEntryLines(1_000_000_000)!
    expect(lines[0]).toMatchObject({ accountCode: REVAL_ACCOUNTS.adjustment, debit: 1_000_000_000 })
    expect(lines[1]).toMatchObject({ accountCode: REVAL_ACCOUNTS.gain, credit: 1_000_000_000 })
    expect(lines.reduce((s, l) => s + l.debit - l.credit, 0)).toBe(0)
  })
  it('loss: Dr currency loss / Cr adjustment; zero delta → null', () => {
    const lines = revaluationEntryLines(-250)!
    expect(lines[0].accountCode).toBe(REVAL_ACCOUNTS.loss)
    expect(lines[1].accountCode).toBe(REVAL_ACCOUNTS.adjustment)
    expect(revaluationEntryLines(0)).toBeNull()
  })
})

describe('exposureByCurrency', () => {
  it('rolls positions up per currency', () => {
    const r = revaluate([
      asset,
      { key: 'ar:1', label: 'Cust', kind: 'receivable', currency: 'USD', amountForeign: 500, bookedRate: 2_100_000 },
      { key: 'ar:2', label: 'CustEU', kind: 'receivable', currency: 'EUR', amountForeign: 100, bookedRate: 2_200_000 },
    ], { USD: 2_500_000, EUR: 2_300_000 })
    const ex = exposureByCurrency(r.positions)
    const usd = ex.find(e => e.currency === 'USD')!
    expect(usd.positions).toBe(2)
    expect(usd.amountForeign).toBe(2500)
    expect(ex.find(e => e.currency === 'EUR')!.gainLoss).toBe(100 * 100_000)
  })
})
