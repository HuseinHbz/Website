/**
 * Messaging manager (Phase 26.25s بند ۴.۱). Loads per-channel provider config
 * from erp_settings (env vars as fallback — 6.5) and dispatches through the
 * chosen provider, falling back to the deterministic sandbox when a channel is
 * not configured (never silently drops). One entry point for OTP + campaigns.
 */
import { pgQuery } from '@/lib/db'
import type { Channel, MessageConfig, OutboundMessage, SendResult } from './provider'
import { PROVIDERS, sandboxProvider } from './channels'

async function settings(keys: string[]): Promise<Map<string, string>> {
  const rows = await pgQuery<{ key: string; value: string }>(
    `SELECT key, value FROM erp_settings WHERE key = ANY($1)`, [keys]).catch(() => [])
  return new Map(rows.map(r => [r.key, r.value]))
}
const pick = (m: Map<string, string>, k: string, env?: string) => (m.get(k) || (env ? process.env[env] : '') || '')

export interface ChannelResolution { providerId: string; cfg: MessageConfig; live: boolean }

/** Resolve the provider id + config + whether it is really configured. */
export async function resolveChannel(channel: Channel): Promise<ChannelResolution> {
  if (channel === 'sms') {
    const s = await settings(['sms_provider', 'sms_api_key', 'sms_sender'])
    const providerId = s.get('sms_provider') || 'kavenegar'
    const apiKey = pick(s, 'sms_api_key', providerId === 'smsir' ? 'SMSIR_API_KEY' : 'KAVENEGAR_API_KEY')
    const cfg: MessageConfig = { apiKey, sender: s.get('sms_sender') || '' }
    const p = PROVIDERS[providerId]
    return { providerId, cfg, live: !!p && p.verifyConfig(cfg) }
  }
  if (channel === 'email') {
    // Email reuses nodemailer/SMTP; when no SMTP host is configured it falls back
    // to the deterministic sandbox (like the other channels) — never a silent drop.
    const s = await pgQuery<{ value: string }>(`SELECT value FROM site_settings WHERE key='smtp_host'`).catch(() => [])
    return { providerId: 'smtp', cfg: {}, live: !!s[0]?.value }
  }
  if (channel === 'whatsapp') {
    const s = await settings(['whatsapp_token', 'whatsapp_phone_id'])
    const cfg: MessageConfig = { token: pick(s, 'whatsapp_token', 'WHATSAPP_TOKEN'), phoneNumberId: pick(s, 'whatsapp_phone_id', 'WHATSAPP_PHONE_ID') }
    return { providerId: 'whatsapp_cloud', cfg, live: PROVIDERS.whatsapp_cloud.verifyConfig(cfg) }
  }
  const s = await settings(['telegram_bot_token'])
  const cfg: MessageConfig = { botToken: pick(s, 'telegram_bot_token', 'TELEGRAM_BOT_TOKEN') }
  return { providerId: 'telegram_bot', cfg, live: PROVIDERS.telegram_bot.verifyConfig(cfg) }
}

/**
 * Send one message on a channel. Uses the real provider when configured, else the
 * deterministic sandbox (result carries `sandbox:true`). Email always attempts
 * real SMTP (returns not-configured cleanly). Never throws.
 */
export async function dispatch(channel: Channel, msg: OutboundMessage): Promise<SendResult & { providerId: string; live: boolean }> {
  const r = await resolveChannel(channel)
  const provider = r.live ? PROVIDERS[r.providerId] : sandboxProvider(channel)
  const res = await provider.send(msg, r.cfg)
  return { ...res, providerId: provider.id, live: r.live }
}
