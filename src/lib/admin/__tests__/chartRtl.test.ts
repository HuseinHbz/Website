import { describe, it, expect } from 'vitest'
import { faDigits, axisTickFormatter, rtlChartProps } from '../chartRtl'

describe('chart RTL helpers (بند ۵.۲)', () => {
  it('faDigits converts Latin digits to Persian', () => {
    expect(faDigits('1403/05')).toBe('۱۴۰۳/۰۵')
    expect(faDigits(1250000)).toBe('۱۲۵۰۰۰۰')
    expect(faDigits('abc')).toBe('abc')
  })
  it('axisTickFormatter localizes only in fa', () => {
    expect(axisTickFormatter('fa')('2026')).toBe('۲۰۲۶')
    expect(axisTickFormatter('en')('2026')).toBe('2026')
  })
  it('rtlChartProps reverses the X axis and moves Y to the right in RTL', () => {
    expect(rtlChartProps(true)).toEqual({ xReversed: true, yOrientation: 'right' })
    expect(rtlChartProps(false)).toEqual({ xReversed: false, yOrientation: 'left' })
  })
})
