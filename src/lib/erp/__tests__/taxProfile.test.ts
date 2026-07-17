import { describe, it, expect } from 'vitest'
import { computeProfile, type TaxProfile } from '../taxData'

const P = (over: Partial<TaxProfile>): TaxProfile => ({
  id: 1, code: 'X', nameEn: 'X', nameFa: 'X', category: 'standard',
  vatRate: 0, withholdingRate: 0, exempt: false, active: true, ...over,
})

describe('computeProfile (26.9 tax profiles)', () => {
  it('applies VAT only', () => {
    const r = computeProfile(P({ vatRate: 9 }), 1000)
    expect(r.taxTotal).toBe(90)
    expect(r.withholdingTotal).toBe(0)
    expect(r.grandTotal).toBe(1090)
  })
  it('applies VAT + withholding (service profile)', () => {
    const r = computeProfile(P({ vatRate: 9, withholdingRate: 5, category: 'service' }), 1000)
    expect(r.taxTotal).toBe(90)
    expect(r.withholdingTotal).toBe(50)
    expect(r.grandTotal).toBe(1040) // 1000 + 90 − 50
  })
  it('exempt profile zeroes all tax', () => {
    const r = computeProfile(P({ vatRate: 9, exempt: true, category: 'exempt' }), 1000)
    expect(r.taxTotal).toBe(0)
    expect(r.grandTotal).toBe(1000)
  })
})
