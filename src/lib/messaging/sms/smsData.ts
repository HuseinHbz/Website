/**
 * SMS send data layer (Phase 26.25 بند ۴). Loads provider config from
 * erp_settings and dispatches through the chosen provider — with a deterministic
 * sandbox when no api key is set (never silently drops). Used by portal OTP and
 * the campaign queue.
 */
import { pgQuery } from '@/lib/db'
import { getSmsProvider, type SmsResult, type SmsConfig } from './provider'

export async function loadSmsConfig(): Promise<{ provider: string; cfg: SmsConfig; live: boolean }> {
  const rows = await pgQuery<{ key: string; value: string }>(
    `SELECT key, value FROM erp_settings WHERE key IN ('sms_provider','sms_api_key','sms_sender')`)
  const map = new Map(rows.map(r => [r.key, r.value]))
  const apiKey = map.get('sms_api_key') || ''
  return {
    provider: map.get('sms_provider') || 'kavenegar',
    cfg: { apiKey, sender: map.get('sms_sender') || '' },
    live: apiKey.length > 0,
  }
}

/** Send one SMS. Falls back to the deterministic sandbox provider when no key. */
export async function sendSms(to: string, message: string): Promise<SmsResult> {
  const { provider, cfg, live } = await loadSmsConfig()
  const p = getSmsProvider(live ? provider : 'sandbox')
  return p.send(to, message, cfg)
}
