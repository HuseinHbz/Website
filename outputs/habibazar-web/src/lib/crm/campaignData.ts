/**
 * Multi-channel campaign data layer (Phase 26.25s بند ۴.۴/۴.۵). Enqueues
 * recipients per channel applying the pure send-decision (opt-out, WA 24h window,
 * telegram chat_id), dispatches through the messaging manager with retry +
 * idempotency (provider_message_id, unique (campaign,customer,channel)), runs the
 * optional fallback chain, and computes per-channel attribution + CAC/ROI.
 */
import { pgQuery } from '@/lib/db'
import type { Channel } from '@/lib/messaging/provider'
import { dispatch } from '@/lib/messaging/manager'
import { decideSend, nextFallbackChannel } from '@/lib/messaging/sendDecision'
import { campaignReport } from './campaign'
import { optOutSet } from './channelData'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const num = (v: unknown) => Number(v ?? 0)
const CHANNELS: Channel[] = ['sms', 'email', 'whatsapp', 'telegram']

export interface CampaignInput {
  name: string; channels: Channel[]; fallbackChain?: Channel[]
  templates: Record<string, { text?: string; subject?: string; html?: string; waTemplate?: { name: string; language: string } }>
  budget?: number; utmSource?: string; utmMedium?: string; utmCampaign?: string; companyId?: number
}

export async function createCampaign(input: CampaignInput, userId?: string): Promise<number> {
  const r = (await pgQuery<{ id: number }>(
    `INSERT INTO crm_campaigns (name, channel, channels, fallback_chain, templates, body, budget, utm_source, utm_medium, utm_campaign, company_id, created_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,'',$6,$7,$8,$9,$10,$11,${NOW}) RETURNING id`,
    [input.name, input.channels[0] ?? 'sms', JSON.stringify(input.channels), JSON.stringify(input.fallbackChain ?? []),
     JSON.stringify(input.templates), num(input.budget), input.utmSource ?? null, input.utmMedium ?? null,
     input.utmCampaign ?? null, input.companyId ?? null, userId ?? null]))[0]
  return r.id
}

interface CampaignRow { id: number; channels: string; fallback_chain: string; templates: string }

/**
 * Enqueue every customer on every campaign channel. Applies the pure send
 * decision up front → opted-out / no-address / telegram-no-chat rows are written
 * as `skipped` with a reason (never silently dropped). Idempotent per
 * (campaign, customer, channel).
 */
export async function enqueueRecipients(campaignId: number, customerIds?: number[]): Promise<{ queued: number; skipped: number }> {
  const c = (await pgQuery<CampaignRow>(`SELECT id, channels, fallback_chain, templates FROM crm_campaigns WHERE id=$1`, [campaignId]))[0]
  if (!c) throw new Error('Campaign not found')
  const channels = JSON.parse(c.channels || '[]') as Channel[]
  const now = new Date().toISOString()
  let queued = 0, skipped = 0
  for (const channel of channels) {
    const opt = await optOutSet(channel)
    const chans = await pgQuery<{ customer_id: number; address: string; opt_in: number; last_inbound_at: string | null }>(
      `SELECT cc.customer_id, cc.address, cc.opt_in, cc.last_inbound_at
       FROM crm_customer_channels cc WHERE cc.channel=$1 ${customerIds?.length ? 'AND cc.customer_id = ANY($2)' : ''}`,
      customerIds?.length ? [channel, customerIds] : [channel])
    for (const row of chans) {
      const decision = decideSend({
        channel, address: row.address, optedOut: row.opt_in === 0 || opt.has(row.address),
        lastInboundAt: row.last_inbound_at, hasApprovedTemplate: !!JSON.parse(c.templates || '{}')?.[channel]?.waTemplate, nowIso: now,
      })
      const status = decision.send ? 'queued' : 'skipped'
      if (decision.send) queued++; else skipped++
      await pgQuery(
        `INSERT INTO crm_campaign_recipients (campaign_id, customer_id, channel, target, status, reason, queued_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,${NOW},${NOW})
         ON CONFLICT (campaign_id, customer_id, channel) DO NOTHING`,
        [campaignId, row.customer_id, channel, row.address, status, decision.reason ?? null])
    }
  }
  return { queued, skipped }
}

/**
 * Dispatch queued recipients (bounded batch). Real send via the manager; on a
 * delivery miss the fallback chain queues the next channel. provider_message_id
 * makes retries idempotent (a row already carrying an id is never re-sent).
 */
