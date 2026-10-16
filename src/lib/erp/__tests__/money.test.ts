/**
 * ERPFIX-2 — money.ts: conversion, rounding residue on the control line,
 * cumulative proportional relief, realized FX settlement, payment normaliser.
 */
import { describe, it, expect } from 'vitest'
import { roundTo, toBase, linesToBase, documentControlBase, proportionalRelief, settlementLines, fxTrueUpLines, documentBase, normalizePayment } from '../money'
import { salesInvoicePostingLines } from '../sales'
import { purchaseInvoicePostingLines } from '../purchasing'
import { entryBalanced } from '../ledger'

const acc = { bank: '1010', control: '1100', gain: '4900', loss: '6980' }
const sum = (ls: { debit: number; credit: number }[]) => ({ dr: ls.reduce((s, l) => s + l.debit, 0), cr: ls.reduce((s, l) => s + l.credit, 0) })

describe('toBase / roundTo', () => {
  it('rounds half away from zero to the precision', () => {
    expect(roundTo(2.5, 0)).toBe(3); expect(roundTo(-2.5, 0)).toBe(-3); expect(roundTo(1.005, 2)).toBe(1.01)
  })
  it('converts at the rate, rounded to whole Rials by default', () => {
    expect(toBase(100, 600000)).toBe(60_000_000)
    expect(toBase(33.33, 600001.7)).toBe(19_998_057) // 19,998,056.661 → 19,998,057
  })
  it('a base amount (rate 1) is not re-rounded beyond 2 decimals', () => {
    expect(toBase(1090.5, 1)).toBe(1090.5)
  })
  it('refuses a zero / negative rate', () => {
    expect(() => toBase(1, 0)).toThrow(); expect(() => toBase(1, -5)).toThrow()
  })
})

describe('linesToBase — invoice in base currency, exactly balanced', () => {
  it('100 USD @ 600,000 → AR 60,000,000, revenue at base, fx_amount kept', () => {
    const out = linesToBase(salesInvoicePostingLines(100, 0, 100), 600000, 'USD', '1100')
    expect(out.find(l => l.accountCode === '1100')).toMatchObject({ debit: 60_000_000, fxAmount: 100, fxCurrency: 'USD' })
    expect(out.find(l => l.accountCode === '4000')).toMatchObject({ credit: 60_000_000, fxAmount: 100 })
  })
  it('an odd rate leaves NO imbalance — the residue lands on AR', () => {
    const out = linesToBase(salesInvoicePostingLines(33.33, 3.0, 36.33), 600001.7, 'USD', '1100')
    const t = sum(out)
    expect(t.dr).toBe(t.cr) // exact, no EPS
    expect(entryBalanced(out.map((l, i) => ({ accountId: i, debit: l.debit, credit: l.credit }))).ok).toBe(true)
    expect(out.find(l => l.accountCode === '1100')!.debit).toBe(documentControlBase(33.33, 3.0, 600001.7))
  })
  it('IRT (rate 10) and EUR convert; IRR lines carry no fx_amount', () => {
    const irt = linesToBase(salesInvoicePostingLines(1000, 90, 1090), 10, 'IRT', '1100')
    expect(irt.find(l => l.accountCode === '1100')!.debit).toBe(10_900)
    const eur = linesToBase(purchaseInvoicePostingLines(250.5, 22.55, 273.05), 700000.3, 'EUR', '2000')
    const t = sum(eur); expect(t.dr).toBe(t.cr)
    const irr = linesToBase(salesInvoicePostingLines(1000, 90, 1090), 1, 'IRR', '1100')
    expect(irr.every(l => l.fxAmount === null && l.fxCurrency === null)).toBe(true)
    expect(irr.find(l => l.accountCode === '1100')!.debit).toBe(1090)
  })
  it('credit notes keep AR on the credit side', () => {
    const out = linesToBase(salesInvoicePostingLines(10, 1, 11, 'credit_note'), 600000, 'USD', '1100')
    expect(out.find(l => l.accountCode === '1100')).toMatchObject({ debit: 0, credit: 6_600_000 })
  })
})

describe('proportionalRelief — cumulative rounding sums exactly', () => {
  it('40 of 100 relieves 40% of the posted AR', () => {
    expect(proportionalRelief(60_000_000, 100, 0, 40)).toBe(24_000_000)
  })
  it('three uneven payments relieve exactly the posted control base', () => {
    const base = documentControlBase(33.33, 3.0, 600001.7)
    const r = [proportionalRelief(base, 36.33, 0, 10), proportionalRelief(base, 36.33, 10, 13.33), proportionalRelief(base, 36.33, 23.33, 13)]
    expect(r.reduce((s, x) => s + x, 0)).toBe(base)
  })
})

