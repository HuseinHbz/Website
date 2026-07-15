/**
 * Customer channel registry (Phase 26.25s بند ۴.۲/۴.۶). Manages per-customer
 * contact channels + consent/opt-out. chat_id is only ever set from the Telegram
 * /start flow (never an admin form — spoofable); last_inbound_at is set from the
 * WhatsApp webhook so the 24h window is computed server-side.
 */
import { pgQuery } from '@/lib/db'
import type { Channel } from '@/lib/messaging/provider'
import { normalizeTarget } from './campaign'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

export interface CustomerChannel {
  id: number; customerId: number; channel: Channel; address: string
  verified: number; optIn: number; optOutAt: string | null; lastInboundAt: string | null
}

export async function listChannels(customerId: number): Promise<CustomerChannel[]> {
  return (await pgQuery<Record<string, unknown>>(
    `SELECT id, customer_id AS "customerId", channel, address, verified, opt_in AS "optIn",
            opt_out_at AS "optOutAt", last_inbound_at AS "lastInboundAt"
     FROM crm_customer_channels WHERE customer_id=$1 ORDER BY channel`, [customerId])) as unknown as CustomerChannel[]
}

/** Upsert a channel (admin-safe channels only — NOT telegram chat_id). */
export async function upsertChannel(customerId: number, channel: Exclude<Channel, 'telegram'>, address: string, consentBasis = 'manual'): Promise<number> {
  const addr = channel === 'email' ? address.toLowerCase() : normalizeTarget('sms', address)
  const r = (await pgQuery<{ id: number }>(
    `INSERT INTO crm_customer_channels (customer_id, channel, address, verified, opt_in, consent_basis, updated_at)
     VALUES ($1,$2,$3,0,1,$4,${NOW})
     ON CONFLICT (channel, address) DO UPDATE SET customer_id=EXCLUDED.customer_id, updated_at=${NOW}
     RETURNING id`, [customerId, channel, addr, consentBasis]))[0]
  return r.id
}

/** Link a Telegram chat_id to a customer — ONLY called from the /start webhook. */
export async function linkTelegramChat(customerId: number, chatId: string): Promise<void> {
  await pgQuery(
    `INSERT INTO crm_customer_channels (customer_id, channel, address, verified, opt_in, consent_basis, updated_at)
     VALUES ($1,'telegram',$2,1,1,'telegram_start',${NOW})
     ON CONFLICT (channel, address) DO UPDATE SET customer_id=$1, verified=1, updated_at=${NOW}`,
    [customerId, chatId])
}

/** Record an inbound message time (drives the WhatsApp 24h window). */
export async function recordInbound(channel: Channel, address: string): Promise<void> {
  await pgQuery(`UPDATE crm_customer_channels SET last_inbound_at=${NOW}, updated_at=${NOW} WHERE channel=$1 AND address=$2`, [channel, address])
}

/** Opt a target out on a channel — writes both the channel row and the opt-out list. */
export async function optOut(channel: Channel, address: string, reason = 'user'): Promise<void> {
  const addr = channel === 'email' ? address.toLowerCase() : normalizeTarget('sms', address)
  await pgQuery(`UPDATE crm_customer_channels SET opt_in=0, opt_out_at=${NOW}, updated_at=${NOW} WHERE channel=$1 AND address=$2`, [channel, addr])
  await pgQuery(`INSERT INTO crm_optouts (channel, target, reason, created_at) VALUES ($1,$2,$3,${NOW}) ON CONFLICT (channel, target) DO NOTHING`, [channel, addr])
}

/** The server-side opt-out set for a channel (normalized targets). */
export async function optOutSet(channel: Channel): Promise<Set<string>> {
  const rows = await pgQuery<{ target: string }>(`SELECT target FROM crm_optouts WHERE channel=$1`, [channel]).catch(() => [])
  return new Set(rows.map(r => (channel === 'email' ? r.target.toLowerCase() : normalizeTarget('sms', r.target))))
}
