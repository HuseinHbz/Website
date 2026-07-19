/**
 * Concrete channel providers (Phase 26.25s بند ۴.۱): SMS (Kavenegar full, SMS.ir
 * full, Melipayamak skeleton), Email (reuses the existing nodemailer SMTP),
 * WhatsApp Cloud API (Graph), Telegram Bot API. Each implements MessageProvider;
 * with no credential the manager sandboxes them.
 */
import type { MessageProvider, OutboundMessage, SendResult, Channel } from './provider'
import { sendMail } from '@/lib/notifications'

// ── SMS · Kavenegar (real REST) ──────────────────────────────────────────────
const kavenegar: MessageProvider = {
  id: 'kavenegar', channel: 'sms',
  capabilities: () => ({ channel: 'sms', supportsTemplates: false, supportsDelivery: false, requiresChatId: false }),
  verifyConfig: cfg => !!cfg.apiKey,
  async send(msg, cfg) {
    if (!cfg.apiKey) return { ok: false, error: 'Kavenegar API key not configured' }
    try {
      const url = `https://api.kavenegar.com/v1/${encodeURIComponent(cfg.apiKey)}/sms/send.json`
      const body = new URLSearchParams({ receptor: msg.to, message: msg.text, ...(cfg.sender ? { sender: cfg.sender } : {}) })
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
      const d = await res.json()
      const id = d?.entries?.[0]?.messageid
      if (d?.return?.status === 200 && id) return { ok: true, messageId: String(id) }
      return { ok: false, error: d?.return?.message ?? `Kavenegar status ${d?.return?.status}` }
    } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'Kavenegar error' } }
  },
}

// ── SMS · SMS.ir (real REST v1) ──────────────────────────────────────────────
const smsir: MessageProvider = {
  id: 'smsir', channel: 'sms',
  capabilities: () => ({ channel: 'sms', supportsTemplates: false, supportsDelivery: false, requiresChatId: false }),
  verifyConfig: cfg => !!cfg.apiKey && !!cfg.sender,
  async send(msg, cfg) {
    if (!cfg.apiKey || !cfg.sender) return { ok: false, error: 'SMS.ir api key + line number not configured' }
    try {
      const res = await fetch('https://api.sms.ir/v1/send/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-api-key': cfg.apiKey },
        body: JSON.stringify({ lineNumber: Number(cfg.sender), messageText: msg.text, mobiles: [msg.to] }),
      })
      const d = await res.json()
      const id = d?.data?.messageIds?.[0] ?? d?.data?.packId
      if (d?.status === 1 && id != null) return { ok: true, messageId: String(id) }
      return { ok: false, error: d?.message ?? `SMS.ir status ${d?.status}` }
    } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'SMS.ir error' } }
  },
}

// ── SMS · Melipayamak (wired skeleton) ───────────────────────────────────────
const melipayamak: MessageProvider = {
  id: 'melipayamak', channel: 'sms',
  capabilities: () => ({ channel: 'sms', supportsTemplates: false, supportsDelivery: false, requiresChatId: false }),
  verifyConfig: cfg => !!cfg.apiKey,
  async send(_msg, cfg) {
    if (!cfg.apiKey) return { ok: false, error: 'Melipayamak credential not configured' }
    return { ok: false, error: 'Melipayamak adapter wired, awaiting credential (blocked-external)' }
  },
}

// ── Email · SMTP (reuses nodemailer via notifications.sendMail) ───────────────
const email: MessageProvider = {
  id: 'smtp', channel: 'email',
  capabilities: () => ({ channel: 'email', supportsTemplates: false, supportsDelivery: false, requiresChatId: false }),
  verifyConfig: () => true,
  async send(msg) {
    const r = await sendMail({ to: msg.to, subject: msg.subject ?? 'HBZ', text: msg.text, html: msg.html ?? msg.text })
    return r.ok ? { ok: true, messageId: `smtp-${Date.now()}` } : { ok: false, error: r.error }
  },
}

// ── WhatsApp · Cloud API (Graph) ─────────────────────────────────────────────
const whatsapp: MessageProvider = {
  id: 'whatsapp_cloud', channel: 'whatsapp',
  capabilities: () => ({ channel: 'whatsapp', supportsTemplates: true, supportsDelivery: true, requiresChatId: false }),
  verifyConfig: cfg => !!cfg.token && !!cfg.phoneNumberId,
  async send(msg, cfg) {
    if (!cfg.token || !cfg.phoneNumberId) return { ok: false, error: 'WhatsApp token + phone id not configured' }
    const url = `https://graph.facebook.com/v20.0/${cfg.phoneNumberId}/messages`
    const payload = msg.template
      ? { messaging_product: 'whatsapp', to: msg.to, type: 'template', template: { name: msg.template.name, language: { code: msg.template.language }, components: msg.template.params?.length ? [{ type: 'body', parameters: msg.template.params.map(t => ({ type: 'text', text: t })) }] : [] } }
      : { messaging_product: 'whatsapp', to: msg.to, type: 'text', text: { body: msg.text } }
    try {
      const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const d = await res.json()
      const id = d?.messages?.[0]?.id
      if (res.ok && id) return { ok: true, messageId: String(id) }
      return { ok: false, error: d?.error?.message ?? `WhatsApp status ${res.status}` }
    } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'WhatsApp error' } }
  },
}

// ── Telegram · Bot API ───────────────────────────────────────────────────────
const telegram: MessageProvider = {
  id: 'telegram_bot', channel: 'telegram',
  capabilities: () => ({ channel: 'telegram', supportsTemplates: false, supportsDelivery: true, requiresChatId: true }),
  verifyConfig: cfg => !!cfg.botToken,
  async send(msg, cfg) {
    if (!cfg.botToken) return { ok: false, error: 'Telegram bot token not configured' }
    try {
      const res = await fetch(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: msg.to, text: msg.text }),
      })
      const d = await res.json()
      if (d?.ok && d?.result?.message_id != null) return { ok: true, messageId: String(d.result.message_id) }
      return { ok: false, error: d?.description ?? `Telegram status ${res.status}` }
    } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'Telegram error' } }
  },
}

export const PROVIDERS: Record<string, MessageProvider> = {
  kavenegar, smsir, melipayamak, smtp: email, whatsapp_cloud: whatsapp, telegram_bot: telegram,
}

/** Deterministic per-channel sandbox — used when a channel has no credential. */
export function sandboxProvider(channel: Channel): MessageProvider {
  return {
    id: `${channel}_sandbox`, channel,
    capabilities: () => ({ channel, supportsTemplates: channel === 'whatsapp', supportsDelivery: channel === 'whatsapp' || channel === 'telegram', requiresChatId: channel === 'telegram' }),
    verifyConfig: () => false,
    async send(msg: OutboundMessage): Promise<SendResult> { return { ok: true, messageId: `SANDBOX-${channel}-${msg.to}-${Date.now()}`, sandbox: true } },
  }
}
