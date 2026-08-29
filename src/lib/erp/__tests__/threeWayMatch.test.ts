import { describe, it, expect } from 'vitest'
import { matchLine, overallMatchStatus } from '../threeWayMatch'

describe('matchLine — quantity rules (Phase 5 Section 3)', () => {
  it('PO 100 / Receipt 100 / Invoice 100 → matched', () => {
    const r = matchLine({ poQty: 100, poPrice: 1000, poTaxPct: 9, receivedQty: 100, invoiceQty: 100, invoicePrice: 1000, invoiceTaxPct: 9 })
    expect(r.status).toBe('matched')
  })
  it('PO 100 / Receipt 80 / Invoice 100 → mismatch (over-received billing)', () => {
    const r = matchLine({ poQty: 100, poPrice: 1000, poTaxPct: 9, receivedQty: 80, invoiceQty: 100, invoicePrice: 1000, invoiceTaxPct: 9 })
    expect(r.status).toBe('mismatch')
    expect(r.reasons.some(x => x.includes('exceeds received'))).toBe(true)
  })
  it('PO 100 / Receipt 100 / Invoice 120 → mismatch (over-ordered billing)', () => {
    const r = matchLine({ poQty: 100, poPrice: 1000, poTaxPct: 9, receivedQty: 100, invoiceQty: 120, invoicePrice: 1000, invoiceTaxPct: 9 })
    expect(r.status).toBe('mismatch')
    expect(r.reasons.some(x => x.includes('exceeds ordered'))).toBe(true)
  })
  it('PO 100 / Receipt 80 / Invoice 80 → matched (legitimate partial receipt+bill)', () => {
    const r = matchLine({ poQty: 100, poPrice: 1000, poTaxPct: 9, receivedQty: 80, invoiceQty: 80, invoicePrice: 1000, invoiceTaxPct: 9 })
    expect(r.status).toBe('matched')
  })
})

describe('matchLine — price rules (Phase 5 Section 4)', () => {
  it('PO unit price == invoice unit price → matched', () => {
    const r = matchLine({ poQty: 10, poPrice: 55000, poTaxPct: 0, receivedQty: 10, invoiceQty: 10, invoicePrice: 55000, invoiceTaxPct: 0 })
    expect(r.status).toBe('matched')
  })
  it('PO unit price != invoice unit price → mismatch, no invented tolerance', () => {
    const r = matchLine({ poQty: 10, poPrice: 55000, poTaxPct: 0, receivedQty: 10, invoiceQty: 10, invoicePrice: 56000, invoiceTaxPct: 0 })
    expect(r.status).toBe('mismatch')
    expect(r.reasons.some(x => x.includes('unit price'))).toBe(true)
  })
  it('a sub-cent floating-point rounding difference is NOT a false mismatch', () => {
    const r = matchLine({ poQty: 3, poPrice: 33333.33, poTaxPct: 0, receivedQty: 3, invoiceQty: 3, invoicePrice: 33333.331, invoiceTaxPct: 0 })
    expect(r.status).toBe('matched')
  })
})

describe('matchLine — tax rules (Phase 5 Section 5)', () => {
  it('exact tax match → matched', () => {
    const r = matchLine({ poQty: 1, poPrice: 1000, poTaxPct: 9, receivedQty: 1, invoiceQty: 1, invoicePrice: 1000, invoiceTaxPct: 9 })
    expect(r.status).toBe('matched')
  })
  it('tax mismatch → mismatch', () => {
    const r = matchLine({ poQty: 1, poPrice: 1000, poTaxPct: 9, receivedQty: 1, invoiceQty: 1, invoicePrice: 1000, invoiceTaxPct: 5 })
    expect(r.status).toBe('mismatch')
    expect(r.reasons.some(x => x.includes('tax'))).toBe(true)
  })
  it('zero tax on both sides is a legitimate exact match, not a special case', () => {
    const r = matchLine({ poQty: 1, poPrice: 1000, poTaxPct: 0, receivedQty: 1, invoiceQty: 1, invoicePrice: 1000, invoiceTaxPct: 0 })
    expect(r.status).toBe('matched')
  })
})

describe('matchLine — no PO/receipt ancestry (standalone invoice)', () => {
  it('a line with no linked PO/receipt is pending, never fabricated as matched', () => {
    const r = matchLine({ poQty: null, poPrice: null, poTaxPct: null, receivedQty: null, invoiceQty: 5, invoicePrice: 1000, invoiceTaxPct: 0 })
    expect(r.status).toBe('pending')
  })
})

describe('overallMatchStatus', () => {
  it('worst-of: any mismatch dominates', () => {
    expect(overallMatchStatus(['matched', 'mismatch', 'matched'])).toBe('mismatch')
  })
  it('pending dominates over an all-matched-or-pending set', () => {
    expect(overallMatchStatus(['matched', 'pending'])).toBe('pending')
  })
  it('all matched → matched', () => {
    expect(overallMatchStatus(['matched', 'matched'])).toBe('matched')
  })
  it('no lines → pending, never matched', () => {
    expect(overallMatchStatus([])).toBe('pending')
  })
})
