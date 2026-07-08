import { describe, it, expect } from 'vitest'
import { convert, toBase, rialToToman, tomanToRial, formatMoney, exchangeDifference, dualRialToman } from '../currency'
import { computeTaxes, extractInclusive, vatOf, IRAN_VAT, BUILTIN_TAXES } from '../tax'

describe('currency engine', () => {
  it('Rial ↔ Toman is exact 10:1', () => {
    expect(rialToToman(100000)).toBe(10000)
    expect(tomanToRial(10000)).toBe(100000)
  })
  it('converts through the Rial base with target decimals', () => {
    // 1 USD = 600000 IRR (seed) → 600000 IRR, and → 60000 Toman
    expect(convert(1, 'USD', 'IRR')).toBe(600000)
    expect(convert(1, 'USD', 'IRT')).toBe(60000)
    expect(convert(600000, 'IRR', 'USD')).toBe(1)
    // rate override: USD today 700000
    expect(convert(1, 'USD', 'IRR', { USD: 700000 })).toBe(700000)
    expect(convert(5, 'USD', 'USD')).toBe(5)
  })
  it('toBase returns Rial', () => {
    expect(toBase(2, 'USD')).toBe(1200000)
    expect(toBase(10000, 'IRT')).toBe(100000)
  })
  it('exchange difference = amount × (settle − booked)', () => {
    expect(exchangeDifference(100, 600000, 620000)).toBe(2000000) // gain
    expect(exchangeDifference(100, 620000, 600000)).toBe(-2000000) // loss
  })
  it('formats localized money incl. Persian digits + Toman', () => {
    expect(formatMoney(1234, 'USD', 'en')).toBe('$1,234.00')
    expect(formatMoney(5000, 'IRT', 'fa')).toContain('تومان')
    expect(formatMoney(5000, 'IRT', 'fa')).toContain('۵')
    const dual = dualRialToman(100000, 'en')
    expect(dual.toman).toContain('10,000')
  })
})

describe('tax engine', () => {
  it('applies Iran VAT 9%', () => {
    expect(vatOf(1000)).toBe(90)
    const r = computeTaxes(1000, [IRAN_VAT])
    expect(r.taxTotal).toBe(90); expect(r.grandTotal).toBe(1090)
  })
  it('withholding reduces the payable; VAT adds', () => {
    const r = computeTaxes(1000, BUILTIN_TAXES)
    // VAT +90, WHT5 -50, WHT10 -100
    expect(r.taxTotal).toBe(90)
    expect(r.withholdingTotal).toBe(150)
    expect(r.grandTotal).toBe(940)
  })
  it('exemption zeroes all taxes', () => {
    const r = computeTaxes(1000, [IRAN_VAT], { exempt: true })
    expect(r.taxTotal).toBe(0); expect(r.grandTotal).toBe(1000)
  })
  it('extracts VAT from an inclusive gross', () => {
    const { net, tax } = extractInclusive(1090, 9)
    expect(net).toBe(1000); expect(tax).toBe(90)
  })
})
