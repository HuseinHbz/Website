/**
 * Global ERP configuration (Phase 26.7) — key/value in `erp_settings`.
 * Currency defaults live here: the whole platform reads the default/display
 * currency from this table instead of hardcoding one. Cached briefly so hot
 * paths (document creation, dashboards) don't re-query per request.
 */
import { pgQuery } from '@/lib/db'

export interface ErpSettings {
  defaultCurrency: string
  displayCurrency: string
  decimalPrecision: number
  numberFormat: string
}

export const ERP_SETTING_KEYS = ['default_currency', 'display_currency', 'decimal_precision', 'number_format'] as const
export const SUPPORTED_CURRENCIES = ['IRR', 'IRT', 'USD', 'EUR'] as const

let cache: { at: number; value: ErpSettings } | null = null
const TTL = 30_000

export async function erpSettings(fresh = false): Promise<ErpSettings> {
  if (!fresh && cache && Date.now() - cache.at < TTL) return cache.value
  const rows = await pgQuery<{ key: string; value: string }>(`SELECT key, value FROM erp_settings`)
  const map = new Map(rows.map(r => [r.key, r.value]))
  const value: ErpSettings = {
    defaultCurrency: map.get('default_currency') || 'IRR',
    displayCurrency: map.get('display_currency') || map.get('default_currency') || 'IRR',
    decimalPrecision: Math.max(0, Math.min(4, Number(map.get('decimal_precision') ?? 0) || 0)),
    numberFormat: map.get('number_format') || 'standard',
  }
  cache = { at: Date.now(), value }
  return value
}

export async function setErpSetting(key: string, value: string): Promise<void> {
  await pgQuery(
    `INSERT INTO erp_settings (key, value, updated_at) VALUES ($1,$2, to_char(now(),'YYYY-MM-DD HH24:MI:SS'))
     ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=to_char(now(),'YYYY-MM-DD HH24:MI:SS')`, [key, value])
  cache = null
}

/** The ERP's default transaction currency (IRR unless reconfigured). */
export async function defaultCurrency(): Promise<string> {
  return (await erpSettings()).defaultCurrency
}
