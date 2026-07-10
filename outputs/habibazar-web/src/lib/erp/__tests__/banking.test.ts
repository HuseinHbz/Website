import { describe, it, expect } from 'vitest'
import { matchStatement, reconciliationSummary, canTransition, chequeStart, chequeKpis, pettyCashSummary, CHEQUE_FLOW, cashFlowSeries } from '../banking'

describe('banking — statement reconciliation', () => {
  it('matches by amount within a date window, best confidence first, one candidate per line', () => {
    const lines = [
      { id: 1, date: '2026-07-01', amount: 1000 },
      { id: 2, date: '2026-07-02', amount: -500 },
      { id: 3, date: '2026-07-03', amount: 777 },
    ]
    const candidates = [
      { id: 'sales_payment:1', date: '2026-07-01', amount: 1000 },   // exact day → high confidence
      { id: 'sales_payment:2', date: '2026-07-04', amount: 1000 },   // 3 days off
      { id: 'purchase_payment:9', date: '2026-07-02', amount: -500 },
    ]
    const r = matchStatement(lines, candidates)
    expect(r.suggestions.find(s => s.lineId === 1)?.candidateId).toBe('sales_payment:1')
    expect(r.suggestions.find(s => s.lineId === 2)?.candidateId).toBe('purchase_payment:9')
    expect(r.unmatchedLineIds).toEqual([3])
    const c1 = r.suggestions.find(s => s.lineId === 1)!.confidence
    expect(c1).toBe(100)
  })
  it('respects the date window and amount tolerance', () => {
    const r = matchStatement([{ id: 1, date: '2026-07-01', amount: 100 }], [{ id: 'x', date: '2026-07-20', amount: 100 }])
    expect(r.suggestions).toHaveLength(0)
    const r2 = matchStatement([{ id: 1, date: '2026-07-01', amount: 100 }], [{ id: 'x', date: '2026-07-01', amount: 100.005 }])
    expect(r2.suggestions).toHaveLength(1)
  })
  it('summarizes matched/unmatched + inflow/outflow', () => {
    const s = reconciliationSummary([
      { amount: 1000, status: 'matched' }, { amount: -400, status: 'unmatched' }, { amount: 200, status: 'matched' },
    ])
    expect(s.matched).toBe(2); expect(s.unmatched).toBe(1); expect(s.matchedPct).toBe(67)
    expect(s.inflow).toBe(1200); expect(s.outflow).toBe(400)
  })
})

describe('banking — cheque lifecycle', () => {
  it('enforces the per-direction state machine', () => {
    expect(chequeStart('issued')).toBe('issued')
    expect(canTransition('issued', 'issued', 'presented')).toBe(true)
    expect(canTransition('issued', 'presented', 'cleared')).toBe(true)
    expect(canTransition('issued', 'issued', 'cleared')).toBe(false)      // must be presented first
    expect(canTransition('received', 'received', 'deposited')).toBe(true)
    expect(canTransition('received', 'received', 'presented')).toBe(false) // presented is an issued-side state
    expect(canTransition('issued', 'bounced', 'presented')).toBe(true)     // retry after bounce
    expect(CHEQUE_FLOW.issued.cleared).toBeUndefined()                     // terminal
  })
  it('rolls cheque KPIs incl. due-soon', () => {
    const k = chequeKpis([
      { status: 'issued', amount: 100, dueDate: '2026-07-12' },
      { status: 'cleared', amount: 200 },
      { status: 'bounced', amount: 300 },
    ], '2026-07-10')
    expect(k.open).toBe(1); expect(k.openAmount).toBe(100); expect(k.dueSoon).toBe(1)
    expect(k.bounced).toBe(1); expect(k.cleared).toBe(1)
  })
})

describe('banking — petty cash', () => {
  it('computes the balance and flags low balance under 20% of float', () => {
    const s = pettyCashSummary([
      { kind: 'float', amount: 1000 }, { kind: 'expense', amount: 700 }, { kind: 'expense', amount: 200 }, { kind: 'replenish', amount: 50 },
    ])
    expect(s.balance).toBe(150); expect(s.spent).toBe(900); expect(s.lowBalance).toBe(true)
    const ok = pettyCashSummary([{ kind: 'float', amount: 1000 }, { kind: 'expense', amount: 100 }])
    expect(ok.lowBalance).toBe(false)
  })
})