describe('settlementLines — realized exchange difference', () => {
  it('receipt 40 USD @ 650,000 on an invoice booked @ 600,000 → +2,000,000 gain', () => {
    const s = settlementLines({ kind: 'receivable', currency: 'USD', paymentRate: 650000, amount: 40, relief: 24_000_000, accounts: acc })
    expect(s.bankBase).toBe(26_000_000); expect(s.fxGain).toBe(2_000_000); expect(s.fxLoss).toBe(0)
    expect(s.lines.find(l => l.accountCode === '4900')!.credit).toBe(2_000_000)
    const t = sum(s.lines); expect(t.dr).toBe(t.cr)
  })
  it('receipt at a LOWER rate → loss on 6980', () => {
    const s = settlementLines({ kind: 'receivable', currency: 'USD', paymentRate: 550000, amount: 40, relief: 24_000_000, accounts: acc })
    expect(s.fxLoss).toBe(2_000_000); expect(s.lines.find(l => l.accountCode === '6980')!.debit).toBe(2_000_000)
  })
  it('paying a payable at a HIGHER rate is a loss; lower is a gain', () => {
    const pAcc = { ...acc, control: '2000' }
    const up = settlementLines({ kind: 'payable', currency: 'USD', paymentRate: 650000, amount: 40, relief: 24_000_000, accounts: pAcc })
    expect(up.fxLoss).toBe(2_000_000); expect(up.lines.find(l => l.accountCode === '2000')!.debit).toBe(24_000_000)
    const down = settlementLines({ kind: 'payable', currency: 'USD', paymentRate: 550000, amount: 40, relief: 24_000_000, accounts: pAcc })
    expect(down.fxGain).toBe(2_000_000)
    for (const x of [up, down]) { const t = sum(x.lines); expect(t.dr).toBe(t.cr) }
  })
  it('IRR settlement: no FX line, unchanged two-line entry', () => {
    const s = settlementLines({ kind: 'receivable', currency: 'IRR', paymentRate: 1, amount: 500, relief: 500, accounts: acc })
    expect(s.lines).toHaveLength(2); expect(s.lines.every(l => l.fxAmount === null)).toBe(true)
  })
  it('true-up moves payment-rate relief to booked relief', () => {
    const r = fxTrueUpLines('receivable', 26_000_000, 24_000_000, { control: '1100', gain: '4900', loss: '6980' })
    expect(r).toEqual([
      expect.objectContaining({ accountCode: '1100', debit: 2_000_000 }), expect.objectContaining({ accountCode: '4900', credit: 2_000_000 }),
    ])
    expect(fxTrueUpLines('payable', 100, 100, { control: '2000', gain: '4900', loss: '6980' })).toEqual([])
  })
})

describe('thresholds + payment normaliser', () => {
  it('documentBase prefers base_total, else total × rate', () => {
    expect(documentBase({ total: 1000, exchangeRate: 600000, baseTotal: 600_000_000 })).toBe(600_000_000)
    expect(documentBase({ total: 1000, exchangeRate: 600000, baseTotal: 0 })).toBe(600_000_000)
    expect(documentBase({ total: 1000, exchangeRate: null, baseTotal: null })).toBe(1000)
  })
  it('same currency passes; a mismatch is refused without an explicit conversion rate', () => {
    expect(normalizePayment({ docCurrency: 'USD', currency: 'USD', amount: 40, paymentRate: 650000 })).toMatchObject({ ok: true, amount: 40, rate: 650000 })
    expect(normalizePayment({ docCurrency: 'USD', currency: 'EUR', amount: 40, paymentRate: 700000 })).toEqual({ ok: false, error: 'currency_mismatch' })
  })
  it('with a conversion rate the amount is restated in the invoice currency; base unchanged', () => {
    const n = normalizePayment({ docCurrency: 'USD', currency: 'EUR', amount: 40, paymentRate: 700000, conversionRate: 1.1 })
    expect(n).toMatchObject({ ok: true, amount: 44, currency: 'USD' })
    if (n.ok) expect(Math.round(n.amount * n.rate)).toBe(28_000_000)
  })
})
