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
