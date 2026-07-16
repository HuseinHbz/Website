/**
 * Integration settings registry (Phase 26.26b, BUG-015).
 *
 * The مودیان / payment-gateway / SMS / WhatsApp / Telegram credentials all live
 * as key/value rows in `erp_settings`, but until now there was NO admin UI to
 * enter them — three phases seeded the rows and claimed "only the customer's key
 * is needed", yet a maintainer had no field to type that key into. This module
 * is the single source of truth for those fields and enforces the security
 * contract:
 *
 *   • SECRET fields are **write-only** — the API never returns the stored value,
 *     only a masked hint (`•••• 1234`) and a boolean `set`.
 *   • Non-secret fields (urls, sender ids, provider name, sandbox flag) round-trip.
 *   • Writes go through `setErpSetting` (audited by the route, value never logged).
 *
 * Pure helpers (`maskSecret`, `providerStatus`) are unit-tested; the DB reads/
 * writes live in the thin functions below.
 */
import { pgQuery } from '@/lib/db'
import { setErpSetting } from '@/lib/erp/settings'

export type FieldType = 'text' | 'url' | 'secret' | 'select' | 'bool'

export interface IntegrationField {
  key: string
  labelFa: string
  labelEn: string
  type: FieldType
  /** For `select`: allowed option values. */
  options?: { value: string; labelFa: string; labelEn: string }[]
  placeholder?: string
}

export interface IntegrationProvider {
  id: string
  titleFa: string
  titleEn: string
  descFa: string
  descEn: string
  /** Anchor id used by the onboarding wizard deep-links (#<id>). */
  anchor: string
  fields: IntegrationField[]
  /** Keys that, when all present, flip the provider from sandbox → live. */
  liveKeys: string[]
}

/** The full integration registry (drives both the API allow-list and the UI). */
export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  {
    id: 'moadian', anchor: 'moadian',
    titleFa: 'سامانه مودیان', titleEn: 'Moadian (Iran e-invoice)',
    descFa: 'سامانه صورتحساب الکترونیکی سازمان امور مالیاتی. کلید خصوصی و شناسه حافظه مالیاتی از پنل مودیان دریافت می‌شود.',
    descEn: 'Iranian tax e-invoice system. Private key + memory id come from the taxpayer panel.',
    liveKeys: ['moadian_api_url', 'moadian_memory_id', 'moadian_private_key'],
    fields: [
      { key: 'moadian_api_url', labelFa: 'آدرس API', labelEn: 'API URL', type: 'url', placeholder: 'https://tp.tax.gov.ir' },
      { key: 'moadian_memory_id', labelFa: 'شناسه حافظه مالیاتی', labelEn: 'Memory (fiscal) id', type: 'text' },
      { key: 'moadian_private_key', labelFa: 'کلید خصوصی', labelEn: 'Private key', type: 'secret' },
    ],
  },
  {
    id: 'zarinpal', anchor: 'zarinpal',
    titleFa: 'درگاه پرداخت', titleEn: 'Payment gateway',
    descFa: 'درگاه‌های پرداخت اینترنتی. مرچنت‌کد از پنل درگاه دریافت می‌شود. حالت سندباکس برای آزمایش بدون تراکنش واقعی است.',
    descEn: 'Online payment gateways. Merchant id from the gateway panel. Sandbox = test without real charges.',
    liveKeys: ['pay_zarinpal_merchant'],
    fields: [
      { key: 'pay_zarinpal_merchant', labelFa: 'مرچنت‌کد زرین‌پال', labelEn: 'Zarinpal merchant id', type: 'secret' },
      { key: 'pay_saman_merchant', labelFa: 'ترمینال سامان', labelEn: 'Saman terminal id', type: 'secret' },
      { key: 'pay_mellat_merchant', labelFa: 'ترمینال ملت', labelEn: 'Mellat terminal id', type: 'secret' },
      { key: 'pay_sandbox', labelFa: 'حالت سندباکس (آزمایشی)', labelEn: 'Sandbox mode', type: 'bool' },
    ],
  },
  {
    id: 'sms', anchor: 'sms',
    titleFa: 'پیامک', titleEn: 'SMS',
    descFa: 'ارسال پیامک برای OTP پورتال و کمپین‌ها. کلید API از پنل سامانهٔ پیامکی دریافت می‌شود.',
    descEn: 'SMS for portal OTP and campaigns. API key from the SMS provider panel.',
    liveKeys: ['sms_api_key'],
    fields: [
      { key: 'sms_provider', labelFa: 'ارائه‌دهنده', labelEn: 'Provider', type: 'select', options: [
        { value: 'kavenegar', labelFa: 'کاوه‌نگار', labelEn: 'Kavenegar' },
        { value: 'smsir', labelFa: 'اس‌ام‌اس‌دات‌آی‌آر', labelEn: 'SMS.ir' },
        { value: 'melipayamak', labelFa: 'ملی‌پیامک', labelEn: 'Melipayamak' },
      ] },
      { key: 'sms_api_key', labelFa: 'کلید API', labelEn: 'API key', type: 'secret' },
      { key: 'sms_sender', labelFa: 'شمارهٔ فرستنده', labelEn: 'Sender number', type: 'text' },
    ],
  },
  {
    id: 'whatsapp', anchor: 'whatsapp',
    titleFa: 'واتساپ (Cloud API)', titleEn: 'WhatsApp Cloud API',
    descFa: 'ارسال پیام واتساپ از طریق Cloud API متا. توکن و شناسهٔ شماره از Meta Business دریافت می‌شود.',
    descEn: 'WhatsApp messaging via Meta Cloud API. Token + phone-number id from Meta Business.',
    liveKeys: ['whatsapp_token', 'whatsapp_phone_id'],
    fields: [
      { key: 'whatsapp_token', labelFa: 'توکن دسترسی', labelEn: 'Access token', type: 'secret' },
      { key: 'whatsapp_phone_id', labelFa: 'شناسهٔ شماره', labelEn: 'Phone-number id', type: 'text' },
    ],
  },
  {
    id: 'telegram', anchor: 'telegram',
    titleFa: 'تلگرام (Bot)', titleEn: 'Telegram Bot',
    descFa: 'ربات تلگرام برای اطلاع‌رسانی و سرنخ ورودی. توکن ربات از @BotFather دریافت می‌شود.',
    descEn: 'Telegram bot for notifications + inbound leads. Bot token from @BotFather.',
    liveKeys: ['telegram_bot_token'],
    fields: [
      { key: 'telegram_bot_token', labelFa: 'توکن ربات', labelEn: 'Bot token', type: 'secret' },
    ],
  },
]

