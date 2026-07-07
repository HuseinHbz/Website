import { describe, it, expect } from 'vitest'
import { periodKey, parsePlaceholders, padCounter, renderNumber, validateFormat, formatRegex, type NumberFormat } from '../format'

const base: NumberFormat = {
  docType: 'invoice', pattern: '{PREFIX}-{YEAR}-{COUNTER}', prefix: 'INV', suffix: '',
  resetPolicy: 'yearly', padding: 6, increment: 1, startNumber: 1, minNumber: 1, maxNumber: null, alphabet: 'numeric',
}
const D = (s: string) => new Date(`${s}T00:00:00Z`)

describe('periodKey', () => {
  it('buckets by policy', () => {
    expect(periodKey('never', D('2026-07-07'))).toBe('')
    expect(periodKey('daily', D('2026-07-07'))).toBe('2026-07-07')
    expect(periodKey('monthly', D('2026-07-07'))).toBe('2026-07')
    expect(periodKey('quarterly', D('2026-07-07'))).toBe('2026-Q3')
    expect(periodKey('yearly', D('2026-07-07'))).toBe('2026')
  })
  it('fiscal year labelled by starting calendar year', () => {
    expect(periodKey('fiscal', D('2026-02-01'), 4)).toBe('FY2025') // before April
    expect(periodKey('fiscal', D('2026-05-01'), 4)).toBe('FY2026') // on/after April
  })
})

describe('parsePlaceholders / padCounter', () => {
  it('extracts placeholders in order', () => {
    expect(parsePlaceholders('{PREFIX}-{YEAR}-{COUNTER}')).toEqual(['PREFIX', 'YEAR', 'COUNTER'])
  })
  it('pads numeric and hex', () => {
    expect(padCounter(42, 6)).toBe('000042')
    expect(padCounter(255, 4, 'hex')).toBe('00FF')
  })
})

describe('renderNumber', () => {
  it('renders INV-2026-000001', () => {
    expect(renderNumber(base, 1, D('2026-01-15'))).toBe('INV-2026-000001')
  })
  it('supports scope placeholders and collapses empty separators', () => {
    const fmt: NumberFormat = { ...base, pattern: '{PREFIX}-{BRANCH}-{YEAR}-{COUNTER}' }
    expect(renderNumber(fmt, 21, D('2026-01-01'), { branch: 'TEH' })).toBe('INV-TEH-2026-000021')
    // absent branch → no doubled dash
    expect(renderNumber(fmt, 21, D('2026-01-01'))).toBe('INV-2026-000021')
  })
})

describe('validateFormat', () => {
  it('accepts a good format', () => {
    expect(validateFormat(base).ok).toBe(true)
  })
  it('rejects missing {COUNTER}, unknown placeholder, bad docType', () => {
    expect(validateFormat({ ...base, pattern: '{PREFIX}-{YEAR}' }).errors).toContain('pattern must include {COUNTER}')
    expect(validateFormat({ ...base, pattern: '{PREFIX}-{BOGUS}-{COUNTER}' }).ok).toBe(false)
    expect(validateFormat({ ...base, docType: 'Bad Type' }).ok).toBe(false)
  })
})

describe('formatRegex', () => {
  it('matches produced numbers and rejects foreign ones', () => {
    const re = formatRegex(base)
    expect(re.test('INV-2026-000001')).toBe(true)
    expect(re.test('PO-2026-000001')).toBe(false)
    expect(re.test('INV-2026-ABC')).toBe(false)
  })
})
