/**
 * Inbound message handling (Phase 26.25s بند ۴.۵, hardened in 26.25b بند ۰.۶).
 *
 * Public webhooks (WhatsApp/Telegram) let ANYONE inject inbound messages. The
 * original code auto-created a CRM lead for every unknown sender — so a script
 * rotating the sender id could mint thousands of fake leads, saturate the SLA
 * alert queue and poison CAC/attribution. Hardened behaviour:
 *   • Known-customer inbound  → returns the customer, no lead (unchanged).
 *   • Unknown inbound         → QUARANTINED into `crm_inbound_messages`
 *       (status='pending_review'). It does NOT enter the CRM funnel or CAC until
 *       an operator confirms it (`confirmInbound`), which then creates the lead.
 *   • A configurable per-window rate cap (global + per-channel, erp_settings)
 *       blocks excess inbound (status='blocked') and raises a business_alert once.
 */
import { pgQuery } from '@/lib/db'
import type { Channel } from '@/lib/messaging/provider'
import { parseCaps, inboundRateExceeded, type InboundCaps } from './inboundPolicy'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

async function loadCaps(): Promise<InboundCaps> {
  const rows = await pgQuery<{ key: string; value: string }>(
    `SELECT key, value FROM erp_settings WHERE key IN ('inbound_cap_global','inbound_cap_channel','inbound_cap_window')`)
  const g = (k: string) => rows.find(r => r.key === k)?.value
  return parseCaps({ global: g('inbound_cap_global'), channel: g('inbound_cap_channel'), window: g('inbound_cap_window') })
}

async function windowCounts(channel: Channel, windowMinutes: number): Promise<{ global: number; channel: number }> {
  const glob = (await pgQuery<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM crm_inbound_messages WHERE created_at > to_char(now() - ($1 || ' minutes')::interval,'YYYY-MM-DD HH24:MI:SS')`,
    [String(windowMinutes)]))[0]?.c ?? 0
  const chan = (await pgQuery<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM crm_inbound_messages WHERE channel=$1 AND created_at > to_char(now() - ($2 || ' minutes')::interval,'YYYY-MM-DD HH24:MI:SS')`,
    [channel, String(windowMinutes)]))[0]?.c ?? 0
  return { global: glob, channel: chan }
}

async function raiseFloodAlert(channel: Channel, reason: 'global' | 'channel', count: number): Promise<void> {
  const fingerprint = `inbound_flood:${reason === 'channel' ? channel : 'global'}`
  await pgQuery(
    `INSERT INTO business_alerts (kind, domain, severity, title_en, title_fa, detail, metric_value, ref_type, channels, fingerprint, updated_at)
     VALUES ('inbound_flood','operational','warning',$1,$2,$3,$4,'inbound','["inapp"]',$5,${NOW})
     ON CONFLICT (fingerprint) DO UPDATE SET metric_value=EXCLUDED.metric_value, detail=EXCLUDED.detail, updated_at=${NOW},
       status=CASE WHEN business_alerts.status='resolved' THEN 'open' ELSE business_alerts.status END`,
    [
      reason === 'channel' ? `Inbound ${channel} rate cap exceeded` : 'Inbound message rate cap exceeded',
      reason === 'channel' ? `سقف نرخ پیام ورودی ${channel} رد شد` : 'سقف نرخ پیام ورودی رد شد',
      `${count} inbound messages in the current window (${reason} cap)`, count, fingerprint,
    ])
}

export interface InboundResult { customerId?: number; leadId?: number; quarantinedId?: number; blocked?: boolean }

