import { describe, it, expect } from 'vitest'
import { documentTotals, requiredApprovalLevels, isFullyApproved, validateBudget, vendorScore, vendorPayable, purchaseInvoiceStatus, purchaseKpis } from '../purchasing'

describe('purchasing engine', () => {
  it('rolls document totals (reuses sales line math)', () => {
    const t = documentTotals([{ qty: 2, unitPrice: 100, discountPct: 10, taxPct: 9 }])
    // gross 200, disc 20, net 180, tax 16.2, total 196.2
    expect(t.subtotal).toBe(200); expect(t.discountTotal).toBe(20); expect(t.taxTotal).toBe(16.2); expect(t.total).toBe(196.2)
  })
  it('routes approval levels by amount', () => {
    expect(requiredApprovalLevels(10_000_000)).toBe(1)
    expect(requiredApprovalLevels(200_000_000)).toBe(2)
    expect(requiredApprovalLevels(900_000_000)).toBe(3)
  })
  it('is fully approved only when every required level signs', () => {
    expect(isFullyApproved(200_000_000, [1])).toBe(false)      // needs 2
    expect(isFullyApproved(200_000_000, [1, 2])).toBe(true)
    expect(isFullyApproved(10_000_000, [1])).toBe(true)
  })
  it('validates a budget envelope', () => {
    const ok = validateBudget({ budget: 1000, committed: 400, requested: 500 })
    expect(ok.withinBudget).toBe(true); expect(ok.remainingAfter).toBe(100)
    const over = validateBudget({ budget: 1000, committed: 800, requested: 300 })
    expect(over.withinBudget).toBe(false)
  })
  it('scores + grades a vendor', () => {
    const perfect = vendorScore({ quality: 5, delivery: 5, price: 5, service: 5, compliance: 5 })
    expect(perfect.score).toBe(100); expect(perfect.grade).toBe('A'); expect(perfect.stars).toBe(5)
    const poor = vendorScore({ quality: 2, delivery: 2, price: 2, service: 2, compliance: 2 })
    expect(poor.grade).toBe('D')
  })
  it('vendor payable + invoice status', () => {
    expect(vendorPayable({ invoicedTotal: 1000, paidTotal: 300, creditNotesTotal: 100 }).outstanding).toBe(600)
    expect(purchaseInvoiceStatus(1000, 0)).toBe('confirmed')
    expect(purchaseInvoiceStatus(1000, 500)).toBe('partial')
    expect(purchaseInvoiceStatus(1000, 1000)).toBe('paid')
  })
  it('rolls purchase KPIs', () => {
    const k = purchaseKpis({ orders: [{ status: 'confirmed', total: 500 }, { status: 'draft', total: 100 }], pendingApproval: 2, payables: 300, vendors: 5 })
    expect(k.openOrders).toBe(1); expect(k.ordersValue).toBe(500); expect(k.pendingApproval).toBe(2)
  })
})

import { purchaseInvoicePostingLines, purchasePaymentPostingLines, postingBalanced } from '../purchasing'

describe('purchasing GL posting', () => {
  it('purchase invoice posts a balanced Dr Inventory + Dr VAT / Cr AP', () => {
    const lines = purchaseInvoicePostingLines(1000, 90, 1090)
    expect(postingBalanced(lines)).toBe(true)
    const ap = lines.find(l => l.accountCode === '2000')!
    expect(ap.credit).toBe(1090)
    expect(lines.find(l => l.accountCode === '1200')!.debit).toBe(1000)
    expect(lines.find(l => l.accountCode === '2100')!.debit).toBe(90)
  })
  it('omits the VAT line when tax is zero and still balances', () => {
    const lines = purchaseInvoicePostingLines(1000, 0, 1000)
    expect(lines.some(l => l.accountCode === '2100')).toBe(false)
    expect(postingBalanced(lines)).toBe(true)
  })
  it('payment posts Dr AP / Cr Bank, balanced', () => {
    const lines = purchasePaymentPostingLines(500)
    expect(postingBalanced(lines)).toBe(true)
    expect(lines.find(l => l.accountCode === '2000')!.debit).toBe(500)
    expect(lines.find(l => l.accountCode === '1010')!.credit).toBe(500)
  })
})

import { purchaseAnalytics } from '../purchasing'

describe('purchasing analytics', () => {
  const rows = [
    { docType: 'order' as const, status: 'confirmed', total: 100, date: '2026-05-10', vendorName: 'Acme' },
    { docType: 'order' as const, status: 'draft', total: 999, date: '2026-05-11', vendorName: 'Acme' },      // excluded (draft)
    { docType: 'invoice' as const, status: 'paid', total: 200, date: '2026-06-01', vendorName: 'Beta' },
    { docType: 'invoice' as const, status: 'partial', total: 50, date: '2026-06-15', vendorName: 'Acme' },
    { docType: 'request' as const, status: 'approved', total: 500, date: '2026-06-20', vendorName: 'Beta' }, // excluded (not committed type)
  ]
  it('aggregates committed spend by month (orders+invoices, non-draft)', () => {
    const a = purchaseAnalytics(rows)
    expect(a.monthlySpend).toEqual([{ month: '2026-05', total: 100 }, { month: '2026-06', total: 250 }])
  })
  it('rolls spend by type and top vendors', () => {
    const a = purchaseAnalytics(rows)
    expect(a.byType.find(t => t.type === 'invoice')).toEqual({ type: 'invoice', total: 250, count: 2 })
    expect(a.byType.some(t => t.type === 'request')).toBe(false)
    expect(a.topVendorSpend[0]).toEqual({ vendor: 'Beta', total: 200 })
    expect(a.topVendorSpend[1]).toEqual({ vendor: 'Acme', total: 150 })
  })
  it('counts every document by status and respects the months window', () => {
    const a = purchaseAnalytics(rows, 1)
    expect(a.monthlySpend).toEqual([{ month: '2026-06', total: 250 }])
    expect(a.byStatus.find(s => s.status === 'draft')?.count).toBe(1)
  })
})