/** Every key the API is allowed to write (registry-derived allow-list). */
export const INTEGRATION_KEYS: string[] = INTEGRATION_PROVIDERS.flatMap(p => p.fields.map(f => f.key))
/** Keys whose value is a secret and must never leave the server. */
export const SECRET_KEYS: Set<string> = new Set(
  INTEGRATION_PROVIDERS.flatMap(p => p.fields.filter(f => f.type === 'secret').map(f => f.key)),
)

/** Mask a secret to a non-reversible hint: `•••• 1234` (last 4). Pure. */
export function maskSecret(value: string | undefined | null): string | null {
  if (!value) return null
  const v = String(value)
  if (v.length <= 4) return '••••'
  return `•••• ${v.slice(-4)}`
}

export interface FieldStatus {
  key: string
  set: boolean
  /** Non-secret value (round-trips) OR masked hint for secrets. Never the raw secret. */
  value: string | null
  masked: boolean
}

/** Pure: derive whether a provider is live vs sandbox from the set-keys. */
export function providerStatus(liveKeys: string[], present: Set<string>): 'live' | 'sandbox' {
  return liveKeys.every(k => present.has(k)) ? 'live' : 'sandbox'
}

/**
 * Read the masked integration status for the admin UI. Secrets are returned only
 * as a boolean + hint; non-secret values round-trip so the form can show them.
 */
