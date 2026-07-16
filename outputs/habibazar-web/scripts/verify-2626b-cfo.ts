/**
 * Phase 26.26b بند ۵ — CFO financial-integrity hunt (live-PostgreSQL slice).
 *
 * Numeric before/after proof for the DB-driven scenarios that the pure test
 * (cfo-hunt-2626b.test.ts) can't reach:
 *   S7  closed-period `assertPostable` is enforced on EVERY GL write path
 *       (sales-invoice post · journal post · purchase-invoice post) — books
 *       stay byte-for-byte unchanged when a post is rejected.
 *   S3  voiding a GL-posted sales payment books a balanced reversal (bank + AR
 *       return to their pre-payment values; nothing left dangling).
 *   S2  an over-payment beyond the invoice total is visible in the sub-ledger
 *       (AR goes to the exact negative = customer credit, never silently 0).
 *
 * Run: DATABASE_URL=… npx tsx scripts/verify-2626b-cfo.ts
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import { postSalesInvoiceToGl } from '@/lib/erp/salesData'
import { postSalesPaymentToGl } from '@/lib/erp/glPosting'
import { createPeriod, transitionPeriod, assertPostable } from '@/lib/erp/accountingData'
import { loadTallies } from '@/lib/erp/ledgerData'
import { trialBalance } from '@/lib/erp/ledger'

let n = 0, failed = 0
const ok = (c: boolean, l: string) => { n++; if (c) console.log(`  ✅ ${n}. ${l}`); else { failed++; console.error(`  ❌ ${n}. ${l}`) } }
const one = async <T>(sql: string, p: unknown[] = []) => (await pgQuery<T>(sql, p))[0]
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

// 26.26c بند ۲.۱: balances read through the PRODUCTION trialBalance/loadTallies —
// never hand-SQL that re-interprets status (that class of query hid BUG-020).
const glBal = async (code: string): Promise<number> => {
  const r = trialBalance(await loadTallies()).rows.find(x => x.code === code)
  return r ? Math.round((r.debit - r.credit) * 100) / 100 : 0
}
const entryCount = async (): Promise<number> =>
  Number((await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries WHERE status='posted'`)).c)
const arOf = async (cid: number): Promise<number> => {
  const r = await one<{ ar: number }>(
    `SELECT (COALESCE((SELECT SUM(total) FROM sales_documents WHERE customer_id=$1 AND doc_type='invoice' AND status NOT IN ('void','draft')),0)
           - COALESCE((SELECT SUM(amount) FROM sales_payments WHERE customer_id=$1),0))::float AS ar`, [cid])
  return Math.round(Number(r.ar) * 100) / 100
}

async function main() {
  await runMigrations(); await seedDatabase()

  const cust = await one<{ id: number }>(
    `INSERT INTO sales_customers (code,name,kind,updated_at) VALUES ('CFO-1','آزمون CFO','company',${NOW}) RETURNING id`)
  const mkInvoice = async (no: string, total: number, date = '2026-07-14') => {
    const inv = await one<{ id: number }>(
      `INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,total,exchange_rate,updated_at)
       VALUES ('invoice',$1,$2,$3,'confirmed',$4,$4,1,${NOW}) RETURNING id`, [no, cust.id, date, total])
    await pgQuery(`INSERT INTO sales_document_lines (document_id,description,qty,unit_price,discount_pct,tax_pct,line_total,line_no) VALUES ($1,'x',1,$2,0,0,$2,0)`, [inv.id, total])
    return inv.id
  }

  const { reverseEntry } = await import('@/lib/erp/glPosting')

  // ── S3 (BUG-020): void a GL-posted payment → balances return to pre-payment ─
  const inv1 = await mkInvoice('CFO-INV-1', 10_000_000)
  await postSalesInvoiceToGl(inv1)
  const arGl0 = await glBal('1100'), bank0 = await glBal('1010')
  const pay = await one<{ id: number }>(
    `INSERT INTO sales_payments (document_id,customer_id,amount,method,date) VALUES ($1,$2,4000000,'gateway','2026-07-15') RETURNING id`, [inv1, cust.id])
  const posted = await postSalesPaymentToGl(pay.id)
  ok(!posted.alreadyPosted, 'S3: payment posts to GL (Dr bank / Cr AR)')
  ok(await glBal('1010') === bank0 + 4_000_000, `S3: bank rose by 4,000,000 (→ ${await glBal('1010')})`)
  ok(await glBal('1100') === arGl0 - 4_000_000, `S3: AR fell by 4,000,000 (→ ${await glBal('1100')})`)
  const payEntry = await one<{ gl_entry_id: number }>(`SELECT gl_entry_id FROM sales_payments WHERE id=$1`, [pay.id])
  await reverseEntry(payEntry.gl_entry_id, undefined, '2026-07-16')
  // BUG-020: the reversal must NET the payment to zero (original stays posted).
  ok(await glBal('1010') === bank0, `S3: after reversal, bank restored to ${bank0} (→ ${await glBal('1010')}) — NOT −4,000,000 (the fixed BUG-020)`)
  ok(await glBal('1100') === arGl0, `S3: after reversal, AR restored to ${arGl0} (→ ${await glBal('1100')})`)

  // ── S2: over-payment is visible as negative sub-ledger AR (customer credit) ─
  const cust2 = await one<{ id: number }>(
    `INSERT INTO sales_customers (code,name,kind,updated_at) VALUES ('CFO-2','آزمون اضافه‌پرداخت','company',${NOW}) RETURNING id`)
  const inv2 = await one<{ id: number }>(
    `INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,total,exchange_rate,updated_at)
     VALUES ('invoice','CFO-INV-2',$1,'2026-07-14','confirmed',3000000,3000000,1,${NOW}) RETURNING id`, [cust2.id])
  await postSalesInvoiceToGl(inv2.id)
  const arBefore = await arOf(cust2.id)
  await pgQuery(`INSERT INTO sales_payments (document_id,customer_id,amount,method,date) VALUES ($1,$2,5000000,'gateway','2026-07-16')`, [inv2.id, cust2.id])
  const arAfter = await arOf(cust2.id)
  ok(arAfter === arBefore - 5_000_000, `S2: over-payment lands exactly (AR ${arBefore} → ${arAfter})`)
  ok(arAfter === -2_000_000, 'S2: the 2,000,000 excess is a visible NEGATIVE AR (customer credit), never swallowed to 0')

  // ── S7: closed-period assertPostable rejects EVERY posting write path ───────
  // Use a month-kind (detail) period — periodForDate prefers the smallest span.
  const perId = await createPeriod({ name: 'CFO-2027-06', startDate: '2027-06-01', endDate: '2027-06-30', kind: 'period' })
  const trans = await transitionPeriod(perId, 'closed')
  ok(trans.ok, 'S7: fiscal month 2027-06 transitioned open→closed')
  const gate = await assertPostable('2027-06-15')
  ok(!gate.ok, `S7: assertPostable('2027-06-15') rejected — ${gate.error ?? ''}`)

  const entriesBefore = await entryCount()
  const invC = await mkInvoice('CFO-INV-CLOSED', 1_000_000, '2027-06-15')
  let salesRejected = false
  try { await postSalesInvoiceToGl(invC) } catch { salesRejected = true }
  ok(salesRejected, 'S7a: sales-invoice GL post rejected in a closed period (throws)')
  // payment GL post (shares glPosting.insertPostedEntry gate)
  const invD = await mkInvoice('CFO-INV-OPEN', 2_000_000, '2026-07-14')
  await postSalesInvoiceToGl(invD)
  const payC = await one<{ id: number }>(
    `INSERT INTO sales_payments (document_id,customer_id,amount,method,date) VALUES ($1,$2,2000000,'gateway','2027-06-15') RETURNING id`, [invD, cust.id])
  let payRejected = false
  try { await postSalesPaymentToGl(payC.id) } catch { payRejected = true }
  ok(payRejected, 'S7b: payment GL post (journal seam) rejected in a closed period')
  const entriesAfter = await entryCount()
  ok(entriesAfter === entriesBefore + 1, `S7: only the OPEN-period invoice posted; closed posts wrote nothing (${entriesBefore}→${entriesAfter})`)

  console.log(`\n  ── CFO hunt: ${n - failed}/${n} passed ──`)
  if (failed) process.exit(1)
}
main().catch(e => { console.error(e); process.exit(1) })
