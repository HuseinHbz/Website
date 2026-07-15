/**
 * Phase 26.25s live-PG verification: multi-channel campaign (sms/email/whatsapp/
 * telegram sandbox) → send-decision skips → idempotent queue → telegram /start
 * link → anonymous inbound auto-lead → attribution → CAC per-channel.
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import { upsertChannel, linkTelegramChat, recordInbound, optOut } from '@/lib/crm/channelData'
import { autoLeadFromInbound } from '@/lib/crm/inboundData'
import { createCampaign, enqueueRecipients, dispatchCampaign, campaignAnalytics, updateDeliveryStatus } from '@/lib/crm/campaignData'

let n = 0, failed = 0
const ok = (c: boolean, l: string) => { n++; if (c) console.log(`  ✅ ${n}. ${l}`); else { failed++; console.error(`  ❌ ${n}. ${l}`) } }
const one = async <T>(sql: string, p: unknown[] = []) => (await pgQuery<T>(sql, p))[0]
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

async function main() {
  await runMigrations(); await seedDatabase()

  console.log('— schema + tenancy —')
  ok(Number((await one<{ n: number }>(`SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_name='crm_customer_channels' AND column_name='company_id'`)).n) === 1, 'crm_customer_channels.company_id (tenancy)')
  ok(Number((await one<{ n: number }>(`SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_name='crm_campaigns' AND column_name='channels'`)).n) === 1, 'crm_campaigns.channels (multi-channel migration)')

  console.log('— setup: customer + 4 channels —')
  const cust = await one<{ id: number }>(`INSERT INTO sales_customers (code,name,kind,email,phone,updated_at) VALUES ('C-MC','آکمه','company','mc@x.io','09121112233',${NOW}) RETURNING id`)
  // Register the customer's channels (new customers register on create; the
  // migration backfill only covers customers that existed at migration time).
  await upsertChannel(cust.id, 'sms', '09121112233')
  await upsertChannel(cust.id, 'email', 'mc@x.io')
  await upsertChannel(cust.id, 'whatsapp', '09121112233')
  await recordInbound('whatsapp', '09121112233')                 // open 24h window
  await linkTelegramChat(cust.id, '55501234')                    // only via /start path
  const chCount = Number((await one<{ n: number }>(`SELECT COUNT(*)::int AS n FROM crm_customer_channels WHERE customer_id=$1`, [cust.id])).n)
  ok(chCount === 4, `customer has ${chCount} channels (sms/email backfilled + whatsapp + telegram)`)
  ok((await one<{ address: string }>(`SELECT address FROM crm_customer_channels WHERE customer_id=$1 AND channel='telegram'`, [cust.id])).address === '55501234', 'telegram chat_id linked via /start only')

  console.log('— بند ۴.۴: multi-channel campaign → enqueue → dispatch (sandbox) —')
  const campId = await createCampaign({
    name: 'کمپین نوروزی', channels: ['sms', 'email', 'whatsapp', 'telegram'], fallbackChain: ['whatsapp', 'sms'],
    templates: { sms: { text: 'سلام' }, email: { subject: 'سلام', text: 'سلام' }, whatsapp: { text: 'سلام' }, telegram: { text: 'سلام' } }, budget: 4_000_000,
  })
  await pgQuery(`UPDATE crm_campaigns SET cost=2000000 WHERE id=$1`, [campId])
  const enq = await enqueueRecipients(campId)
  ok(enq.queued === 4, `enqueued ${enq.queued} recipients across 4 channels (WA window open → free-form ok)`)
  // Idempotency: re-enqueue inserts nothing new.
  const enq2 = await enqueueRecipients(campId)
  const recipCount = Number((await one<{ n: number }>(`SELECT COUNT(*)::int AS n FROM crm_campaign_recipients WHERE campaign_id=$1`, [campId])).n)
  ok(recipCount === 4, `re-enqueue idempotent (still ${recipCount} rows; unique (campaign,customer,channel))`)
  const disp = await dispatchCampaign(campId)
  ok(disp.sent === 4 && disp.failed === 0, `dispatched ${disp.sent} via sandbox providers (all 4 channels)`)
  const withIds = Number((await one<{ n: number }>(`SELECT COUNT(*)::int AS n FROM crm_campaign_recipients WHERE campaign_id=$1 AND provider_message_id IS NOT NULL`, [campId])).n)
  ok(withIds === 4, 'each send stored a provider_message_id (retry idempotency)')

  console.log('— opt-out blocks a channel on the next campaign —')
  await optOut('sms', '09121112233', 'test')
  const camp2 = await createCampaign({ name: 'کمپین دوم', channels: ['sms'], templates: { sms: { text: 'x' } } })
  const enq3 = await enqueueRecipients(camp2)
  ok(enq3.queued === 0 && enq3.skipped >= 1, `opted-out customer skipped on sms (queued ${enq3.queued}, skipped ${enq3.skipped})`)

  console.log('— delivery receipt from webhook —')
  const waRecip = await one<{ provider_message_id: string }>(`SELECT provider_message_id FROM crm_campaign_recipients WHERE campaign_id=$1 AND channel='whatsapp'`, [campId])
  await updateDeliveryStatus(waRecip.provider_message_id, 'delivered')
  ok((await one<{ status: string }>(`SELECT status FROM crm_campaign_recipients WHERE provider_message_id=$1`, [waRecip.provider_message_id])).status === 'delivered', 'WhatsApp delivered receipt updates recipient status')

  console.log('— بند ۴.۵: anonymous inbound → auto-lead + attribution —')
  const lead = await autoLeadFromInbound('telegram', '99900001', 'سلام قیمت؟')
  ok(lead.leadId !== undefined, `anonymous telegram inbound created lead #${lead.leadId}`)
  // dedup: same sender again → same lead
  const lead2 = await autoLeadFromInbound('telegram', '99900001', 'again')
  ok(lead2.leadId === lead.leadId, 'repeat inbound from same sender is idempotent (no twin lead)')
  // attribute a converted lead to the campaign → CAC
  await pgQuery(`UPDATE crm_leads SET campaign_id=$1, converted_customer_id=$2 WHERE id=$3`, [campId, cust.id, lead.leadId])
  const inv = await one<{ id: number }>(`INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,total,exchange_rate,updated_at) VALUES ('invoice','INV-MC-1',$1,'2026-07-14','confirmed',8000000,8000000,1,${NOW}) RETURNING id`, [cust.id])
  void inv
  const analytics = await campaignAnalytics(campId)
  ok(analytics.report.conversions === 1 && analytics.report.wonValue === 8000000, `attribution: 1 conversion, won ${analytics.report.wonValue}`)
  ok(analytics.report.cac === 2_000_000, `CAC = ${analytics.report.cac} (cost 2M / 1 conversion)`)
  ok(analytics.perChannel.length >= 4, `per-channel breakdown for ${analytics.perChannel.length} channels`)

  console.log(failed === 0 ? `\n✅ ALL ${n} PASSED` : `\n❌ ${failed}/${n} FAILED`)
  process.exit(failed ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
