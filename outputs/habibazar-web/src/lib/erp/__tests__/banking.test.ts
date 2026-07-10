import { describe, it, expect } from 'vitest'
import { matchStatement, reconciliationSummary, canTransition, chequeStart, chequeKpis, pettyCashSummary, CHEQUE_FLOW } from '../banking'

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
