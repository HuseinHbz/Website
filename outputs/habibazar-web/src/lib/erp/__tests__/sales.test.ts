import { describe, it, expect } from 'vitest'
import { lineTotals, documentTotals, customerCredit, invoiceStatus, salesKpis, salesInvoicePostingLines, postingBalanced, isInvoiceReturnable, remainingReturnable, validateReturnRequest, canVoidInvoice } from '../sales'

describe('sales line & document totals', () => {
  it('computes a line: qty×price, then discount, then tax on discounted net', () => {
    // 10 × $100 = 1000; 10% discount = 100 → net 900; 9% tax = 81 → total 981
    const t = lineTotals({ qty: 10, unitPrice: 100, discountPct: 10, taxPct: 9 })
    expect(t.gross).toBe(1000)
    expect(t.discount).toBe(100)
    expect(t.net).toBe(900)
    expect(t.tax).toBe(81)
    expect(t.total).toBe(981)
  })

  it('clamps out-of-range percentages', () => {
    const t = lineTotals({ qty: 1, unitPrice: 100, discountPct: 150, taxPct: -5 })
    expect(t.discount).toBe(100) // clamped to 100%
    expect(t.net).toBe(0)
    expect(t.tax).toBe(0)
  })

  it('sums lines into document totals', () => {
    const d = documentTotals([
      { qty: 10, unitPrice: 100, discountPct: 10, taxPct: 9 }, // gross 1000, disc 100, tax 81, total 981
      { qty: 2, unitPrice: 50, discountPct: 0, taxPct: 9 },    // gross 100, disc 0, tax 9, total 109
    ])
    expect(d.subtotal).toBe(1100)
    expect(d.discountTotal).toBe(100)
    expect(d.taxTotal).toBe(90)
    expect(d.total).toBe(1090)
  })
})

describe('customer credit', () => {
  it('computes outstanding, available and over-limit', () => {
    const c = customerCredit({ creditLimit: 10000, invoicedTotal: 8000, paidTotal: 3000, creditNotesTotal: 500 })
    expect(c.outstanding).toBe(4500) // 8000 - 3000 - 500
    expect(c.available).toBe(5500)
    expect(c.overLimit).toBe(false)
    expect(c.utilizationPct).toBe(45)
  })
  it('flags over the credit limit', () => {
    const c = customerCredit({ creditLimit: 1000, invoicedTotal: 5000, paidTotal: 0, creditNotesTotal: 0 })
    expect(c.overLimit).toBe(true)
    expect(c.available).toBe(-4000)
  })
})

describe('invoice status & KPIs', () => {
  it('derives invoice payment status', () => {
    expect(invoiceStatus(1000, 0)).toBe('sent')
    expect(invoiceStatus(1000, 400)).toBe('partial')
    expect(invoiceStatus(1000, 1000)).toBe('paid')
  })
  it('rolls up sales KPIs', () => {
    const k = salesKpis({ customers: 5, quotes: 3, orders: 2, invoiced: 10000, collected: 6000, creditNotes: 500, taxCollected: 900, ordersValue: 8000 })
    expect(k.outstanding).toBe(3500) // 10000 - 6000 - 500
    expect(k.wonValue).toBe(8000)
    expect(k.taxCollected).toBe(900)
  })
})

describe('salesInvoicePostingLines (26.15.1 Sales → GL)', () => {
  it('posts an invoice Dr AR / Cr Revenue / Cr VAT and balances', () => {
    const lines = salesInvoicePostingLines(1000, 90, 1090, 'invoice')
    expect(postingBalanced(lines)).toBe(true)
    const ar = lines.find(l => l.accountCode === '1100')!
    const rev = lines.find(l => l.accountCode === '4000')!
    const vat = lines.find(l => l.accountCode === '2100')!
    expect(ar.debit).toBe(1090)
    expect(rev.credit).toBe(1000)
    expect(vat.credit).toBe(90)
  })
  it('omits the VAT line when tax is zero', () => {
    const lines = salesInvoicePostingLines(500, 0, 500, 'invoice')
    expect(lines.some(l => l.accountCode === '2100')).toBe(false)
    expect(postingBalanced(lines)).toBe(true)
  })
  it('reverses the entry for a credit note (return)', () => {
    const lines = salesInvoicePostingLines(1000, 90, 1090, 'credit_note')
    expect(postingBalanced(lines)).toBe(true)
    const ar = lines.find(l => l.accountCode === '1100')!
    const rev = lines.find(l => l.accountCode === '4000')!
    expect(ar.credit).toBe(1090) // AR reduced
    expect(rev.debit).toBe(1000) // revenue reversed
  })
})

describe('sales return validation (26.26 BUG-013)', () => {
  it('only confirmed/partial/paid invoices are returnable', () => {
    expect(isInvoiceReturnable('confirmed')).toBe(true)
    expect(isInvoiceReturnable('partial')).toBe(true)
    expect(isInvoiceReturnable('paid')).toBe(true)
    expect(isInvoiceReturnable('draft')).toBe(false)
    expect(isInvoiceReturnable('sent')).toBe(false)
    expect(isInvoiceReturnable('void')).toBe(false)
  })

  it('remainingReturnable never goes negative', () => {
    expect(remainingReturnable(1000, 0)).toBe(1000)
    expect(remainingReturnable(1000, 400)).toBe(600)
    expect(remainingReturnable(1000, 1000)).toBe(0)
    expect(remainingReturnable(1000, 1200)).toBe(0)
  })

  it('rejects a return on a draft/void invoice', () => {
    expect(validateReturnRequest({ status: 'draft', invoiceTotal: 1000, priorReturned: 0, requestedAmount: 1000 }).ok).toBe(false)
    expect(validateReturnRequest({ status: 'void', invoiceTotal: 1000, priorReturned: 0, requestedAmount: 1000 }).ok).toBe(false)
  })

  it('rejects cumulative returns exceeding the invoice total (idempotency)', () => {
    expect(validateReturnRequest({ status: 'paid', invoiceTotal: 1000, priorReturned: 700, requestedAmount: 400 }).ok).toBe(false)
    expect(validateReturnRequest({ status: 'paid', invoiceTotal: 1000, priorReturned: 700, requestedAmount: 300 }).ok).toBe(true)
  })

  it('accepts a valid partial return', () => {
    const v = validateReturnRequest({ status: 'confirmed', invoiceTotal: 1000, priorReturned: 0, requestedAmount: 250 })
    expect(v.ok).toBe(true); expect(v.amount).toBe(250)
  })

  it('rejects a zero/negative return', () => {
    expect(validateReturnRequest({ status: 'paid', invoiceTotal: 1000, priorReturned: 0, requestedAmount: 0 }).ok).toBe(false)
  })

  it('a paid invoice cannot be voided', () => {
    expect(canVoidInvoice(true)).toBe(false)
    expect(canVoidInvoice(false)).toBe(true)
  })
})
