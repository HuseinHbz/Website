/**
 * Currency data layer (Phase 26) — PostgreSQL access for currencies + rates.
 * The pure math lives in `currency.ts`; this only reads/writes the tables.
 */
import { pgQuery } from '@/lib/db'
import type { RateMap } from './currency'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

export interface CurrencyRow {
  code: string; nameEn: string; nameFa: string; symbolEn: string; symbolFa: string
  decimals: number; isBase: boolean; active: boolean; latestRate: number | null; rateDate: string | null
}

/** All currencies with their latest known Rial rate (base_rate). */
export async function listCurrencies(): Promise<CurrencyRow[]> {
  return pgQuery<CurrencyRow>(`
    SELECT c.code, c.name_en AS "nameEn", c.name_fa AS "nameFa", c.symbol_en AS "symbolEn",
           c.symbol_fa AS "symbolFa", c.decimals, c.is_base AS "isBase", c.active,
           r.base_rate AS "latestRate", r.rate_date AS "rateDate"
    FROM erp_currencies c
    LEFT JOIN LATERAL (
      SELECT base_rate, rate_date FROM erp_exchange_rates e
      WHERE e.code = c.code ORDER BY rate_date DESC LIMIT 1
    ) r ON true
    ORDER BY c.is_base DESC, c.code`)
}

/** Latest rate per currency as a RateMap (Rial value of one unit). IRR always 1. */
export async function latestRates(): Promise<RateMap> {
  const rows = await pgQuery<{ code: string; base_rate: number }>(`
    SELECT DISTINCT ON (code) code, base_rate
    FROM erp_exchange_rates ORDER BY code, rate_date DESC`)
  const map: RateMap = { IRR: 1, IRT: 10 }
  for (const r of rows) map[r.code] = Number(r.base_rate)
  return map
}

/** Historical rate series for a currency. */
export async function rateHistory(code: string, limit = 60) {
  return pgQuery<{ rate_date: string; base_rate: number }>(
    `SELECT rate_date, base_rate FROM erp_exchange_rates WHERE code=$1 ORDER BY rate_date DESC LIMIT $2`, [code, limit])
}

/** Upsert a rate for a currency on a date (Rial value of one unit). */
export async function setRate(code: string, rateDate: string, baseRate: number, userId?: string) {
  await pgQuery(
    `INSERT INTO erp_exchange_rates (code, rate_date, base_rate, created_by, created_at)
     VALUES ($1,$2,$3,$4,${NOW})
     ON CONFLICT (code, rate_date) DO UPDATE SET base_rate=EXCLUDED.base_rate`,
    [code, rateDate, baseRate, userId ?? null])
}

/**
 * Rial rate of one unit of `code` (Phase 26.7 — multi-currency transactions).
 * IRR=1 and IRT=10 are exact; other codes use the latest configured daily
 * rate. Returns null when no rate exists so callers can reject honestly
 * instead of silently booking a 1:1 conversion.
 */
export async function rialRateFor(code: string): Promise<number | null> {
  if (code === 'IRR') return 1
  if (code === 'IRT') return 10
  const row = (await pgQuery<{ base_rate: number }>(
    `SELECT base_rate FROM erp_exchange_rates WHERE code=$1 ORDER BY rate_date DESC LIMIT 1`, [code]))[0]
  return row ? Number(row.base_rate) : null
}
