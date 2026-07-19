/**
 * Chart RTL/locale helpers (Phase 26.24b بند ۵.۲). recharts renders left-to-right
 * with Latin digits by default; in Persian a time-series axis must read right-to-
 * left and numbers must be fa-IR. Pure + unit-tested so the fix is verifiable
 * without a browser.
 */
const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

/** Convert Latin digits in a string to Persian digits (fa-IR). */
export function faDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, d => FA_DIGITS[Number(d)])
}

/** Locale-aware axis tick formatter: fa → Persian digits, else identity. */
export function axisTickFormatter(locale: string): (v: string | number) => string {
  return locale === 'fa' ? (v => faDigits(v)) : (v => String(v))
}

/**
 * RTL-aware chart layout props. In RTL the category (X) axis is reversed so the
 * newest point sits on the left, and the value (Y) axis moves to the right edge.
 */
export function rtlChartProps(rtl: boolean): { xReversed: boolean; yOrientation: 'left' | 'right' } {
  return { xReversed: rtl, yOrientation: rtl ? 'right' : 'left' }
}
