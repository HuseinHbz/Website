import { describe, it, expect } from 'vitest'
import { parseCsv, parseMt940, parseCamt053, splitCsvRow, detectDuplicates, lineFingerprint, mapErpType } from '@/lib/treasury/statementImport'
import { similarity, scoreMatch, reconcile, reconStats } from '@/lib/treasury/reconcile'
import { canTransitionPayment, isFinalPayment, paymentGlLines, glBalanced, allocateReceipt, requiredApprovalRole } from '@/lib/treasury/payments'
import { cashPosition, liquidityForecast, liquidityRisk } from '@/lib/treasury/cash'
import { exposureByCurrency, unrealizedFx, realizedFx, currencyRiskLevel, riskSummary } from '@/lib/treasury/risk'
import { chequeAging, chequeCalendar, chequeRisk } from '@/lib/treasury/cheque'

describe('statement import (26.14 M2)', () => {
  it('splits quoted CSV rows', () => {
    expect(splitCsvRow('a,"b,c",d')).toEqual(['a', 'b,c', 'd'])
    expect(splitCsvRow('"x ""y""",z')).toEqual(['x "y"', 'z'])
  })
  it('parses CSV with amount column', () => {
    const csv = 'Date,Amount,Description,Ref\n2026-01-15,1000,ACME payment,R1\n2026-01-16,-500,Bank fee,R2'
    const rows = parseCsv(csv, { date: 'Date', amount: 'Amount', description: 'Description', reference: 'Ref' })
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ date: '2026-01-15', amount: 1000, reference: 'R1' })
    expect(rows[1].amount).toBe(-500)
  })
  it('parses CSV with debit/credit columns + dd/mm/yyyy dates', () => {
    const csv = 'date,debit,credit,desc\n15/01/2026,0,1000,in\n16/01/2026,500,0,out'
    const rows = parseCsv(csv, { date: 'date', debit: 'debit', credit: 'credit', description: 'desc' })
    expect(rows[0]).toMatchObject({ date: '2026-01-15', amount: 1000 })
    expect(rows[1].amount).toBe(-500)
  })
  it('parses MT940 :61:/:86:', () => {
    const mt = ':20:REF\n:61:2601150115C1000,00NTRFACME\n:86:ACME CORP PAYMENT\n:61:2601160116D500,00NCHGFEE\n:86:BANK FEE'
    const rows = parseMt940(mt)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ date: '2026-01-15', amount: 1000, description: 'ACME CORP PAYMENT' })
    expect(rows[1].amount).toBe(-500)
  })
  it('parses CAMT.053 entries', () => {
    const xml = `<Stmt><Ntry><Amt Ccy="IRR">1000</Amt><CdtDbtInd>CRDT</CdtDbtInd><BookgDt><Dt>2026-01-15</Dt></BookgDt><AddtlNtryInf>ACME</AddtlNtryInf><AcctSvcrRef>R1</AcctSvcrRef></Ntry>` +
      `<Ntry><Amt Ccy="IRR">500</Amt><CdtDbtInd>DBIT</CdtDbtInd><BookgDt><Dt>2026-01-16</Dt></BookgDt><AddtlNtryInf>FEE</AddtlNtryInf></Ntry></Stmt>`
    const rows = parseCamt053(xml)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ date: '2026-01-15', amount: 1000, reference: 'R1' })
    expect(rows[1].amount).toBe(-500)
  })
  it('detects duplicates by fingerprint', () => {
    const existing = [{ date: '2026-01-15', amount: 1000, reference: 'R1' }]
    const incoming = [{ date: '2026-01-15', amount: 1000, description: '', reference: 'R1' }, { date: '2026-01-17', amount: 200, description: '', reference: 'R3' }]
    const { fresh, duplicates } = detectDuplicates(existing, incoming)
    expect(fresh).toHaveLength(1); expect(duplicates).toHaveLength(1)
    expect(lineFingerprint({ date: '2026-01-15', amount: 1000, reference: 'R1' })).toBe('2026-01-15|100000|r1')
  })
  it('maps ERP transaction type', () => {
    expect(mapErpType({ date: '', amount: 100, description: 'ACME', reference: '' })).toBe('receipt')
    expect(mapErpType({ date: '', amount: -100, description: 'vendor', reference: '' })).toBe('payment')
    expect(mapErpType({ date: '', amount: -50, description: 'bank fee', reference: '' })).toBe('expense')
    expect(mapErpType({ date: '', amount: -50, description: 'internal transfer', reference: '' })).toBe('transfer')
  })
})

