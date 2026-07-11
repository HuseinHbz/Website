import { describe, it, expect } from 'vitest'
import { formatCurrency, fmtMoney, setDefaultCurrency, getDefaultCurrency, formatMoney, convertFromBase } from '../format'

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

describe('formatMoney — universal cross-currency formatter (26.8)', () => {
  // The mandate scenario: 1 USD = 200,000 Toman = 2,000,000 Rial.
  const rates = { USD: 2_000_000, EUR: 2_200_000 }
  it('converts via the Rial base and formats in the target symbol', () => {
    expect(formatMoney(2000, 'USD', 'IRT', rates)).toBe('400,000,000 تومان')
    expect(formatMoney(2000, 'USD', 'IRR', rates)).toBe('4,000,000,000 ریال')
    expect(formatMoney(2000, 'USD', 'USD', rates)).toBe('$2,000')
    expect(formatMoney(2000, 'USD', 'EUR', rates)).toBe('€1,818.18')
  })
  it('convertFromBase maps Rial aggregates into the display currency', () => {
    expect(convertFromBase(4_000_000_000, 'IRT', rates)).toBe(400_000_000)
    expect(convertFromBase(4_000_000_000, 'USD', rates)).toBe(2000)
    expect(convertFromBase(500, 'IRR', rates)).toBe(500)
  })
})
