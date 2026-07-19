/**
 * Send-decision engine (Phase 26.25s بند ۴.۳/۴.۴) — PURE, server-side, cannot be
 * bypassed from the UI. Decides whether a recipient may be messaged on a channel
 * and (for WhatsApp) in which mode, applies the opt-out block, and drives the
 * optional fallback chain + retry backoff. Fully unit-testable (no I/O).
 */
import type { Channel } from './provider'

export const WHATSAPP_WINDOW_HOURS = 24

/** Is the WhatsApp 24-hour customer-service window open (last inbound < 24h ago)? */
export function whatsappWindowOpen(lastInboundAt: string | null | undefined, nowIso: string): boolean {
  if (!lastInboundAt) return false
  const diffH = (Date.parse(nowIso) - Date.parse(lastInboundAt)) / 3_600_000
  return diffH >= 0 && diffH < WHATSAPP_WINDOW_HOURS
}

export interface SendContext {
  channel: Channel
  address: string | null
  optedOut: boolean
  lastInboundAt?: string | null
  hasApprovedTemplate?: boolean
  nowIso: string
}

export type SendMode = 'freeform' | 'template'
export interface SendDecision {
  send: boolean
  mode?: SendMode
  reason?: string
}

/**
 * The one place that decides if a message goes out. Opt-out always wins.
 * Telegram needs a chat_id; WhatsApp outside its 24h window needs an approved
 * template (free-form is rejected, never blindly attempted).
 */
export function decideSend(ctx: SendContext): SendDecision {
  if (!ctx.address) return { send: false, reason: ctx.channel === 'telegram' ? 'no_chat_id' : 'no_address' }
  if (ctx.optedOut) return { send: false, reason: 'opted_out' }
  if (ctx.channel === 'telegram') return { send: true, mode: 'freeform' }
  if (ctx.channel === 'whatsapp') {
    if (whatsappWindowOpen(ctx.lastInboundAt, ctx.nowIso)) return { send: true, mode: 'freeform' }
    if (ctx.hasApprovedTemplate) return { send: true, mode: 'template' }
    return { send: false, reason: 'outside_24h_window_no_template' }
  }
  return { send: true, mode: 'freeform' }   // sms / email
}

/** Exponential backoff (seconds) for provider 429 / transient failures. */
export function backoffSeconds(retry: number, baseSec = 2, capSec = 900): number {
  return Math.min(capSec, baseSec * 2 ** Math.max(0, retry))
}

/**
 * Next channel in a campaign's fallback chain after `current` fails to DELIVER.
 * Returns null when the chain is exhausted. The chain is an ordered channel list.
 */
export function nextFallbackChannel(chain: Channel[], current: Channel, delivered: boolean): Channel | null {
  if (delivered) return null
  const i = chain.indexOf(current)
  if (i < 0 || i + 1 >= chain.length) return null
  return chain[i + 1]
}
