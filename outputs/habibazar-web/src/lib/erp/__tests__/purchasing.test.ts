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
