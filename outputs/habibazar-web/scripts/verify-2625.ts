/**
 * Phase 26.25 live-PG verification (foundation slice): schema applies, credit
 * guard + AR aging over real posted invoices, Customer 360 aggregation, SMS
 * sandbox, campaign opt-out. Exercises the built data layers against real PG.
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import { postSalesInvoiceToGl } from '@/lib/erp/salesData'
import { customer360, evaluateCredit, customerArBalance } from '@/lib/crm/customer360Data'
import { sendSms } from '@/lib/messaging/sms/smsData'
import { canSend, normalizeTarget } from '@/lib/crm/campaign'

let n = 0, failed = 0
const ok = (c: boolean, l: string) => { n++; if (c) console.log(`  ✅ ${n}. ${l}`); else { failed++; console.error(`  ❌ ${n}. ${l}`) } }
const one = async <T>(sql: string, p: unknown[] = []) => (await pgQuery<T>(sql, p))[0]
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

async function main() {
  await runMigrations(); await seedDatabase()
  const ADMIN = (await one<{ id: string }>(`SELECT id FROM users ORDER BY created_at LIMIT 1`)).id

  console.log('— بند ۱: schema + tenancy on new CRM tables —')
  for (const t of ['crm_tickets', 'crm_campaigns', 'crm_campaign_recipients']) {
    const c = await one<{ n: number }>(`SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_name=$1 AND column_name='company_id'`, [t])
    ok(Number(c.n) === 1, `${t}.company_id exists (tenancy)`)
  }
  const pt = await one<{ n: number }>(`SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_name='sales_customers' AND column_name='payment_terms'`)
  ok(Number(pt.n) === 1, 'sales_customers.payment_terms exists')

  console.log('— setup: customer with a credit limit + a confirmed+posted invoice —')
  const today = new Date().toISOString().slice(0, 10)
  const overdue = '2026-04-01'
  const cust = await one<{ id: number }>(`INSERT INTO sales_customers (code,name,kind,email,phone,credit_limit,payment_terms,updated_at) VALUES ('C-360','مشتری ۳۶۰','company','c360@x.io','09121234567',15000000,30,${NOW}) RETURNING id`)
  const inv = await one<{ id: number }>(
    `INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,due_date,status,subtotal,discount_total,tax_total,total,updated_at)
     VALUES ('invoice','INV-360-1',$1,$2,$3,'confirmed',10000000,0,0,10000000,${NOW}) RETURNING id`, [cust.id, overdue, overdue])
  await pgQuery(`INSERT INTO sales_document_lines (document_id,description,qty,unit_price,discount_pct,tax_pct,line_total,line_no) VALUES ($1,'کالا',1,10000000,0,0,10000000,0)`, [inv.id])
  await postSalesInvoiceToGl(inv.id, ADMIN)

  console.log('— بند ۱.۲: AR balance + aging —')
  const bal = await customerArBalance(cust.id)
  ok(bal === 10000000, `AR balance = ${bal} (unpaid invoice)`)
  const c360 = await customer360(cust.id, today)
  ok(c360 !== null && c360.aging.d90plus === 10000000, `aging bucket 90+ = ${c360?.aging.d90plus} (invoice due ${overdue})`)
  ok(c360!.purchaseTotal === 10000000, `purchase history total = ${c360!.purchaseTotal}`)
  ok(c360!.timeline.length >= 1, `unified timeline has ${c360!.timeline.length} events`)

  console.log('— بند ۱.۳: credit guard (limit 15M, balance 10M) —')
  const under = await evaluateCredit(cust.id, 4000000)   // 10M+4M=14M < 15M
  ok(!under.exceeded && under.allowed, `+4M within limit → allowed (projected ${under.projected})`)
  const over = await evaluateCredit(cust.id, 9000000)    // 10M+9M=19M > 15M
  ok(over.exceeded, `+9M exceeds limit → flagged (projected ${over.projected} > ${over.limit})`)
  ok(over.mode === 'warn' && over.allowed, 'default mode=warn → allowed + alert (not blocked)')

  console.log('— بند ۲/۴: SMS sandbox + opt-out —')
  const sms = await sendSms('09121234567', 'کد تأیید شما: ۱۲۳۴۵۶')
  ok(sms.ok && sms.sandbox === true, `SMS sandbox send ok (id ${sms.messageId?.slice(0, 12)}…) — no key → blocked-external sandbox`)
  await pgQuery(`INSERT INTO crm_optouts (channel,target,reason,created_at) VALUES ('sms','09121234567','user opt-out',${NOW})`)
  const opt = new Set((await pgQuery<{ target: string }>(`SELECT target FROM crm_optouts WHERE channel='sms'`)).map(r => normalizeTarget('sms', r.target)))
  ok(!canSend('sms', '+989121234567', opt), 'opt-out blocks the customer (server-side, normalized match)')
  ok(canSend('sms', '09120000000', opt), 'a non-opted-out number is sendable')

  console.log(failed === 0 ? `\n✅ ALL ${n} PASSED` : `\n❌ ${failed}/${n} FAILED`)
  process.exit(failed ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
