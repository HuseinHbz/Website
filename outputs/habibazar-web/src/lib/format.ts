/**
 * Shared display formatters (Phase 24 — de-duplication).
 *
 * Consolidates the seven near-identical `money()` helpers that had drifted across
 * the admin ERP/CRM/dashboard modules into one options-driven formatter. Each
 * previous call site maps to an explicit option set so output is byte-for-byte
 * preserved (fraction digits, signed negatives, dash-for-zero).
 */

export interface MoneyOptions {
  /** Maximum fraction digits (default 0). */
  max?: number
  /** Minimum fraction digits (default 0). */
  min?: number
  /** Render negatives as `-$…` instead of `$-…`. */
  signed?: boolean
  /** Render a zero/nullish amount as an em dash. */
  dashZero?: boolean
}

/** Format a currency amount as `$1,234.56`. See {@link MoneyOptions}. */
export function fmtMoney(n: number | null | undefined, opts: MoneyOptions = {}): string {
  const { max = 0, min = 0, signed = false, dashZero = false } = opts
  const v = n ?? 0
  if (dashZero && !v) return '—'
  const abs = signed ? Math.abs(v) : v
  const sign = signed && v < 0 ? '-' : ''
  return `${sign}$${abs.toLocaleString(undefined, { minimumFractionDigits: min, maximumFractionDigits: max })}`
}