describe('smart reconciliation (26.14 M3)', () => {
  it('similarity + score + status', () => {
    expect(similarity('ACME CORP', 'acme corporation')).toBeGreaterThan(0)
    const s = scoreMatch({ id: 1, date: '2026-01-15', amount: 1000, description: 'ACME CORP', reference: 'R1' }, { id: 'p1', date: '2026-01-15', amount: 1000, party: 'ACME Corporation', reference: 'R1' })
    expect(s.confidence).toBeGreaterThanOrEqual(0.9)
  })
  it('amount mismatch → no match', () => {
    expect(scoreMatch({ id: 1, date: '2026-01-15', amount: 1000 }, { id: 'p1', date: '2026-01-15', amount: 999 }).confidence).toBe(0)
  })
  it('reconcile picks best + stats', () => {
    const lines = [{ id: 1, date: '2026-01-15', amount: 1000, description: 'ACME', reference: 'R1' }, { id: 2, date: '2026-01-20', amount: 77, description: 'x' }]
    const cands = [{ id: 'a', date: '2026-01-15', amount: 1000, party: 'ACME', reference: 'R1' }]
    const sug = reconcile(lines, cands)
    expect(sug[0].status).toBe('matched')
    expect(sug[1].status).toBe('unmatched')
    const st = reconStats(sug)
    expect(st.total).toBe(2); expect(st.matched).toBe(1); expect(st.autoMatchRatePct).toBe(50)
  })
})

describe('payment lifecycle (26.14 M4/M5)', () => {
  it('state machine transitions', () => {
    expect(canTransitionPayment('draft', 'pending_approval')).toBe(true)
    expect(canTransitionPayment('pending_approval', 'approved')).toBe(true)
    expect(canTransitionPayment('approved', 'processing')).toBe(true)
    expect(canTransitionPayment('processing', 'completed')).toBe(true)
    expect(canTransitionPayment('completed', 'draft')).toBe(false)
    expect(canTransitionPayment('draft', 'completed')).toBe(false)
    expect(isFinalPayment('completed')).toBe(true)
  })
  it('GL lines are balanced per type', () => {
    for (const t of ['supplier_payment', 'tax_payment', 'salary_payment', 'customer_refund', 'internal_transfer', 'customer_receipt'] as const) {
      const lines = paymentGlLines(t, 500)
      expect(glBalanced(lines)).toBe(true)
    }
    expect(paymentGlLines('supplier_payment', 500)[0]).toMatchObject({ accountCode: '2000', debit: 500 })
    expect(paymentGlLines('customer_receipt', 500)[0]).toMatchObject({ accountCode: '1010', debit: 500 })
  })
  it('allocates receipts oldest-first + advance', () => {
    const r = allocateReceipt(1200, [{ id: 1, open: 500 }, { id: 2, open: 500 }])
    expect(r.allocations).toEqual([{ invoiceId: 1, amount: 500 }, { invoiceId: 2, amount: 500 }])
    expect(r.advance).toBe(200)
    const partial = allocateReceipt(300, [{ id: 1, open: 500 }])
    expect(partial.allocations[0].amount).toBe(300); expect(partial.advance).toBe(0)
  })
  it('approval tier by amount (Toman)', () => {
    expect(requiredApprovalRole(50_000_000)).toBe('finance_manager')
    expect(requiredApprovalRole(500_000_000)).toBe('cfo')
    expect(requiredApprovalRole(2_000_000_000)).toBe('ceo')
  })
})

