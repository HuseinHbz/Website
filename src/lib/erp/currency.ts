/**
 * Enterprise Currency Engine (Phase 26) — pure, deterministic, unit-tested.
 *
 * Multi-currency accounting with an Iranian focus: the base unit is the Rial
 * (IRR) and the Toman (IRT) is a first-class display unit (1 Toman = 10 Rial).
 * Conversion goes through per-currency rates expressed as "how many base (IRR)
 * units one foreign unit is worth", so cross-rates are exact and auditable. No
 * I/O here — the DB layer supplies the rate table.
 */

export interface Currency {
  code: string           // ISO-ish code (IRR, IRT, USD, EUR, AED)
  nameEn: string
  nameFa: string
  symbolEn: string
  symbolFa: string
  /** Fraction digits for display. */
  decimals: number
  /** Rial value of one unit of this currency (IRR=1, IRT=10). */
  baseRate: number
  isBase?: boolean
}

/** Built-in currencies. Rates for foreign currencies are seed defaults that the
 * exchange-rate table overrides day-to-day. */
export const BUILTIN_CURRENCIES: Currency[] = [
  { code: 'IRR', nameEn: 'Iranian Rial', nameFa: 'ریال', symbolEn: 'IRR', symbolFa: 'ریال', decimals: 0, baseRate: 1, isBase: true },
  { code: 'IRT', nameEn: 'Iranian Toman', nameFa: 'تومان', symbolEn: 'Toman', symbolFa: 'تومان', decimals: 0, baseRate: 10 },
  { code: 'USD', nameEn: 'US Dollar', nameFa: 'دلار آمریکا', symbolEn: '$', symbolFa: 'دلار', decimals: 2, baseRate: 600000 },
  { code: 'EUR', nameEn: 'Euro', nameFa: 'یورو', symbolEn: '€', symbolFa: 'یورو', decimals: 2, baseRate: 650000 },
  { code: 'AED', nameEn: 'UAE Dirham', nameFa: 'درهم امارات', symbolEn: 'AED', symbolFa: 'درهم', decimals: 2, baseRate: 163000 },
]

export const BASE_CODE = 'IRR'

/** Rial ↔ Toman (exact 10:1). */
export const rialToToman = (rial: number): number => rial / 10
export const tomanToRial = (toman: number): number => toman * 10

/** A rate map: code → Rial value of one unit. Overrides the built-in baseRate. */
export type RateMap = Record<string, number>

function rateOf(code: string, rates: RateMap): number {
  if (code in rates) return rates[code]
  const c = BUILTIN_CURRENCIES.find(x => x.code === code)
  if (!c) throw new Error(`Unknown currency "${code}"`)
  return c.baseRate
}

/**
 * Convert an amount between two currencies via the Rial base. `rates` overrides
 * the built-in seed rates (e.g. today's USD rate). Result is rounded to the
 * target currency's decimals.
 */
export function convert(amount: number, from: string, to: string, rates: RateMap = {}): number {
  if (from === to) return amount
  const inBase = amount * rateOf(from, rates)      // → Rial
  const out = inBase / rateOf(to, rates)
  const dec = BUILTIN_CURRENCIES.find(c => c.code === to)?.decimals ?? 2
  const f = Math.pow(10, dec)
  return Math.round(out * f) / f
}

/** Amount expressed in the base currency (Rial). */
export function toBase(amount: number, from: string, rates: RateMap = {}): number {
  return Math.round(amount * rateOf(from, rates))
}

/**
 * Exchange gain/loss when a receivable/payable booked at `bookedRate` (Rial per
 * unit) settles at `settleRate`. Positive = gain. Amount is in the foreign unit.
 */
export function exchangeDifference(amountForeign: number, bookedRate: number, settleRate: number): number {
  return Math.round(amountForeign * (settleRate - bookedRate))
}

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
const toFaDigits = (s: string) => s.replace(/[0-9]/g, d => FA_DIGITS[+d])

/** Format an amount in a currency, localized (Persian digits + words for fa). */
export function formatMoney(amount: number, code: string, locale: 'en' | 'fa' = 'en'): string {
  const c = BUILTIN_CURRENCIES.find(x => x.code === code)
  const decimals = c?.decimals ?? 2
  const num = amount.toLocaleString(locale === 'fa' ? 'en-US' : undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  const sym = locale === 'fa' ? (c?.symbolFa ?? code) : (c?.symbolEn ?? code)
  if (locale === 'fa') return `${toFaDigits(num)} ${sym}`
  // Symbol-before for $/€, after for the rest.
  return /^[$€]/.test(sym) ? `${sym}${num}` : `${num} ${sym}`
}

/** Convenience: show a Rial amount simultaneously as Rial and Toman. */
export function dualRialToman(rial: number, locale: 'en' | 'fa' = 'en'): { rial: string; toman: string } {
  return { rial: formatMoney(rial, 'IRR', locale), toman: formatMoney(rialToToman(rial), 'IRT', locale) }
}
