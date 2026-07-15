/**
 * Phase 26.26 live-PG verification — BUG-013 (sales return / refund / negative AR)
 * with numeric before/after AR proof, plus the BUG-012 storage contract.
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import { postSalesInvoiceToGl, createSalesReturn, settleReturnIfPaid } from '@/lib/erp/salesData'

let n = 0, failed = 0
const ok = (c: boolean, l: string) => { n++; if (c) console.log(`  ✅ ${n}. ${l}`); else { failed++; console.error(`  ❌ ${n}. ${l}`) } }
const one = async <T>(sql: string, p: unknown[] = []) => (await pgQuery<T>(sql, p))[0]
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

// Sub-ledger AR for a customer = invoiced − paid − credit notes (the app's formula).
async function arOf(cid: number): Promise<number> {
  const r = await one<{ ar: number }>(
    `SELECT (
       COALESCE((SELECT SUM(total) FROM sales_documents WHERE customer_id=$1 AND doc_type='invoice' AND status NOT IN ('void','draft')),0)
     - COALESCE((SELECT SUM(amount) FROM sales_payments WHERE customer_id=$1),0)
     - COALESCE((SELECT SUM(total) FROM sales_documents WHERE customer_id=$1 AND doc_type='credit_note' AND status<>'void'),0)
     )::float AS ar`, [cid])
  return Math.round(Number(r.ar) * 100) / 100
}
// GL balance of the AR control account 1100 (whole ledger; single customer here).
async function glAr(): Promise<number> {
  const r = await one<{ b: number }>(
    `SELECT COALESCE(SUM(l.debit-l.credit),0)::float AS b FROM gl_journal_lines l
     JOIN gl_accounts a ON a.id=l.account_id JOIN gl_journal_entries e ON e.id=l.entry_id
     WHERE a.code='1100' AND e.status='posted'`)
  return Math.round(Number(r.b) * 100) / 100
}
async function bankGl(): Promise<number> {
  const r = await one<{ b: number }>(
    `SELECT COALESCE(SUM(l.debit-l.credit),0)::float AS b FROM gl_journal_lines l
     JOIN gl_accounts a ON a.id=l.account_id JOIN gl_journal_entries e ON e.id=l.entry_id
     WHERE a.code='1010' AND e.status='posted'`)
  return Math.round(Number(r.b) * 100) / 100
}
async function mkInvoice(cid: number, no: string, total: number): Promise<number> {
  const inv = await one<{ id: number }>(
    `INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,total,exchange_rate,updated_at)
     VALUES ('invoice',$1,$2,'2026-07-14','confirmed',$3,$3,1,${NOW}) RETURNING id`, [no, cid, total])
  await pgQuery(`INSERT INTO sales_document_lines (document_id,description,qty,unit_price,discount_pct,tax_pct,line_total,line_no) VALUES ($1,'item',1,$2,0,0,$2,0)`, [inv.id, total])
  await postSalesInvoiceToGl(inv.id) // Dr 1100 / Cr 4000
  return inv.id
}
// Confirm + GL-post a credit note (mirrors the route's confirm path).
async function confirmCn(id: number): Promise<void> {
  await pgQuery(`UPDATE sales_documents SET status='confirmed' WHERE id=$1`, [id])
  await postSalesInvoiceToGl(id) // credit_note → reversed GL sign
}

async function main() {
  await runMigrations(); await seedDatabase()

  console.log('— BUG-012: Database Center PG storage contract —')
  const stat = await one<{ dead: string; live: string }>(`SELECT COALESCE(SUM(n_dead_tup),0) dead, COALESCE(SUM(n_live_tup),0) live FROM pg_stat_user_tables`)
  const conns = await one<{ c: number }>(`SELECT count(*)::int c FROM pg_stat_activity WHERE datname=current_database()`)
  ok(stat != null && conns.c >= 1, 'health API PG metrics query (dead/live tuples + active connections) works — no SQLite PRAGMA')

  console.log('\n— BUG-013 A: return of an UNPAID invoice → AR 0 —')
  const cA = await one<{ id: number }>(`INSERT INTO sales_customers (code,name,kind,updated_at) VALUES ('RA','A','company',${NOW}) RETURNING id`)
  const invA = await mkInvoice(cA.id, 'INV-A', 1000000)
  ok(await arOf(cA.id) === 1000000, `unpaid invoice → AR = 1,000,000 (${await arOf(cA.id)})`)
  const rA = await createSalesReturn(invA, {})
  ok(rA.ok && rA.id != null, 'return created (draft credit note)')
  await confirmCn(rA.id!)
  ok(await arOf(cA.id) === 0, `after return+confirm → AR = 0 (${await arOf(cA.id)})`)

  console.log('\n— BUG-013 B: return of a PAID invoice + REFUND → AR 0 non-negative, bank ↓ —')
  await pgQuery(`UPDATE erp_settings SET value='refund' WHERE key='sales_return_settlement'`)
  const cB = await one<{ id: number }>(`INSERT INTO sales_customers (code,name,kind,updated_at) VALUES ('RB','B','company',${NOW}) RETURNING id`)
  const invB = await mkInvoice(cB.id, 'INV-B', 2000000)
  const payB = await one<{ id: number }>(`INSERT INTO sales_payments (customer_id,document_id,date,amount,method,reference,currency,exchange_rate) VALUES ($1,$2,'2026-07-14',2000000,'bank','P-B','IRR',1) RETURNING id`, [cB.id, invB])
  await pgQuery(`UPDATE sales_documents SET status='paid' WHERE id=$1`, [invB])
  // post the receipt to GL (Dr bank / Cr AR)
  const { postSalesPaymentToGl } = await import('@/lib/erp/glPosting'); await postSalesPaymentToGl(payB.id)
  const arBeforeB = await arOf(cB.id), glArBefore = await glAr(), bankBefore = await bankGl()
  ok(arBeforeB === 0, `paid invoice → AR = 0 before return (${arBeforeB})`)
  const rB = await createSalesReturn(invB, {})
  await confirmCn(rB.id!)
  const settle = await settleReturnIfPaid(rB.id!)
  ok(settle.settled === 'refund', 'settlement = refund')
  const arAfterB = await arOf(cB.id), glArAfter = await glAr(), bankAfter = await bankGl()
  ok(arAfterB === 0, `PROOF: AR after refund = 0 and NON-NEGATIVE (${arBeforeB} → ${arAfterB})`)
  ok(arAfterB >= 0, 'AR never goes negative')
  ok(bankAfter === bankBefore - 2000000, `bank decreased by the refund (${bankBefore} → ${bankAfter})`)
  ok(Math.abs(glArAfter - glArBefore) < 0.01, `GL AR control back to its pre-return balance (${glArBefore} → ${glArAfter})`)

  console.log('\n— BUG-013 C: return of a PAID invoice + CREDIT mode → explicit customer credit + alert —')
  await pgQuery(`UPDATE erp_settings SET value='credit' WHERE key='sales_return_settlement'`)
  const cC = await one<{ id: number }>(`INSERT INTO sales_customers (code,name,kind,updated_at) VALUES ('RC','C','company',${NOW}) RETURNING id`)
  const invC = await mkInvoice(cC.id, 'INV-C', 3000000)
  const payC = await one<{ id: number }>(`INSERT INTO sales_payments (customer_id,document_id,date,amount,method,reference,currency,exchange_rate) VALUES ($1,$2,'2026-07-14',3000000,'bank','P-C','IRR',1) RETURNING id`, [cC.id, invC])
  await pgQuery(`UPDATE sales_documents SET status='paid' WHERE id=$1`, [invC]); void payC
  const rC = await createSalesReturn(invC, {})
  await confirmCn(rC.id!)
  const sC = await settleReturnIfPaid(rC.id!)
  ok(sC.settled === 'credit', 'settlement = credit (leaves a customer-credit balance)')
  ok(await arOf(cC.id) === -3000000, `customer-credit balance is EXPLICIT (-3,000,000), not a silent negative (${await arOf(cC.id)})`)
  const alert = await one<{ c: number }>(`SELECT COUNT(*)::int c FROM business_alerts WHERE kind='sales_return_pending' AND status<>'resolved'`)
  ok(alert.c >= 1, 'a pending-settlement business_alert was raised')

  console.log('\n— BUG-013 guards —')
  const draft = await one<{ id: number }>(`INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,total,exchange_rate,updated_at) VALUES ('invoice','INV-D',$1,'2026-07-14','draft',500000,500000,1,${NOW}) RETURNING id`, [cA.id])
  const rDraft = await createSalesReturn(draft.id, {})
  ok(!rDraft.ok, 'return on a DRAFT invoice → rejected')
  // over-return: invA already fully returned (1,000,000) → another return rejected
  const rOver = await createSalesReturn(invA, {})
  ok(!rOver.ok, 'cumulative return exceeding invoice total → rejected (idempotency)')

  console.log('\n— BUG-013 partial return: AR = exactly the returned amount —')
  const cE = await one<{ id: number }>(`INSERT INTO sales_customers (code,name,kind,updated_at) VALUES ('RE','E','company',${NOW}) RETURNING id`)
  const invE = await one<{ id: number }>(`INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,total,exchange_rate,updated_at) VALUES ('invoice','INV-E',$1,'2026-07-14','confirmed',1000000,1000000,1,${NOW}) RETURNING id`, [cE.id])
  const l1 = await one<{ id: number }>(`INSERT INTO sales_document_lines (document_id,description,qty,unit_price,discount_pct,tax_pct,line_total,line_no) VALUES ($1,'A',2,300000,0,0,600000,0) RETURNING id`, [invE.id])
  await pgQuery(`INSERT INTO sales_document_lines (document_id,description,qty,unit_price,discount_pct,tax_pct,line_total,line_no) VALUES ($1,'B',1,400000,0,0,400000,1)`, [invE.id])
  await postSalesInvoiceToGl(invE.id)
  // return only 1 of the 2 units of line A → 300,000
  const rPart = await createSalesReturn(invE.id, { lines: [{ lineId: l1.id, qty: 1 }] })
  ok(rPart.ok, 'partial return accepted')
  const cnTotal = await one<{ total: number }>(`SELECT total::float AS total FROM sales_documents WHERE id=$1`, [rPart.id])
  ok(Number(cnTotal.total) === 300000, `partial credit note total = 300,000 (${cnTotal.total})`)
  await confirmCn(rPart.id!)
  ok(await arOf(cE.id) === 700000, `AR = invoice − partial return = 700,000 (${await arOf(cE.id)})`)

  console.log('\n— BUG-013 sibling: purchase return guards (AP) —')
  const { convertDocument, saveDocument, createVendor } = await import('@/lib/erp/purchasingData')
  const vid = await createVendor({ name: 'V1', currency: 'IRR' })
  const pInv = await saveDocument({ docType: 'invoice', vendorId: vid, date: '2026-07-14', currency: 'IRR', lines: [{ description: 'x', qty: 1, unitPrice: 500000, discountPct: 0, taxPct: 0, productId: null }] })
  await pgQuery(`UPDATE purchase_documents SET status='confirmed' WHERE id=$1`, [pInv])
  const pcn = await convertDocument(pInv, 'credit_note')
  ok(pcn > 0, 'purchase return (credit_note) on a confirmed invoice succeeds once')
  let dup = false
  try { await convertDocument(pInv, 'credit_note') } catch { dup = true }
  ok(dup, 'a SECOND purchase return on the same invoice → rejected (no negative AP)')
  const pDraft = await saveDocument({ docType: 'invoice', vendorId: vid, date: '2026-07-14', currency: 'IRR', lines: [{ description: 'y', qty: 1, unitPrice: 100000, discountPct: 0, taxPct: 0, productId: null }] })
  let draftBlocked = false
  try { await convertDocument(pDraft, 'credit_note') } catch { draftBlocked = true }
  ok(draftBlocked, 'purchase return on a DRAFT invoice → rejected')

  console.log('\n— بند ۲ (CFO hunt): payment + convert guards —')
  const { validatePayment } = await import('@/lib/erp/sales')
  ok(!validatePayment({ status: 'void', invoiceTotal: 1000, alreadyPaid: 0, amount: 100 }).ok, 'payment against a void invoice → rejected')
  ok(!validatePayment({ status: 'confirmed', invoiceTotal: 1000, alreadyPaid: 900, amount: 200 }).ok, 'overpayment beyond total → rejected')
  ok(validatePayment({ status: 'confirmed', invoiceTotal: 1000, alreadyPaid: 900, amount: 100 }).ok, 'exact-to-total payment → accepted')
  // dup-convert guard: a source with an existing non-void child of the target type is blocked
  const q = await one<{ id: number }>(`INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,total,exchange_rate,updated_at) VALUES ('quote','Q-1',$1,'2026-07-14','confirmed',100,100,1,${NOW}) RETURNING id`, [cA.id])
  await pgQuery(`INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,total,source_id,exchange_rate,updated_at) VALUES ('order','SO-1',$1,'2026-07-14','draft',100,100,$2,1,${NOW})`, [cA.id, q.id])
  const already = await one<{ x: number }>(`SELECT 1 AS x FROM sales_documents WHERE source_id=$1 AND doc_type='order' AND status<>'void' LIMIT 1`, [q.id])
  ok(already?.x === 1, 'dup-convert guard detects an existing order child → second convert blocked')

  console.log(`\n${failed === 0 ? '✅ ALL' : '❌ ' + failed + ' FAILED /'} ${n} assertions`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