export async function readIntegrationStatus(): Promise<{
  providers: { id: string; status: 'live' | 'sandbox'; fields: FieldStatus[] }[]
  fields: Record<string, FieldStatus>
}> {
  const rows = await pgQuery<{ key: string; value: string }>(
    `SELECT key, value FROM erp_settings WHERE key = ANY($1)`, [INTEGRATION_KEYS])
  const map = new Map(rows.map(r => [r.key, r.value]))
  const present = new Set(rows.filter(r => (r.value ?? '') !== '').map(r => r.key))
  const fields: Record<string, FieldStatus> = {}
  for (const key of INTEGRATION_KEYS) {
    const raw = map.get(key) ?? ''
    const secret = SECRET_KEYS.has(key)
    fields[key] = {
      key,
      set: (raw ?? '') !== '',
      value: secret ? maskSecret(raw) : (raw || null),
      masked: secret,
    }
  }
  const providers = INTEGRATION_PROVIDERS.map(p => ({
    id: p.id,
    status: providerStatus(p.liveKeys, present),
    fields: p.fields.map(f => fields[f.key]),
  }))
  return { providers, fields }
}

/** Persist one integration key (allow-list enforced). Value never logged by callers. */
export async function saveIntegrationKey(key: string, value: string): Promise<void> {
  if (!INTEGRATION_KEYS.includes(key)) throw new Error('unknown integration key')
  await setErpSetting(key, value)
}

export interface TestResult { ok: boolean; mode: 'live' | 'sandbox' | 'unconfigured'; detailFa: string; detailEn: string }

/**
 * Test a provider's configuration. Honest by design: it verifies that the
 * credentials are present and reports live vs sandbox — it does NOT claim a
 * successful remote round-trip, because the merchant/tax endpoints are
 * blocked-external until the customer's key reaches the real server. A `live`
 * result means "config complete, will use the real endpoint"; `sandbox` means
 * "will run deterministically without external calls".
 */
export async function testProvider(id: string): Promise<TestResult> {
  const { loadMoadianConfig, isMoadianLive } = await import('@/lib/erp/moadian/moadianData')
  const { resolveChannel } = await import('@/lib/messaging/manager')
  if (id === 'moadian') {
    const cfg = await loadMoadianConfig()
    const live = isMoadianLive(cfg)
    return live
      ? { ok: true, mode: 'live', detailFa: 'کلید و شناسهٔ حافظه ثبت شده‌اند؛ ارسال از endpoint واقعی مودیان انجام می‌شود.', detailEn: 'Key + memory id set; submissions use the real Moadian endpoint.' }
      : { ok: true, mode: 'sandbox', detailFa: 'کلید واقعی ثبت نشده؛ حالت سندباکس فعال است (بدون تماس خارجی).', detailEn: 'No real key set; sandbox mode (no external call).' }
  }
  if (id === 'zarinpal') {
    const rows = await pgQuery<{ key: string; value: string }>(
      `SELECT key, value FROM erp_settings WHERE key IN ('pay_zarinpal_merchant','pay_sandbox')`)
    const m = new Map(rows.map(r => [r.key, r.value]))
    const merchant = m.get('pay_zarinpal_merchant') || ''
    const sandbox = (m.get('pay_sandbox') || '') === '1' || (m.get('pay_sandbox') || '') === 'true'
    if (!merchant) return { ok: false, mode: 'unconfigured', detailFa: 'مرچنت‌کد زرین‌پال ثبت نشده است.', detailEn: 'Zarinpal merchant id not set.' }
    return sandbox
      ? { ok: true, mode: 'sandbox', detailFa: 'مرچنت‌کد ثبت شده و حالت سندباکس فعال است.', detailEn: 'Merchant set; sandbox mode active.' }
      : { ok: true, mode: 'live', detailFa: 'مرچنت‌کد ثبت شده؛ درگاه در حالت واقعی است.', detailEn: 'Merchant set; live gateway mode.' }
  }
  if (id === 'sms' || id === 'whatsapp' || id === 'telegram') {
    const channel = id === 'sms' ? 'sms' : id === 'whatsapp' ? 'whatsapp' : 'telegram'
    const r = await resolveChannel(channel)
    return r.live
      ? { ok: true, mode: 'live', detailFa: 'اعتبارنامه کامل است؛ ارسال از ارائه‌دهندهٔ واقعی انجام می‌شود.', detailEn: 'Credentials complete; will send via the real provider.' }
      : { ok: false, mode: 'sandbox', detailFa: 'اعتبارنامه ناقص است؛ حالت سندباکس (پیام واقعی ارسال نمی‌شود).', detailEn: 'Credentials incomplete; sandbox mode (no real message).' }
  }
  return { ok: false, mode: 'unconfigured', detailFa: 'ارائه‌دهندهٔ ناشناخته.', detailEn: 'Unknown provider.' }
}
