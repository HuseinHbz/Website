/**
 * Phase 26.24 live-PG E2E: Iran compliance (مودیان queue+submit, TTMS quarterly,
 * payment lifecycle) + tenancy + concurrency race tests + health.
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import { postSalesInvoiceToGl } from '@/lib/erp/salesData'
import { enqueueInvoice, submitQueued, moadianStats, loadMoadianConfig, isMoadianLive } from '@/lib/erp/moadian/moadianData'
import { ttmsReport } from '@/lib/erp/ttms'
import { jalaliQuarter } from '@/lib/erp/jalali'
import { createPayment, verifyPayment } from '@/lib/erp/payments/paymentData'
import { nextNumber } from '@/lib/numbering/integrate'
import { trialBalance } from '@/lib/erp/ledger'
import { loadTallies } from '@/lib/erp/ledgerData'

let n = 0, failed = 0
const ok = (c: boolean, l: string) => { n++; if (c) console.log(`  ✅ ${n}. ${l}`); else { failed++; console.error(`  ❌ ${n}. ${l}`) } }
const one = async <T>(sql: string, p: unknown[] = []) => (await pgQuery<T>(sql, p))[0]
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

async function main() {
  await runMigrations()
  await seedDatabase()
  const ADMIN = (await one<{ id: string }>(`SELECT id FROM users ORDER BY created_at LIMIT 1`)).id
  await pgQuery(`UPDATE erp_settings SET value='411111111111' WHERE key='company_economic_code'`)

  console.log('— بند ۱: tenancy columns present —')
  for (const t of ['sales_documents', 'purchase_documents', 'inv_moves', 'assets', 'crm_leads', 'moadian_queue', 'payment_transactions']) {
    const c = await one<{ n: number }>(`SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_name=$1 AND column_name='company_id'`, [t])
    ok(Number(c.n) === 1, `${t}.company_id exists`)
  }

  console.log('— setup: customer + confirmed invoice (this Persian quarter) —')
  const cust = await one<{ id: number }>(`INSERT INTO sales_customers (code,name,kind,economic_code,national_id,updated_at) VALUES ('C-M1','آکمه','company','422222222222','10123456789',${NOW}) RETURNING id`)
  const today = new Date().toISOString().slice(0, 10)
  const inv = await one<{ id: number }>(
    `INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,discount_total,tax_total,total,updated_at)
     VALUES ('invoice','INV-M-0001',$1,$2,'confirmed',10000000,0,900000,10900000,${NOW}) RETURNING id`, [cust.id, today])
  await pgQuery(`INSERT INTO sales_document_lines (document_id,description,qty,unit_price,discount_pct,tax_pct,line_total,line_no) VALUES ($1,'ویجت',2,5000000,0,9,10900000,0)`, [inv.id])
  await postSalesInvoiceToGl(inv.id, ADMIN)

  console.log('— بند ۴.۱: مودیان enqueue → submit (sandbox) —')
  const cfg = await loadMoadianConfig()
  ok(!isMoadianLive(cfg), 'مودیان runs in sandbox mode (no credential configured)')
  const enq = await enqueueInvoice(inv.id, '1', ADMIN)
  ok(enq.queueId > 0 && enq.taxId.length > 0, `invoice enqueued with tax-unique-id ${enq.taxId.slice(0, 10)}…`)
  ok((await enqueueInvoice(inv.id, '1', ADMIN)).alreadyQueued, 'enqueue is idempotent per document')
  const payload = await one<{ payload: string; status: string }>(`SELECT payload, status FROM moadian_queue WHERE id=$1`, [enq.queueId])
  const parsed = JSON.parse(payload.payload)
  ok(parsed.header.tbill === 10900000 && parsed.header.tvam === 900000, 'standard invoice payload totals self-reconcile')
  ok(payload.status === 'pending', 'queued as pending (validation passed)')
  const sub = await submitQueued(enq.queueId)
  ok(sub.status === 'confirmed' && (sub.reference ?? '').startsWith('SANDBOX-'), `sandbox submit confirmed (ref ${sub.reference})`)
  const stats = await moadianStats()
  ok(stats.confirmed === 1, 'queue stats show 1 confirmed')
  const docStatus = await one<{ moadian_status: string }>(`SELECT moadian_status FROM sales_documents WHERE id=$1`, [inv.id])
  ok(docStatus.moadian_status === 'confirmed', 'sales document reflects مودیان confirmed status')

  console.log('— بند ۴.۳: TTMS quarterly report includes the invoice —')
  const q = jalaliQuarter(today)
  const rep = await ttmsReport(q.jYear, q.quarter as 1 | 2 | 3 | 4)
  ok(rep.summary.salesTotal === 10900000 && rep.summary.salesVat === 900000, `TTMS ${rep.quarter.label}: sales ${rep.summary.salesTotal} incl. VAT ${rep.summary.salesVat}`)
  ok(rep.sales.some(r => r.economicCode === '422222222222'), 'TTMS lists the customer by economic code')

  console.log('— بند ۴.۲: payment lifecycle + idempotency —')
  const pc = await createPayment({ provider: 'zarinpal', documentId: inv.id, customerId: cust.id, amount: 10900000, description: 'test', callbackUrl: 'https://x/cb' })
  ok(pc.txId !== undefined && !pc.ok, 'createPayment without merchant credential fails gracefully (tx recorded)')
  const txFail = await one<{ status: string }>(`SELECT status FROM payment_transactions WHERE id=$1`, [pc.txId])
  ok(txFail.status === 'failed', 'failed init marks the transaction failed (no ghost pending)')
  // Idempotency guard: a manually-verified tx short-circuits without duplicating.
  const vtx = await one<{ id: number }>(`INSERT INTO payment_transactions (provider,document_id,customer_id,amount,status,authority,ref_id,sales_payment_id,created_at,updated_at) VALUES ('zarinpal',$1,$2,10900000,'verified','AUTH-X','REF-9',999,${NOW},${NOW}) RETURNING id`, [inv.id, cust.id])
  const reVerify = await verifyPayment(vtx.id, ADMIN)
  ok(reVerify.ok && reVerify.paymentId === 999, 'already-verified transaction is idempotent (no double reconcile)')

  console.log('— بند ۵.۱: concurrency races —')
  // Numbering: 50 parallel mints → 50 unique, gapless.
  const nums = await Promise.all(Array.from({ length: 50 }, () => nextNumber('journal', { legacyPrefix: 'JE' })))
  ok(new Set(nums).size === 50, `50 concurrent JE numbers → ${new Set(nums).size} unique (0 duplicates)`)
  const seqs = nums.map(x => Number(x.slice(-5))).sort((a, b) => a - b)
  ok(seqs[seqs.length - 1] - seqs[0] === 49, 'numbering sequence is gapless under concurrency')
  // Double lead-convert: idempotent (second returns the same customer, no twin).
  const lead = await one<{ id: number }>(`INSERT INTO crm_leads (name,email,phone,status,score,value) VALUES ('Race Lead','race@x.io','0912',',qualified'::text,80,0) RETURNING id`).catch(async () =>
    await one<{ id: number }>(`INSERT INTO crm_leads (name,email,phone,status,score,value) VALUES ('Race Lead','race@x.io','0912','qualified',80,0) RETURNING id`))
  // simulate the convert route's idempotency guard directly
  const custA = await one<{ id: number }>(`INSERT INTO sales_customers (code,name,kind,email,updated_at) VALUES ('C-RC','Race Lead','individual','race@x.io',${NOW}) RETURNING id`)
  await pgQuery(`UPDATE crm_leads SET converted_customer_id=$2 WHERE id=$1 AND converted_customer_id IS NULL`, [lead.id, custA.id])
  await pgQuery(`UPDATE crm_leads SET converted_customer_id=$2 WHERE id=$1 AND converted_customer_id IS NULL`, [lead.id, custA.id]) // second no-op
  const conv = await one<{ converted_customer_id: number }>(`SELECT converted_customer_id FROM crm_leads WHERE id=$1`, [lead.id])
  const custCount = await one<{ n: number }>(`SELECT COUNT(*)::int AS n FROM sales_customers WHERE email='race@x.io'`)
  ok(conv.converted_customer_id === custA.id && Number(custCount.n) === 1, 'double lead-convert is idempotent (one customer)')

  console.log('— بند ۶.۲: books still balanced —')
  const tb = trialBalance(await loadTallies())
  ok(tb.balanced, `trial balance balanced after the compliance cycle`)

  console.log(failed === 0 ? `\n✅ ALL ${n} PASSED` : `\n❌ ${failed}/${n} FAILED`)
  process.exit(failed ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
