import { describe, it, expect } from 'vitest'
import { toJalali, toGregorian, toJalaliStr, jalaliQuarter, quarterBounds } from '../jalali'

describe('jalali conversion', () => {
  it('converts known Gregorian dates to Jalali', () => {
    expect(toJalali(2024, 3, 20)).toEqual([1403, 1, 1])   // Nowruz 1403
    expect(toJalali(2024, 1, 1)).toEqual([1402, 10, 11])
    expect(toJalali(2026, 7, 14)).toEqual([1405, 4, 23])
  })
  it('round-trips Gregorian → Jalali → Gregorian', () => {
    for (const [y, m, d] of [[2024, 3, 20], [2025, 12, 31], [2023, 6, 15]] as const) {
      const [jy, jm, jd] = toJalali(y, m, d)
      expect(toGregorian(jy, jm, jd)).toEqual([y, m, d])
    }
  })
  it('formats an ISO date as Jalali', () => {
    expect(toJalaliStr('2024-03-20')).toBe('1403/01/01')
  })
})

describe('jalali quarters (فصل)', () => {
  it('classifies dates into the right Persian quarter', () => {
    expect(jalaliQuarter('2024-04-01').quarter).toBe(1) // فروردین/اردیبهشت → بهار
    expect(jalaliQuarter('2024-08-01').quarter).toBe(2) // مرداد → تابستان
    expect(jalaliQuarter('2024-11-01').quarter).toBe(3) // آبان → پاییز
    expect(jalaliQuarter('2025-01-15').quarter).toBe(4) // دی → زمستان
  })
  it('quarter bounds cover the whole quarter and align to Gregorian', () => {
    const q1 = quarterBounds(1403, 1) // بهار 1403
    expect(q1.from).toBe('2024-03-20')
    // بهار ends at the last day of خرداد.
    expect(jalaliQuarter(q1.to).quarter).toBe(1)
    expect(jalaliQuarter(q1.from).quarter).toBe(1)
    // The day after `to` must belong to the next quarter.
    const next = new Date(q1.to + 'T00:00:00Z'); next.setUTCDate(next.getUTCDate() + 1)
    expect(jalaliQuarter(next.toISOString()).quarter).toBe(2)
  })
})