export async function autoLeadFromInbound(channel: Channel, address: string, text?: string): Promise<InboundResult> {
  // Known customer → attribute to them, never a lead.
  const known = (await pgQuery<{ customer_id: number }>(
    `SELECT customer_id FROM crm_customer_channels WHERE channel=$1 AND address=$2 LIMIT 1`, [channel, address]))[0]
  if (known) return { customerId: known.customer_id }

  // Already have a confirmed lead for this sender → return it (idempotent).
  const existingLead = (await pgQuery<{ id: number }>(
    `SELECT id FROM crm_leads WHERE source=$1 AND (phone=$2 OR email=$2) LIMIT 1`, [`inbound_${channel}`, address]))[0]
  if (existingLead) return { leadId: existingLead.id }

  // Already quarantined + still pending → collapse to the same record (idempotent).
  const pending = (await pgQuery<{ id: number }>(
    `SELECT id FROM crm_inbound_messages WHERE channel=$1 AND address=$2 AND status='pending_review' ORDER BY id DESC LIMIT 1`,
    [channel, address]))[0]
  if (pending) return { quarantinedId: pending.id }

  // Rate cap: block excess inbound + raise a single de-duplicated alert.
  const caps = await loadCaps()
  const counts = await windowCounts(channel, caps.windowMinutes)
  const verdict = inboundRateExceeded(counts.global, counts.channel, caps)
  if (verdict.exceeded) {
    await pgQuery(
      `INSERT INTO crm_inbound_messages (channel, address, body, status, updated_at) VALUES ($1,$2,$3,'blocked',${NOW})`,
      [channel, address, (text ?? '').slice(0, 500)])
    await raiseFloodAlert(channel, verdict.reason!, verdict.reason === 'channel' ? counts.channel : counts.global)
    return { blocked: true }
  }

  // Quarantine — stored, but NOT in the funnel/CAC until an operator confirms.
  const q = (await pgQuery<{ id: number }>(
    `INSERT INTO crm_inbound_messages (channel, address, body, status, updated_at) VALUES ($1,$2,$3,'pending_review',${NOW}) RETURNING id`,
    [channel, address, (text ?? '').slice(0, 500)]))[0]
  return { quarantinedId: q.id }
}

/** Operator confirms a quarantined inbound → creates the real lead (enters funnel/CAC). */
export async function confirmInbound(id: number): Promise<{ leadId?: number; already?: boolean }> {
  const msg = (await pgQuery<{ id: number; channel: Channel; address: string; body: string | null; status: string; lead_id: number | null }>(
    `SELECT id, channel, address, body, status, lead_id FROM crm_inbound_messages WHERE id=$1`, [id]))[0]
  if (!msg || msg.status === 'confirmed') return { already: true, leadId: msg?.lead_id ?? undefined }

  // Reuse a customer/lead if the sender is now known.
  const known = (await pgQuery<{ customer_id: number }>(
    `SELECT customer_id FROM crm_customer_channels WHERE channel=$1 AND address=$2 LIMIT 1`, [msg.channel, msg.address]))[0]
  const existing = (await pgQuery<{ id: number }>(
    `SELECT id FROM crm_leads WHERE source=$1 AND (phone=$2 OR email=$2) LIMIT 1`, [`inbound_${msg.channel}`, msg.address]))[0]
  let leadId = existing?.id
  if (!known && !leadId) {
    const isPhone = msg.channel === 'sms' || msg.channel === 'whatsapp'
    leadId = (await pgQuery<{ id: number }>(
      `INSERT INTO crm_leads (name, ${isPhone ? 'phone' : 'email'}, source, status, score, value, notes, updated_at)
       VALUES ($1,$2,$3,'new',10,0,$4,${NOW}) RETURNING id`,
      [`Inbound ${msg.channel} ${msg.address}`, msg.address, `inbound_${msg.channel}`, (msg.body ?? '').slice(0, 500)]))[0].id
  }
  await pgQuery(`UPDATE crm_inbound_messages SET status='confirmed', lead_id=$2, updated_at=${NOW} WHERE id=$1`, [id, leadId ?? null])
  return { leadId }
}

export async function rejectInbound(id: number): Promise<void> {
  await pgQuery(`UPDATE crm_inbound_messages SET status='rejected', updated_at=${NOW} WHERE id=$1`, [id])
}

export async function listQuarantine(status = 'pending_review') {
  return pgQuery(
    `SELECT id, channel, address, body, status, lead_id AS "leadId", created_at AS "createdAt"
     FROM crm_inbound_messages WHERE status=$1 ORDER BY id DESC LIMIT 200`, [status])
}
