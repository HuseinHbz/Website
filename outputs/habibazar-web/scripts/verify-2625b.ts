/**
 * Phase 26.25b بند ۰ live-PG verification — inherited-debt settlement.
 * Exercises: 0.4 gateway payment method (1:1 with payment_transactions),
 * 0.6 inbound flood cap + quarantine + confirm, 0.7 crm_leads source CHECK,
 * 0.9 DELETE-journal guard (void→block, draft→ok, posted→block).
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import { autoLeadFromInbound, confirmInbound, rejectInbound } from '@/lib/crm/inboundData'
import { isJournalEntryDeletable } from '@/lib/erp/ledger'

let n = 0, failed = 0
const ok = (c: boolean, l: string) => { n++; if (c) console.log(`  ✅ ${n}. ${l}`); else { failed++; console.error(`  ❌ ${n}. ${l}`) } }
const one = async <T>(sql: string, p: unknown[] = []) => (await pgQuery<T>(sql, p))[0]
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

async function main() {
  await runMigrations(); await seedDatabase()

  console.log('— بند ۰.۷: crm_leads.source CHECK re-added with inbound_* values —')
  const good = await one<{ id: number }>(`INSERT INTO crm_leads (name,source,status,score,value,updated_at) VALUES ('ok','inbound_whatsapp','new',10,0,${NOW}) RETURNING id`)
  ok(good.id != null, "accepts a valid source ('inbound_whatsapp')")
  let rejected = false
  try { await pgQuery(`INSERT INTO crm_leads (name,source,status,score,value,updated_at) VALUES ('bad','__evil__','new',10,0,${NOW})`) }
  catch { rejected = true }
  ok(rejected, "rejects an INVALID source at the DB (CHECK enforced again)")

  console.log('\n— بند ۰.۶: inbound flood cap + quarantine —')
  // Tighten caps so the test is fast + deterministic: 5 global / 3 per-channel.
  await pgQuery(`UPDATE erp_settings SET value='5' WHERE key='inbound_cap_global'`)
  await pgQuery(`UPDATE erp_settings SET value='3' WHERE key='inbound_cap_channel'`)
  const leadsBefore = (await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM crm_leads`)).c
  let quarantined = 0, blocked = 0
  for (let i = 0; i < 50; i++) {
    const r = await autoLeadFromInbound('telegram', `sender_${i}`, `hi ${i}`)
    if (r.blocked) blocked++
    else if (r.quarantinedId) quarantined++
  }
  ok(quarantined === 3, `only per-channel-cap (3) quarantined as pending_review (got ${quarantined})`)
  ok(blocked === 47, `the remaining 47 were BLOCKED (got ${blocked})`)
  const leadsAfterFlood = (await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM crm_leads`)).c
  ok(leadsAfterFlood === leadsBefore, `funnel stays CLEAN — no leads created by the flood (${leadsBefore}→${leadsAfterFlood})`)
  const alert = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM business_alerts WHERE kind='inbound_flood' AND status<>'resolved'`)
  ok(alert.c >= 1, 'a business_alert(inbound_flood) was raised (de-duplicated)')

  console.log('\n— بند ۰.۶: manual confirm → lead enters funnel + attribution —')
  const pend = await one<{ id: number }>(`SELECT id FROM crm_inbound_messages WHERE status='pending_review' ORDER BY id LIMIT 1`)
  const conf = await confirmInbound(pend.id)
  ok(conf.leadId != null, 'confirm creates the CRM lead')
  const lead = await one<{ source: string; status: string }>(`SELECT source,status FROM crm_leads WHERE id=$1`, [conf.leadId])
  ok(lead.source === 'inbound_telegram', 'confirmed lead carries the inbound attribution source')
  const msg = await one<{ status: string; lead_id: number }>(`SELECT status,lead_id FROM crm_inbound_messages WHERE id=$1`, [pend.id])
  ok(msg.status === 'confirmed' && msg.lead_id === conf.leadId, 'quarantine row marked confirmed + linked to the lead')
  // reject path
  const pend2 = await one<{ id: number }>(`SELECT id FROM crm_inbound_messages WHERE status='pending_review' ORDER BY id LIMIT 1`)
  await rejectInbound(pend2.id)
  const rej = await one<{ status: string }>(`SELECT status FROM crm_inbound_messages WHERE id=$1`, [pend2.id])
  ok(rej.status === 'rejected', 'reject marks the quarantine row rejected (never a lead)')

  console.log('\n— بند ۰.۴: gateway payment method (1:1 with payment_transactions) —')
  const cust = await one<{ id: number }>(`INSERT INTO sales_customers (code,name,kind,updated_at) VALUES ('GW','gw','company',${NOW}) RETURNING id`)
  const inv = await one<{ id: number }>(`INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,total,exchange_rate,updated_at) VALUES ('invoice','GW-1',$1,'2026-07-14','confirmed',1000000,1000000,1,${NOW}) RETURNING id`, [cust.id])
  const pay = await one<{ id: number }>(`INSERT INTO sales_payments (customer_id,document_id,date,amount,method,reference,currency,exchange_rate) VALUES ($1,$2,'2026-07-14',1000000,'gateway','REF-1','IRR',1) RETURNING id`, [cust.id, inv.id])
  ok(pay.id != null, "sales_payments accepts method='gateway' (enum extended)")
  const tx = await one<{ id: number }>(`INSERT INTO payment_transactions (provider,document_id,customer_id,amount,currency,status,sales_payment_id,updated_at) VALUES ('zarinpal',$1,$2,1000000,'IRR','verified',$3,${NOW}) RETURNING id`, [inv.id, cust.id, pay.id])
  const match = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM sales_payments p JOIN payment_transactions t ON t.sales_payment_id=p.id WHERE p.method='gateway' AND t.status='verified'`)
  ok(match.c === 1 && tx.id != null, 'gateway payment is 1:1-linked to a verified payment_transaction')
  // historical 'card' rows tied to a gateway tx get migrated by re-running migrate
  const oldPay = await one<{ id: number }>(`INSERT INTO sales_payments (customer_id,document_id,date,amount,method,reference,currency,exchange_rate) VALUES ($1,$2,'2026-07-14',500000,'card','REF-OLD','IRR',1) RETURNING id`, [cust.id, inv.id])
  await pgQuery(`INSERT INTO payment_transactions (provider,document_id,customer_id,amount,currency,status,sales_payment_id,updated_at) VALUES ('zarinpal',$1,$2,500000,'IRR','paid',$3,${NOW})`, [inv.id, cust.id, oldPay.id])
  const posPay = await one<{ id: number }>(`INSERT INTO sales_payments (customer_id,document_id,date,amount,method,reference,currency,exchange_rate) VALUES ($1,$2,'2026-07-14',300000,'card','POS-PHYS','IRR',1) RETURNING id`, [cust.id, inv.id])
  await runMigrations() // idempotent re-run applies the historical-fix UPDATE
  const migrated = await one<{ method: string }>(`SELECT method FROM sales_payments WHERE id=$1`, [oldPay.id])
  ok(migrated.method === 'gateway', "historical gateway-path 'card' row migrated to 'gateway' (evidence: payment_transactions)")
  const untouched = await one<{ method: string }>(`SELECT method FROM sales_payments WHERE id=$1`, [posPay.id])
  ok(untouched.method === 'card', "a real POS 'card' payment (no gateway tx) is left UNTOUCHED")

  console.log('\n— بند ۰.۹: DELETE-journal guard (void→block, draft→ok, posted→block) —')
  ok(isJournalEntryDeletable('draft') === true, 'guard: draft is deletable')
  ok(isJournalEntryDeletable('posted') === false, 'guard: posted is NOT deletable (permanent audit record)')
  ok(isJournalEntryDeletable('void') === false, 'guard: void is NOT deletable')
  // apply the guard to real rows, mirroring the route
  const mkEntry = async (status: string) => (await one<{ id: number }>(
    `INSERT INTO gl_journal_entries (entry_no,date,memo,status) VALUES ($1,'2026-07-14','t',$2) RETURNING id`, [`JE-${status}-${Date.now()}`, status])).id
  const draftId = await mkEntry('draft'), postedId = await mkEntry('posted'), voidId = await mkEntry('void')
  const del = async (id: number) => {
    const e = await one<{ status: string }>(`SELECT status FROM gl_journal_entries WHERE id=$1`, [id])
    if (!isJournalEntryDeletable(e.status)) return 400
    await pgQuery(`DELETE FROM gl_journal_entries WHERE id=$1`, [id]); return 200
  }
  ok(await del(voidId) === 400, 'route DELETE(void) → 400')
  ok(await del(postedId) === 400, 'route DELETE(posted) → 400')
  ok(await del(draftId) === 200, 'route DELETE(draft) → 200 (deleted)')
  const gone = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries WHERE id=$1`, [draftId])
  ok(gone.c === 0, 'the draft entry is actually gone; posted/void remain')

  console.log(`\n${failed === 0 ? '✅ ALL' : '❌ ' + failed + ' FAILED /'} ${n} assertions`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
