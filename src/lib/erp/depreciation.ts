/**
 * Asset depreciation engine (Phase 21 ERP, Module 5 — Asset Management).
 *
 * Pure, deterministic book-value/depreciation math for the standard methods:
 *   - straight_line          equal expense each year
 *   - declining_balance      double-declining balance (200%), floored at residual
 *   - sum_of_years_digits    accelerated by remaining-life weighting
 *   - none                   no depreciation (value stays at cost)
 *
 * No DB access → fully unit-tested. The API reads asset financials and calls
 * `depreciate()`; dashboards reuse the same result (one source of truth).
 */

export const DEPRECIATION_METHODS = ['none', 'straight_line', 'declining_balance', 'sum_of_years_digits'] as const
export type DepreciationMethod = (typeof DEPRECIATION_METHODS)[number]

export interface DepreciationInput {
  purchasePrice: number
  residualValue: number
  usefulLifeYears: number
  method: DepreciationMethod
  /** Fractional years elapsed since acquisition (>= 0). */
  ageYears: number
}

export interface DepreciationResult {
  /** Current net book value (never below residual). */
  bookValue: number
  /** Total depreciation taken to date. */
  accumulated: number
  /** Depreciable base = price − residual. */
  depreciableBase: number
  /** Depreciation expense for the current year. */
  currentYearExpense: number
  /** Fraction of useful life consumed, 0..1. */
  lifeUsedPct: number
  fullyDepreciated: boolean
}

function round2(n: number): number { return Math.round(n * 100) / 100 }
function clampAge(age: number, life: number): number { return Math.max(0, Math.min(age, life)) }

/** Accumulated depreciation at an integer or fractional number of years. */
function accumulatedAt(i: DepreciationInput, age: number): number {
  const base = Math.max(0, i.purchasePrice - i.residualValue)
  const life = i.usefulLifeYears
  if (i.method === 'none' || life <= 0 || base <= 0) return 0
  const a = clampAge(age, life)

  if (i.method === 'straight_line') {
    return base * (a / life)
  }

  if (i.method === 'sum_of_years_digits') {
    const syd = (life * (life + 1)) / 2
    // Sum of per-year fractions up to full years, plus a partial current year.
    let acc = 0
    let year = 0
    for (; year < Math.floor(a); year++) {
      acc += base * ((life - year) / syd)
    }
    const frac = a - Math.floor(a)
    if (frac > 0 && year < life) acc += base * ((life - year) / syd) * frac
    return Math.min(acc, base)
  }

  // declining_balance — double declining (200%), each year on the *remaining*
  // book value, floored so it never drops below residual.
  const rate = 2 / life
  let book = i.purchasePrice
  let acc = 0
  let year = 0
  for (; year < Math.floor(a); year++) {
    const exp = Math.min(book * rate, book - i.residualValue)
    acc += Math.max(0, exp)
    book -= Math.max(0, exp)
  }
  const frac = a - Math.floor(a)
  if (frac > 0) {
    const exp = Math.min(book * rate, book - i.residualValue) * frac
    acc += Math.max(0, exp)
  }
  return Math.min(acc, base)
}

/** Compute current depreciation state for an asset. */
export function depreciate(i: DepreciationInput): DepreciationResult {
  const base = Math.max(0, i.purchasePrice - i.residualValue)
  const life = i.usefulLifeYears
  const age = clampAge(i.ageYears, life > 0 ? life : i.ageYears)

  const accumulated = round2(accumulatedAt(i, age))
  const prevYear = Math.max(0, Math.floor(age) - (age % 1 === 0 && age > 0 ? 1 : 0))
  const currentYearExpense = round2(Math.max(0, accumulated - accumulatedAt(i, prevYear)))
  const bookValue = round2(Math.max(i.residualValue, i.purchasePrice - accumulated))

  return {
    bookValue,
    accumulated,
    depreciableBase: round2(base),
    currentYearExpense,
    lifeUsedPct: life > 0 ? Math.round((age / life) * 1000) / 10 : 0,
    fullyDepreciated: base > 0 && accumulated >= base - 0.005,
  }
}

/** Years (fractional) between an ISO date and now. */
export function ageInYears(purchaseDate: string | null | undefined, now: Date = new Date()): number {
  if (!purchaseDate) return 0
  const t = new Date(purchaseDate).getTime()
  if (Number.isNaN(t)) return 0
  return Math.max(0, (now.getTime() - t) / (365.25 * 86_400_000))
}
