import { describe, it, expect } from 'vitest'
import { salesPerformance, forecastSales, attainmentStatus, runStatement } from '../salesPerformance'

const sales = [
  { month: '2026-04', invoiced: 1000 },
  { month: '2026-05', invoiced: 1200 },
  { month: '2026-06', invoiced: 1400 },
]
const targets = [
  { period: '2026-04', target: 1000, commissionPct: 5 },
  { period: '2026-05', target: 1500, commissionPct: 5 },
  { period: '2026-06', target: 2000, commissionPct: 10 },
]

describe('attainmentStatus', () => {
  it('classifies above/near/below/no_target', () => {
    expect(attainmentStatus(120, 100)).toBe('above')
    expect(attainmentStatus(100, 100)).toBe('above')
    expect(attainmentStatus(85, 100)).toBe('near')
    expect(attainmentStatus(50, 100)).toBe('below')
    expect(attainmentStatus(0, 0)).toBe('no_target')
  })
})

describe('salesPerformance', () => {
  it('joins targets, computes attainment + straight revenue commission + totals', () => {
    const r = salesPerformance(sales, targets, 0)
    expect(r.months[0]).toMatchObject({ month: '2026-04', attainmentPct: 100, commission: 50, status: 'above' })
    expect(r.months[1]).toMatchObject({ attainmentPct: 80, commission: 60, status: 'near' })
    expect(r.months[2]).toMatchObject({ attainmentPct: 70, commission: 140, status: 'below' })
    expect(r.totals).toEqual({ invoiced: 3600, target: 4500, attainmentPct: 80, commission: 250 })
  })
  it('months without a target row carry zero target and no_target status', () => {
    const r = salesPerformance([{ month: '2026-07', invoiced: 500 }], [], 0)
    expect(r.months[0]).toMatchObject({ target: 0, attainmentPct: 0, commission: 0, status: 'no_target' })
  })
})

describe('forecastSales', () => {
  it('projects the linear trend forward, rolling month keys', () => {
    const f = forecastSales(sales, 2) // slope +200/month from 1400
    expect(f).toEqual([
      { month: '2026-07', invoiced: 1600 },
      { month: '2026-08', invoiced: 1800 },
    ])
  })
  it('falls back to the average under 3 points and clamps at zero', () => {
    expect(forecastSales([{ month: '2026-06', invoiced: 900 }], 1)).toEqual([{ month: '2026-07', invoiced: 900 }])
    const declining = [
      { month: '2026-04', invoiced: 400 }, { month: '2026-05', invoiced: 200 }, { month: '2026-06', invoiced: 0 },
    ]
    expect(forecastSales(declining, 2)[1].invoiced).toBe(0) // never negative
    expect(forecastSales([], 3)).toEqual([])
  })
})

describe('runStatement', () => {
  it('sorts chronologically and runs the balance (debits owe, credits settle)', () => {
    const r = runStatement([
      { date: '2026-07-05', kind: 'payment', ref: 'PAY-1', debit: 0, credit: 600 },
      { date: '2026-07-01', kind: 'invoice', ref: 'INV-1', debit: 1000, credit: 0 },
      { date: '2026-07-08', kind: 'credit_note', ref: 'CN-1', debit: 0, credit: 100 },
    ])
    expect(r.lines.map(l => l.ref)).toEqual(['INV-1', 'PAY-1', 'CN-1'])
    expect(r.lines.map(l => l.balance)).toEqual([1000, 400, 300])
    expect(r.totals).toEqual({ debit: 1000, credit: 700, balance: 300 })
  })
})