import { scanAnomalies, buildFinancePrompt } from '../financeAi'

describe('finance AI — deterministic pre-analysis + prompt', () => {
  it('flags duplicate totals on the same day and 5x-median outliers', () => {
    const anoms = scanAnomalies([
      { id: 1, date: '2026-07-01', total: 500 },
      { id: 2, date: '2026-07-01', total: 500 },   // duplicate
      { id: 3, date: '2026-07-02', total: 480 },
      { id: 4, date: '2026-07-03', total: 520 },
      { id: 5, date: '2026-07-04', total: 9000 },  // outlier vs median ~500
    ])
    expect(anoms.some(a => a.code === 'duplicate.total' && a.entryIds.includes(1) && a.entryIds.includes(2))).toBe(true)
    expect(anoms.some(a => a.code === 'outlier.total' && a.entryIds.includes(5))).toBe(true)
  })
  it('builds a grounded localized prompt embedding the snapshot + anomalies', () => {
    const p = buildFinancePrompt('analyze', 'Cash 100 | Net income 40', { locale: 'fa', anomalies: [{ code: 'x', message: 'possible duplicate', entryIds: [1] }] })
    expect(p.systemPrompt).toContain('Persian')
    expect(p.systemPrompt).toContain('Cash 100')
    expect(p.systemPrompt).toContain('possible duplicate')
    expect(p.systemPrompt).toContain('Never invent')
    expect(p.userMessage.toLowerCase()).toContain('analyze')
  })
})

describe('cashFlowSeries (26.3)', () => {
  const receipts = [
    { date: '2026-05-10', amount: 300 }, { date: '2026-06-02', amount: 600 },
    { date: '2026-07-01', amount: 900 }, { date: '2020-01-01', amount: 9999 }, // outside window
  ]
  const payments = [{ date: '2026-06-15', amount: -200 }, { date: '2026-07-03', amount: 100 }]

  it('buckets by month over the trailing window and totals correctly', () => {
    const r = cashFlowSeries(receipts, payments, { months: 4, forecastMonths: 0, now: '2026-07-10' })
    expect(r.months.map(m => m.month)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07'])
    expect(r.months[1]).toEqual({ month: '2026-05', inflow: 300, outflow: 0, net: 300 })
    expect(r.months[2]).toEqual({ month: '2026-06', inflow: 600, outflow: 200, net: 400 }) // sign-safe
    expect(r.months[3]).toEqual({ month: '2026-07', inflow: 900, outflow: 100, net: 800 })
    expect(r.totals).toEqual({ inflow: 1800, outflow: 300, net: 1500 })
  })
  it('forecasts a 3-month moving average forward across year ends', () => {
    const r = cashFlowSeries(receipts, payments, { months: 3, forecastMonths: 3, now: '2026-12-05' })
    // last 3 actual months (Oct/Nov/Dec 2026) are empty → zero forecast, keys roll into 2027
    expect(r.forecast.map(f => f.month)).toEqual(['2027-01', '2027-02', '2027-03'])
    const r2 = cashFlowSeries(receipts, payments, { months: 3, forecastMonths: 2, now: '2026-07-10' })
    expect(r2.forecast[0].inflow).toBe(600) // (300+600+900)/3
    expect(r2.forecast[0].outflow).toBe(100) // (0+200+100)/3
    expect(r2.forecast[0].net).toBe(500)
    expect(r2.forecast[1]).toEqual({ ...r2.forecast[0], month: '2026-09' })
  })
  it('ignores unparseable dates and handles empty ledgers', () => {
    const r = cashFlowSeries([{ date: 'bad', amount: 100 }], [], { months: 2, forecastMonths: 1, now: '2026-07-10' })
    expect(r.totals).toEqual({ inflow: 0, outflow: 0, net: 0 })
    expect(r.forecast[0].net).toBe(0)
  })
})