describe('cash + liquidity (26.14 M7/M8)', () => {
  it('cash position projects pending flows', () => {
    const p = cashPosition({ bankBalances: 1000, cashAccounts: 200, pendingReceipts: 500, pendingPayments: 300 })
    expect(p.available).toBe(1200)
    expect(p.projected).toBe(1400)
  })
  it('liquidity buckets 7/30/90/365', () => {
    const b = liquidityForecast(1000, [{ date: '2026-01-10', amount: 5000 }], [{ date: '2026-01-20', amount: 3500 }], '2026-01-01')
    const b30 = b.find(x => x.days === 30)!
    expect(b30.inflow).toBe(5000); expect(b30.outflow).toBe(3500); expect(b30.net).toBe(1500)
    expect(b30.expectedBalance).toBe(2500)
    const b7 = b.find(x => x.days === 7)!
    expect(b7.inflow).toBe(0)   // nothing within 7 days
  })
  it('liquidity risk level', () => {
    expect(liquidityRisk([{ days: 30, inflow: 0, outflow: 100, net: -100, expectedBalance: -50 }])).toBe('critical')
    expect(liquidityRisk([{ days: 30, inflow: 0, outflow: 0, net: 0, expectedBalance: 50 }], 100)).toBe('watch')
    expect(liquidityRisk([{ days: 30, inflow: 0, outflow: 0, net: 0, expectedBalance: 500 }], 100)).toBe('healthy')
  })
})

describe('treasury FX risk (26.14 M9)', () => {
  it('exposure assets − liabilities (1M − 700k = 300k)', () => {
    const rows = exposureByCurrency([{ currency: 'USD', assets: 1_000_000, liabilities: 700_000 }])
    expect(rows[0].netExposure).toBe(300_000)
  })
  it('aggregates positions per currency', () => {
    const rows = exposureByCurrency([{ currency: 'USD', assets: 500, liabilities: 0 }, { currency: 'USD', assets: 0, liabilities: 200 }, { currency: 'EUR', assets: 100, liabilities: 0 }])
    expect(rows.find(r => r.currency === 'USD')!.netExposure).toBe(300)
  })
  it('realized + unrealized FX', () => {
    expect(unrealizedFx(1000, 50, 60)).toBe(10000)     // 1000 × (60−50)
    expect(realizedFx(500, 50, 55)).toBe(2500)
  })
  it('risk level + summary', () => {
    expect(currencyRiskLevel(25, 100)).toBe('high')
    expect(currencyRiskLevel(15, 100)).toBe('medium')
    expect(currencyRiskLevel(5, 100)).toBe('low')
    const s = riskSummary([{ currency: 'USD', assets: 1000, liabilities: 0, netExposure: 1000 }], { USD: { booked: 50, current: 60 } }, 100000)
    expect(s.totalUnrealized).toBe(10000)
  })
})

describe('cheque management (26.14 M6)', () => {
  const today = '2026-01-15'
  const cheques = [
    { id: 1, direction: 'received' as const, amount: 100, dueDate: '2026-01-10', status: 'received' },  // overdue
    { id: 2, direction: 'received' as const, amount: 200, dueDate: '2026-01-18', status: 'received' },  // due_7
    { id: 3, direction: 'issued' as const, amount: 300, dueDate: '2026-02-10', status: 'issued' },      // due_30
    { id: 4, direction: 'issued' as const, amount: 400, dueDate: '2026-01-10', status: 'cleared' },     // not open
  ]
  it('aging buckets exclude non-open', () => {
    const a = chequeAging(cheques, today)
    expect(a.find(b => b.bucket === 'overdue')!.amount).toBe(100)
    expect(a.find(b => b.bucket === 'due_7')!.count).toBe(1)
    expect(a.find(b => b.bucket === 'due_30')!.amount).toBe(300)
  })
  it('calendar groups by due date', () => {
    const cal = chequeCalendar(cheques)
    expect(cal).toHaveLength(3)   // cleared excluded
    expect(cal[0].date).toBe('2026-01-10')
  })
  it('per-cheque risk', () => {
    expect(chequeRisk(cheques[0], 1e9, today)).toBe('overdue')
    expect(chequeRisk(cheques[1], 1e9, today)).toBe('due_soon')
    expect(chequeRisk(cheques[3], 1e9, today)).toBe('none')     // cleared
    expect(chequeRisk({ id: 9, direction: 'issued', amount: 2e9, dueDate: null, status: 'issued' }, 1e9, today)).toBe('large')
  })
})
