/**
 * Lightweight Jalali (Persian/Shamsi) calendar — pure, zero-dependency.
 * (Phase 26.24 بند ۴.۳). Only what the ERP needs: Gregorian↔Jalali conversion,
 * the quarter (فصل) a Gregorian date falls in, and quarter date bounds — for the
 * seasonal TTMS (گزارش معاملات فصلی) report. Algorithm from the well-known
 * Birashk/`jalaali-js` integer method (public domain).
 */

function div(a: number, b: number): number { return Math.floor(a / b) }

/** Gregorian (gy,gm,gd 1-based) → Jalali [jy, jm, jd]. */
export function toJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  let jy = gy <= 1600 ? 0 : 979
  gy -= gy <= 1600 ? 621 : 1600
  const gy2 = gm > 2 ? gy + 1 : gy
  let days = 365 * gy + div(gy2 + 3, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400) - 80 + gd + g_d_m[gm - 1]
  jy += 33 * div(days, 12053)
  days %= 12053
  jy += 4 * div(days, 1461)
  days %= 1461
  if (days > 365) { jy += div(days - 1, 365); days = (days - 1) % 365 }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30)
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30)
  return [jy, jm, jd]
}

/** Jalali (jy,jm,jd) → Gregorian [gy, gm, gd]. */
export function toGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  let gy = jy <= 979 ? 621 : 1600
  jy -= jy <= 979 ? 0 : 979
  let days = 365 * jy + div(jy, 33) * 8 + div((jy % 33) + 3, 4) + 78 + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186)
  gy += 400 * div(days, 146097)
  days %= 146097
  if (days > 36524) { gy += 100 * div(--days, 36524); days %= 36524; if (days >= 365) days++ }
  gy += 4 * div(days, 1461)
  days %= 1461
  if (days > 365) { gy += div(days - 1, 365); days = (days - 1) % 365 }
  let gd = days + 1
  const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0
  const sal_a = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let gm = 0
  for (gm = 1; gm <= 12 && gd > sal_a[gm]; gm++) gd -= sal_a[gm]
  return [gy, gm, gd]
}

/** Format a Gregorian ISO date (YYYY-MM-DD) as Jalali YYYY/MM/DD. */
export function toJalaliStr(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return iso
  const [jy, jm, jd] = toJalali(y, m, d)
  return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`
}

export interface JalaliQuarter { jYear: number; quarter: 1 | 2 | 3 | 4; label: string }

/** The Persian fiscal quarter (فصل) a Gregorian ISO date falls in. Quarters are
 *  Q1 بهار (Farvardin–Khordad), Q2 تابستان, Q3 پاییز, Q4 زمستان. */
export function jalaliQuarter(iso: string): JalaliQuarter {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const [jy, jm] = toJalali(y, m, d)
  const quarter = (Math.ceil(jm / 3) as 1 | 2 | 3 | 4)
  const names = ['بهار', 'تابستان', 'پاییز', 'زمستان']
  return { jYear: jy, quarter, label: `${names[quarter - 1]} ${jy}` }
}

/** Gregorian ISO [from, to] bounds (inclusive) for a Persian year+quarter. */
export function quarterBounds(jYear: number, quarter: 1 | 2 | 3 | 4): { from: string; to: string } {
  const startMonth = (quarter - 1) * 3 + 1
  const endMonth = startMonth + 2
  const iso = (g: [number, number, number]) => `${g[0]}-${String(g[1]).padStart(2, '0')}-${String(g[2]).padStart(2, '0')}`
  // First day of startMonth → first day of the month AFTER endMonth minus a day.
  const from = toGregorian(jYear, startMonth, 1)
  const nextMonthJy = endMonth === 12 ? jYear + 1 : jYear
  const nextMonth = endMonth === 12 ? 1 : endMonth + 1
  const nextStart = toGregorian(nextMonthJy, nextMonth, 1)
  // Subtract one day from nextStart (Gregorian) via a Date.
  const dt = new Date(Date.UTC(nextStart[0], nextStart[1] - 1, nextStart[2]))
  dt.setUTCDate(dt.getUTCDate() - 1)
  return { from: iso(from), to: `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}` }
}
