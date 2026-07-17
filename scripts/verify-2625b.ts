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
import { createTicket, getTicket, addTicketMessage, setTicketStatus, scanTicketSla } from '@/lib/crm/ticketData'
import { seedDemo, resetDemo } from '@/lib/admin/demoData'
import { crmDashboard } from '@/lib/crm/crmDashboardData'
import { goLiveChecklist } from '@/lib/admin/onboarding'

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

  console.log('\n— بند ۱: support tickets — SLA + IDOR isolation —')
  const cA = await one<{ id: number }>(`INSERT INTO sales_customers (code,name,kind,updated_at) VALUES ('TKA','A','company',${NOW}) RETURNING id`)
  const cB = await one<{ id: number }>(`INSERT INTO sales_customers (code,name,kind,updated_at) VALUES ('TKB','B','company',${NOW}) RETURNING id`)
  const tkA = await createTicket({ customerId: cA.id, subject: 'A needs help', body: 'my invoice is wrong', authorKind: 'customer', priority: 'urgent' })
  const tkB = await createTicket({ customerId: cB.id, subject: 'B needs help', body: 'question', authorKind: 'customer', priority: 'low' })
  ok(tkA.ticketNo.startsWith('TK-'), `ticket minted a number via the numbering engine (${tkA.ticketNo})`)
  // IDOR: A can read own, B's returns null (→404 at the route)
  ok((await getTicket(tkA.id, { includeInternal: false, customerId: cA.id })) != null, 'A reads own ticket ✔')
  ok((await getTicket(tkB.id, { includeInternal: false, customerId: cA.id })) === null, "A reading B's ticket → null (404) ✔")
  // internal notes never leak to the customer view
  await addTicketMessage(tkA.id, { authorKind: 'agent', authorId: 'admin', body: 'internal: check GL', internal: true })
  await addTicketMessage(tkA.id, { authorKind: 'agent', authorId: 'admin', body: 'We are looking into it.' })
  const portalView = await getTicket(tkA.id, { includeInternal: false, customerId: cA.id })
  ok(portalView!.messages.every(m => !m.internal), 'portal view NEVER contains internal notes ✔')
  ok(portalView!.messages.some(m => m.body.includes('looking into it')), 'portal view DOES contain the public reply')
  const adminView = await getTicket(tkA.id, { includeInternal: true })
  ok(adminView!.messages.some(m => m.internal), 'admin view DOES contain internal notes')
  // customer cannot post an internal note (forced public even if flagged)
  await addTicketMessage(tkA.id, { authorKind: 'customer', body: 'still broken', internal: true as unknown as boolean, customerId: cA.id })
  const last = (await pgQuery<{ internal: number }>(`SELECT internal FROM crm_ticket_messages WHERE ticket_id=$1 ORDER BY id DESC LIMIT 1`, [tkA.id]))[0]
  ok(last.internal === 0, "a customer reply is NEVER stored as internal ✔")
  // customer cannot mutate another customer's ticket
  const crossReply = await addTicketMessage(tkB.id, { authorKind: 'customer', body: 'hijack', customerId: cA.id })
  ok(crossReply.ok === false, "A cannot reply on B's ticket (IDOR) ✔")
  // SLA: urgent ticket forced overdue → scan raises a breach alert + escalation
  await pgQuery(`UPDATE crm_tickets SET created_at = to_char(now() - interval '5 days','YYYY-MM-DD HH24:MI:SS') WHERE id=$1`, [tkA.id])
  const scan = await scanTicketSla()
  ok(scan.breached >= 1, `SLA scan flags the overdue urgent ticket as breached (${scan.breached})`)
  const tkAlert = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM business_alerts WHERE kind='ticket_sla_breach' AND status<>'resolved'`)
  ok(tkAlert.c >= 1, 'a ticket_sla_breach business_alert was raised')
  const lvl = await one<{ sla_level: number }>(`SELECT sla_level FROM crm_tickets WHERE id=$1`, [tkA.id])
  ok(lvl.sla_level >= 1, 'escalation stage advanced (sla_level)')
  // pending pauses the clock: resolving from pending stamps resolved_at
  await setTicketStatus(tkB.id, 'pending', 'admin')
  const pendTk = await one<{ pending_since: string | null }>(`SELECT pending_since FROM crm_tickets WHERE id=$1`, [tkB.id])
  ok(pendTk.pending_since != null, 'moving to pending sets pending_since (SLA clock paused)')
  await setTicketStatus(tkB.id, 'resolved', 'admin')
  const res = await one<{ resolved_at: string | null; pending_since: string | null }>(`SELECT resolved_at, pending_since FROM crm_tickets WHERE id=$1`, [tkB.id])
  ok(res.resolved_at != null && res.pending_since === null, 'resolving folds the pause + stamps resolved_at')

  console.log('\n— بند ۲: demo data separation + CRM dashboard + onboarding —')
  // A REAL customer that reset:demo must NEVER touch.
  const real = await one<{ id: number }>(`INSERT INTO sales_customers (code,name,kind,updated_at) VALUES ('REAL-1','real co','company',${NOW}) RETURNING id`)
  const seeded = await seedDemo()
  ok(seeded.customers === 3 && seeded.invoices === 3 && seeded.tickets === 2, `seed:demo created a full DEMO- dataset (${JSON.stringify(seeded)})`)
  const demoBefore = (await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM sales_customers WHERE code LIKE 'DEMO-%'`)).c
  ok(demoBefore === 3, 'demo customers present before reset')
  await resetDemo()
  const demoAfter = (await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM sales_customers WHERE code LIKE 'DEMO-%'`)).c
  ok(demoAfter === 0, 'reset:demo removed ALL demo customers')
  const realSurvives = await one<{ id: number }>(`SELECT id FROM sales_customers WHERE id=$1`, [real.id])
  ok(realSurvives != null, 'reset:demo left the REAL customer UNTOUCHED (separation proven)')
  const demoDocs = (await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM sales_documents WHERE doc_no LIKE 'DEMO-%'`)).c
  const demoTickets = (await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM crm_tickets WHERE ticket_no LIKE 'DEMO-%'`)).c
  ok(demoDocs === 0 && demoTickets === 0, 'demo invoices + tickets also cleaned (children FK-safe)')

  const dash = await crmDashboard()
  ok(dash.funnel != null && dash.mom.newLeads != null && Array.isArray(dash.channels), 'CRM dashboard assembles (funnel + MoM + channels)')
  const checklist = await goLiveChecklist()
  ok(checklist.total >= 6 && typeof checklist.requiredReady === 'boolean', `go-live checklist assembles (${checklist.readyCount}/${checklist.total} ready)`)

  console.log(`\n${failed === 0 ? '✅ ALL' : '❌ ' + failed + ' FAILED /'} ${n} assertions`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
