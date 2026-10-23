import { describe, it, expect } from 'vitest'
import { formatDateTime, formatDate, faDigits, splitStamp } from '../datetime'

describe('admin date/time locale formatting', () => {
  it('faDigits converts Latin digits to Persian', () => {
    expect(faDigits('2026-10-23')).toBe('۲۰۲۶-۱۰-۲۳')
  })
  it('splitStamp parses a DB timestamp into date/time parts', () => {
    expect(splitStamp('2026-10-23 14:31:07')).toEqual({ date: '2026-10-23', time: '14:31' })
  })
  it('formatDateTime renders Jalali + Persian digits in fa, ISO-ish in en', () => {
    const fa = formatDateTime('2026-10-23 14:31:07', 'fa')
    const en = formatDateTime('2026-10-23 14:31:07', 'en')
    expect(fa).not.toMatch(/[0-9]/) // no Latin digits leak into the fa render
    expect(en).toBe('2026-10-23 14:31')
  })
  it('formatDateTime shows the "never" placeholder per locale when empty', () => {
    expect(formatDateTime(null, 'fa')).toBe('هرگز')
    expect(formatDateTime(undefined, 'en')).toBe('Never')
  })
  it('formatDate is date-only (no time, no never-placeholder) and locale-correct', () => {
    const fa = formatDate('2026-10-23 14:31:07', 'fa')
    const en = formatDate('2026-10-23 14:31:07', 'en')
    expect(fa).not.toMatch(/[0-9]/)
    expect(en).toBe('2026-10-23')
  })
  it('formatDate defaults to "now" when no value is given, never throwing', () => {
    expect(() => formatDate(undefined, 'fa')).not.toThrow()
    expect(() => formatDate(undefined, 'en')).not.toThrow()
  })
})
