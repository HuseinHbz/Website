/**
 * ERPFIX-4 (BUG-ERP-18) — shared zod primitives for financial API input.
 * Before this, purchasing/sales/finance routes each hand-rolled their own
 * loose schemas: `qty`/`unitPrice` with no sign check, `discountPct`/
 * `taxPct` with no 0–100 cap, `date` as free-text `z.string().max(20)`, and
 * a `?id=` query param read as `Number(sp.get('id'))` — a bogus value
 * became `NaN`, which then hit PostgreSQL and surfaced as a raw 500 instead
 * of a 400 naming the field. One shared module closes the whole class.
 */
import { z } from 'zod'

/** A monetary amount: finite, non-negative, capped at a sane ceiling (10^15
 * Rial — comfortably above any real transaction, well below float-precision
 * loss). Use `.negative()`-free; callers that genuinely need a signed amount
 * (e.g. a credit-note adjustment) use `signedMoney` instead. */
export const money = z.number().finite().min(0).max(1_000_000_000_000_000)
/** A strictly-positive monetary amount (a payment, a received quantity's
 * value) — same ceiling as `money`, zero excluded. */
export const positiveMoney = z.number().finite().positive().max(1_000_000_000_000_000)
/** A signed monetary amount (credit notes / reversals) — same bounds, both signs. */
export const signedMoney = z.number().finite().min(-1_000_000_000_000_000).max(1_000_000_000_000_000)
/** A line quantity — must be strictly positive (a zero-qty line is meaningless;
 * removing a line means omitting it, not sending qty:0). */
export const qty = z.number().finite().positive().max(1_000_000_000)
/** A percentage field (discount/tax) — bounded 0–100, matching every real
 * percentage this codebase charges or discounts by. */
export const pct = z.number().finite().min(0).max(100)
/** An ISO calendar date (YYYY-MM-DD) that is also a REAL date — '2024-02-30'
 * is rejected, not just pattern-matched. */
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD').refine(s => {
  const d = new Date(s + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}, 'Not a real calendar date')
/** A 3-letter currency code — format-checked here; callers that can reach the
 * DB may additionally check it against `erp_currencies` (active codes). */
export const currencyCode = z.string().regex(/^[A-Z]{3}$/, 'Expected a 3-letter currency code')
/** A positive integer id coerced from a query-string value — `?id=abc` or
 * `?id=-1` now fails validation with a named field instead of becoming NaN
 * and hitting Postgres as a raw, unexplained 500. */
export const idParam = z.coerce.number().int().positive()

/** Parse a single query-string id param; returns a zod safe-parse result the
 * caller can branch on the same way readJson's callers already do. */
export function parseIdParam(raw: string | null) {
  return idParam.safeParse(raw)
}