export async function dispatchCampaign(campaignId: number, limit = 200): Promise<{ sent: number; failed: number }> {
  const c = (await pgQuery<CampaignRow>(`SELECT id, channels, fallback_chain, templates FROM crm_campaigns WHERE id=$1`, [campaignId]))[0]
  if (!c) throw new Error('Campaign not found')
  const templates = JSON.parse(c.templates || '{}') as CampaignInput['templates']
  const fallback = JSON.parse(c.fallback_chain || '[]') as Channel[]
  await pgQuery(`UPDATE crm_campaigns SET status='sending', updated_at=${NOW} WHERE id=$1`, [campaignId])
  const rows = await pgQuery<{ id: number; customer_id: number; channel: Channel; target: string }>(
    `SELECT id, customer_id, channel, target FROM crm_campaign_recipients
     WHERE campaign_id=$1 AND status='queued' AND provider_message_id IS NULL LIMIT $2`, [campaignId, limit])
  let sent = 0, failed = 0
  for (const r of rows) {
    const tpl = templates[r.channel] ?? {}
    const res = await dispatch(r.channel, { to: r.target, text: tpl.text ?? '', subject: tpl.subject, html: tpl.html, template: tpl.waTemplate ? { name: tpl.waTemplate.name, language: tpl.waTemplate.language } : undefined })
    if (res.ok) {
      sent++
      await pgQuery(`UPDATE crm_campaign_recipients SET status='sent', provider_message_id=$2, sent_at=${NOW} WHERE id=$1`, [r.id, res.messageId ?? `x-${Date.now()}`])
    } else {
      failed++
      const next = nextFallbackChannel(fallback, r.channel, false)
      await pgQuery(`UPDATE crm_campaign_recipients SET status='failed', reason=$2, retry_count=retry_count+1 WHERE id=$1`, [r.id, res.error ?? 'send failed'])
      if (next) {
        const alt = (await pgQuery<{ address: string }>(`SELECT address FROM crm_customer_channels WHERE customer_id=$1 AND channel=$2 AND opt_in=1 LIMIT 1`, [r.customer_id, next]))[0]
        if (alt) await pgQuery(
          `INSERT INTO crm_campaign_recipients (campaign_id, customer_id, channel, target, status, reason, queued_at, created_at)
           VALUES ($1,$2,$3,$4,'queued','fallback',${NOW},${NOW}) ON CONFLICT (campaign_id, customer_id, channel) DO NOTHING`,
          [campaignId, r.customer_id, next, alt.address])
      }
    }
  }
  const pending = num((await pgQuery<{ n: number }>(`SELECT COUNT(*)::int AS n FROM crm_campaign_recipients WHERE campaign_id=$1 AND status='queued'`, [campaignId]))[0]?.n)
  if (pending === 0) await pgQuery(`UPDATE crm_campaigns SET status='done', updated_at=${NOW} WHERE id=$1`, [campaignId])
  return { sent, failed }
}

/** Delivery/read status from a webhook (WhatsApp/Telegram) by provider_message_id. */
export async function updateDeliveryStatus(providerMessageId: string, status: 'delivered' | 'read'): Promise<void> {
  const col = status === 'read' ? 'read_at' : 'delivered_at'
  await pgQuery(`UPDATE crm_campaign_recipients SET status=$2, ${col}=${NOW} WHERE provider_message_id=$1`, [providerMessageId, status])
}

/** Per-channel + overall campaign report with CAC/ROI (بند ۴.۵). */
export async function campaignAnalytics(campaignId: number) {
  const byChannel = await pgQuery<{ channel: string; sent: number; delivered: number; read: number; failed: number; skipped: number }>(
    `SELECT channel,
       COUNT(*) FILTER (WHERE status IN ('sent','delivered','read'))::int AS sent,
       COUNT(*) FILTER (WHERE status IN ('delivered','read'))::int AS delivered,
       COUNT(*) FILTER (WHERE status='read')::int AS read,
       COUNT(*) FILTER (WHERE status='failed')::int AS failed,
       COUNT(*) FILTER (WHERE status='skipped')::int AS skipped
     FROM crm_campaign_recipients WHERE campaign_id=$1 GROUP BY channel`, [campaignId])
  const leads = num((await pgQuery<{ n: number }>(`SELECT COUNT(*)::int AS n FROM crm_leads WHERE campaign_id=$1`, [campaignId]))[0]?.n)
  const conv = num((await pgQuery<{ n: number }>(`SELECT COUNT(*)::int AS n FROM crm_leads WHERE campaign_id=$1 AND converted_customer_id IS NOT NULL`, [campaignId]))[0]?.n)
  const wonValue = num((await pgQuery<{ v: number }>(
    `SELECT COALESCE(SUM(sd.total*sd.exchange_rate),0)::float AS v FROM sales_documents sd
     JOIN crm_leads l ON l.converted_customer_id=sd.customer_id
     WHERE l.campaign_id=$1 AND sd.doc_type='invoice' AND sd.status NOT IN ('void','draft')`, [campaignId]))[0]?.v)
  const cost = num((await pgQuery<{ v: number }>(`SELECT cost::float AS v FROM crm_campaigns WHERE id=$1`, [campaignId]))[0]?.v)
  const totalSent = byChannel.reduce((s, c) => s + num(c.sent), 0)
  const report = campaignReport({ sent: totalSent, failed: byChannel.reduce((s, c) => s + num(c.failed), 0), skippedOptOut: byChannel.reduce((s, c) => s + num(c.skipped), 0), leads, conversions: conv, wonValue, cost })
  const perChannel = byChannel.map(c => ({ channel: c.channel, sent: num(c.sent), delivered: num(c.delivered), read: num(c.read), failed: num(c.failed), skipped: num(c.skipped), costShare: totalSent > 0 ? Math.round((cost * num(c.sent) / totalSent) * 100) / 100 : 0 }))
  return { report, perChannel, channels: CHANNELS }
}
