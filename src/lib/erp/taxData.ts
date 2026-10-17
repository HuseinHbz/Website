/**
 * Tax-profile data layer (Phase 26.9) — reusable named tax setups over the pure
 * `tax.ts` engine. A profile bundles a VAT rate + withholding rate + exemption
 * + category; `computeProfile` runs the real engine so preview and posting
 * share one calculation.
 */
import { pgQuery } from '@/lib/db'
import { computeTaxes, type TaxRule } from './tax'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

export interface TaxProfile {
  id: number; code: string; nameEn: string; nameFa: string
  category: string; vatRate: number; withholdingRate: number; exempt: boolean; active: boolean
}

export async function listTaxProfiles(): Promise<TaxProfile[]> {
  return (await pgQuery(
    `SELECT id, code, name_en AS "nameEn", name_fa AS "nameFa", category,
            vat_rate::float AS "vatRate", withholding_rate::float AS "withholdingRate", exempt, active
     FROM tax_profiles ORDER BY code`)) as unknown as TaxProfile[]
}

export async function saveTaxProfile(p: {
  id?: number; code: string; nameEn: string; nameFa: string; category: string
  vatRate: number; withholdingRate: number; exempt: boolean; active?: boolean
}, userId?: string): Promise<number> {
  if (p.id) {
    await pgQuery(
      `UPDATE tax_profiles SET code=$2, name_en=$3, name_fa=$4, category=$5, vat_rate=$6, withholding_rate=$7, exempt=$8, active=$9, updated_at=${NOW} WHERE id=$1`,
      [p.id, p.code, p.nameEn, p.nameFa, p.category, p.vatRate, p.withholdingRate, p.exempt, p.active ?? true])
    return p.id
  }
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO tax_profiles (code, name_en, name_fa, category, vat_rate, withholding_rate, exempt, active, created_by, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,${NOW},${NOW}) RETURNING id`,
    [p.code, p.nameEn, p.nameFa, p.category, p.vatRate, p.withholdingRate, p.exempt, p.active ?? true, userId ?? null]))[0]
  return row.id
}

export async function deleteTaxProfile(id: number) {
  await pgQuery(`DELETE FROM tax_profiles WHERE id=$1`, [id])
}

/** Build engine rules from a profile and compute the tax on a base amount. */
export function computeProfile(profile: TaxProfile, base: number) {
  const rules: TaxRule[] = []
  if (profile.vatRate > 0) rules.push({ code: 'VAT', nameEn: 'VAT', nameFa: 'ارزش افزوده', kind: 'vat', rate: profile.vatRate, enabled: true })
  if (profile.withholdingRate > 0) rules.push({ code: 'WHT', nameEn: 'Withholding', nameFa: 'تکلیفی', kind: 'withholding', rate: profile.withholdingRate, enabled: true })
  return computeTaxes(base, rules, { exempt: profile.exempt })
}

// ── Statutory VAT rate (ERPFIX-7, BUG-ERP-20) ───────────────────────────────
// A VAT rate is a statutory figure — never hardcoded, never guessed, never
// seeded. `tax_rates` holds a (code, rate, effective_from) history; a row
// only counts once an accountant/the maintainer CONFIRMS it. Every call site
// that needs the active rate must go through `currentVatRate` and must
// FAIL CLOSED (not silently default to some number) when nothing is
// confirmed yet for the requested date.
export class VatRateNotConfirmedError extends Error {
  constructor() { super('ERP-TAX-VAT-RATE-NOT-CONFIRMED: no confirmed VAT rate is on file for this date') }
}

export interface TaxRateRow { id: number; code: string; rate: number; effectiveFrom: string; confirmed: boolean; confirmedBy: string | null; confirmedAt: string | null }

export async function listTaxRates(code = 'VAT'): Promise<TaxRateRow[]> {
  return (await pgQuery(
    `SELECT id, code, rate::float AS rate, effective_from AS "effectiveFrom", confirmed, confirmed_by AS "confirmedBy", confirmed_at AS "confirmedAt"
     FROM tax_rates WHERE code=$1 ORDER BY effective_from DESC`, [code])) as unknown as TaxRateRow[]
}

/** The confirmed rate in force on `asOf` (default: today). Throws
 * `VatRateNotConfirmedError` — never returns a guessed default — if no
 * confirmed row's effective_from is on or before that date. */
export async function currentVatRate(asOf?: string): Promise<{ rate: number; effectiveFrom: string }> {
  const date = asOf ?? new Date().toISOString().slice(0, 10)
  const row = (await pgQuery<{ rate: number; effective_from: string }>(
    `SELECT rate::float AS rate, effective_from FROM tax_rates
     WHERE code='VAT' AND confirmed=true AND effective_from <= $1
     ORDER BY effective_from DESC LIMIT 1`, [date]))[0]
  if (!row) throw new VatRateNotConfirmedError()
  return { rate: row.rate, effectiveFrom: row.effective_from }
}

/** Create a new VAT rate row and confirm it in one step — the ONLY path a
 * rate reaches `confirmed=true`; a prior confirmed row is left untouched
 * (history preserved, same append-only discipline as every other statutory
 * table in this codebase). */
export async function confirmVatRate(rate: number, effectiveFrom: string, userId?: string): Promise<number> {
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO tax_rates (code, rate, effective_from, confirmed, confirmed_by, confirmed_at, created_by)
     VALUES ('VAT',$1,$2,true,$3,${NOW},$3) RETURNING id`,
    [rate, effectiveFrom, userId ?? null]))[0]
  return row.id
}
