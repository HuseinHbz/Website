import { describe, it, expect } from 'vitest'
import { formatCurrency, fmtMoney, setDefaultCurrency, getDefaultCurrency } from '../format'

describe('formatCurrency standard (26.7)', () => {
  it('formats Rial and Toman with fa suffixes and no decimals', () => {
    expect(formatCurrency(1_000_000, 'IRR')).toBe('1,000,000 ریال')
    expect(formatCurrency(100_000, 'IRT')).toBe('100,000 تومان')
    expect(formatCurrency(1234.56, 'IRR')).toBe('1,235 ریال')
  })
  it('formats USD/EUR with prefix symbols', () => {
    expect(formatCurrency(1000, 'USD')).toBe('$1,000')
    expect(formatCurrency(1000, 'EUR')).toBe('€1,000')
    expect(formatCurrency(1000.5, 'USD', { max: 2 })).toBe('$1,000.5')
  })
  it('unknown codes fall back to a code suffix', () => {
    expect(formatCurrency(50, 'XYZ')).toBe('50 XYZ')
  })
  it('default currency is IRR and is configurable', () => {
    expect(getDefaultCurrency()).toBe('IRR')
    expect(fmtMoney(500)).toBe('500 ریال')
    setDefaultCurrency('USD')
    expect(fmtMoney(500)).toBe('$500')
    expect(fmtMoney(500, { currency: 'IRT' })).toBe('500 تومان')
    setDefaultCurrency('IRR') // restore
  })
  it('keeps signed and dashZero semantics', () => {
    expect(fmtMoney(-250, { signed: true })).toBe('-250 ریال')
    expect(fmtMoney(0, { dashZero: true })).toBe('—')
  })
})
