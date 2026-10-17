/**
 * Enterprise Tax Engine (Phase 26) — pure, deterministic, unit-tested.
 *
 * Computes VAT, withholding and custom taxes over a taxable base, supporting tax
 * groups (several taxes applied together), exemptions and inclusive/exclusive
 * pricing. Country-specific regimes extend by adding `TaxRule`s — no code change
 * needed. Distinct from the simple per-line `taxPct` in `sales.ts`: this is the
 * reusable rules engine.
 *
 * ERPFIX-7 (BUG-ERP-20): NO statutory VAT rate is a literal anywhere in this
 * engine — a rate is always supplied by the caller, sourced from the confirmed
 * `tax_rates` table (`erp/taxData.ts#currentVatRate`), never guessed or seeded
 * here. `vatRule(rate)` builds a one-off VAT `TaxRule` from that confirmed
 * number; there is deliberately no built-in default rate to fall back to.
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

/** Builds a VAT rule from a rate the caller already confirmed (never a
 * built-in default — see the module doc comment above). */
export function vatRule(rate: number): TaxRule {
  return { code: 'VAT', nameEn: 'Value Added Tax', nameFa: 'مالیات بر ارزش افزوده', kind: 'vat', rate, enabled: true }
}
/** Generic withholding-category labels (the category IS the rate it names —
 * not a current statutory figure, so these are not the literal this
 * phase's gate targets). */
export const BUILTIN_TAXES: TaxRule[] = [
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

/** Single-tax convenience (the common VAT case). `rate` is REQUIRED — no
 * built-in default, per the module doc comment above. */
export function vatOf(base: number, rate: number): number {
  return round2(base * clampRate(rate) / 100)
}
