/**
 * Enterprise Tax Engine (Phase 26) — pure, deterministic, unit-tested.
 *
 * Computes VAT, withholding and custom taxes over a taxable base, supporting tax
 * groups (several taxes applied together), exemptions and inclusive/exclusive
 * pricing. Iran's standard VAT (9%) is the built-in default. Country-specific
 * regimes extend by adding `TaxRule`s — no code change needed. Distinct from the
 * simple per-line `taxPct` in `sales.ts`: this is the reusable rules engine.
 */

export type TaxKind = 'vat' | 'withholding' | 'custom'

export interface TaxRule {
  code: string
  nameEn: string
  nameFa: string
  kind: TaxKind
  /** Percent (e.g. 9 for 9%). */
  rate: number
  /** Withholding reduces the payable; VAT/custom add to it. */
  enabled?: boolean
}

/** Iran standard VAT. */
export const IRAN_VAT: TaxRule = { code: 'VAT', nameEn: 'Value Added Tax', nameFa: 'مالیات بر ارزش افزوده', kind: 'vat', rate: 9, enabled: true }
export const BUILTIN_TAXES: TaxRule[] = [
  IRAN_VAT,
  { code: 'WHT5', nameEn: 'Withholding 5%', nameFa: 'مالیات تکلیفی ۵٪', kind: 'withholding', rate: 5, enabled: true },
  { code: 'WHT10', nameEn: 'Withholding 10%', nameFa: 'مالیات تکلیفی ۱۰٪', kind: 'withholding', rate: 10, enabled: true },
]

const round2 = (n: number) => Math.round(n * 100) / 100
const clampRate = (r: number) => (r < 0 ? 0 : r > 100 ? 100 : r)

export interface TaxLineResult {
  code: string
  kind: TaxKind
  rate: number
  /** Signed amount: positive adds (VAT/custom), negative reduces (withholding). */
  amount: number
}
export interface TaxResult {
  base: number
  lines: TaxLineResult[]
  /** Σ of additive taxes (VAT + custom). */
  taxTotal: number
  /** Σ of withholding (positive magnitude). */
  withholdingTotal: number
  /** base + taxTotal − withholdingTotal. */
  grandTotal: number
}

/**
 * Apply a set of tax rules to a taxable base. `exempt` short-circuits to zero
 * taxes. VAT/custom add; withholding subtracts. All amounts rounded to 2 dp.
 */
export function computeTaxes(base: number, rules: TaxRule[], opts: { exempt?: boolean } = {}): TaxResult {
  const lines: TaxLineResult[] = []
  let taxTotal = 0, withholdingTotal = 0
  if (!opts.exempt) {
    for (const r of rules) {
      if (r.enabled === false) continue
      const amt = round2(base * clampRate(r.rate) / 100)
      if (r.kind === 'withholding') { withholdingTotal += amt; lines.push({ code: r.code, kind: r.kind, rate: r.rate, amount: -amt }) }
      else { taxTotal += amt; lines.push({ code: r.code, kind: r.kind, rate: r.rate, amount: amt }) }
    }
  }
  taxTotal = round2(taxTotal); withholdingTotal = round2(withholdingTotal)
  return { base: round2(base), lines, taxTotal, withholdingTotal, grandTotal: round2(base + taxTotal - withholdingTotal) }
}

/**
 * Given a tax-inclusive gross and a single VAT rate, back out the net base and
 * the embedded tax (e.g. a retail price that already includes VAT).
 */
export function extractInclusive(gross: number, rate: number): { net: number; tax: number } {
  const r = clampRate(rate) / 100
  const net = round2(gross / (1 + r))
  return { net, tax: round2(gross - net) }
}

/** Single-tax convenience (the common VAT case). */
export function vatOf(base: number, rate = IRAN_VAT.rate): number {
  return round2(base * clampRate(rate) / 100)
}
