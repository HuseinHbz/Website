/**
 * Shared display formatters.
 *
 * Phase 24 consolidated the seven drifted `money()` helpers into `fmtMoney`;
 * Phase 26.7 made it the platform's **currency formatting standard**:
 * currency-aware (IRR/IRT/USD/EUR + any ISO code), with the default currency
 * driven by the ERP settings (`erp_settings.display_currency`) instead of a
 * hardcoded dollar. All admin UI money rendering flows through here.
 */

export type CurrencyCode = string

/** Module-level default — set once per session from `/api/admin/erp/settings`. */
let DEFAULT_CURRENCY: CurrencyCode = 'IRR'
let DEFAULT_PRECISION = 0

export function setDefaultCurrency(code: CurrencyCode | undefined | null, precision?: number) {
  if (code) DEFAULT_CURRENCY = code
  if (precision != null && Number.isFinite(precision)) DEFAULT_PRECISION = Math.max(0, Math.min(4, precision))
}
export function getDefaultCurrency(): CurrencyCode { return DEFAULT_CURRENCY }

export interface MoneyOptions {
  /** Currency code (default: the configured display currency). */
  currency?: CurrencyCode
  /** Maximum fraction digits (default: configured precision; 0 for IRR/IRT). */
  max?: number
  /** Minimum fraction digits (default 0). */
  min?: number
  /** Render negatives as `-…` instead of a sign inside the number. */
  signed?: boolean
  /** Render a zero/nullish amount as an em dash. */
  dashZero?: boolean
}

/** Symbol/label per currency: prefix symbols for USD/EUR, fa suffix for ریال/تومان. */
const PREFIX: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' }
const SUFFIX: Record<string, string> = { IRR: 'ریال', IRT: 'تومان', AED: 'AED' }

/**
 * The central currency formatter: `1,000,000 ریال` · `100,000 تومان` ·
 * `$1,000` · `€1,000` · `1,000 XYZ` for unknown codes.
 */
export function formatCurrency(n: number | null | undefined, currency?: CurrencyCode, opts: Omit<MoneyOptions, 'currency'> = {}): string {
  const code = currency || DEFAULT_CURRENCY
  const zeroDecimal = code === 'IRR' || code === 'IRT'
  const { max = zeroDecimal ? 0 : DEFAULT_PRECISION, min = 0, signed = false, dashZero = false } = opts
  const v = n ?? 0
  if (dashZero && !v) return '—'
  const abs = signed ? Math.abs(v) : v
  const sign = signed && v < 0 ? '-' : ''
  const num = abs.toLocaleString(undefined, { minimumFractionDigits: min, maximumFractionDigits: max })
  if (PREFIX[code]) return `${sign}${PREFIX[code]}${num}`
  return `${sign}${num} ${SUFFIX[code] ?? code}`
}

/** Format a currency amount in the configured (or given) currency. */
export function fmtMoney(n: number | null | undefined, opts: MoneyOptions = {}): string {
  const { currency, ...rest } = opts
  return formatCurrency(n, currency, rest)
}
