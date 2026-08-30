/**
 * Phase 8 live-PG verification — Treasury / Cash-Bank / Returns / Refund
 * concurrency + reconciliation. Committed as a permanent regression suite
 * (rule 6: the full regression history stays green in CI).
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import { createPayment, processPayment, createReceipt } from '@/lib/treasury/paymentData'
import { createSalesReturn, settleReturnIfPaid, postSalesInvoiceToGl } from '@/lib/erp/salesData'
import { postSalesPaymentToGl } from '@/lib/erp/glPosting'
import { createVendor, saveDocument as savePurchaseDoc, confirmPurchaseInvoice, convertDocument as convertPurchaseDoc } from '@/lib/erp/purchasingData'
import { loadTallies } from '@/lib/erp/ledgerData'
import { trialBalance } from '@/lib/erp/ledger'
import { withTransaction } from '@/lib/db'

let n = 0, failed = 0
const ok = (c: boolean, l: string) => { n++; if (c) console.log(`  ✅ ${n}. ${l}`); else { failed++; console.error(`  ❌ ${n}. ${l}`) } }
const one = async <T>(sql: string, p: unknown[] = []) => (await pgQuery<T>(sql, p))[0]

async function main() {
  await runMigrations()
  await seedDatabase()
  const ADMIN = (await one<{ id: string }>(`SELECT id, name FROM users ORDER BY created_at LIMIT 1`)).id
  const adminUser = (await one<{ id: string; role: string; name: string; email: string }>(`SELECT id, role, name, email FROM users WHERE id=$1`, [ADMIN]))
  const today = new Date().toISOString().slice(0, 10)

  console.log('— بند ۳: Treasury duplicate PAYMENT (outgoing) — 5 concurrent identical requests —')
  {
    const results = await Promise.allSettled(Array.from({ length: 5 }, () =>
      createPayment({ paymentType: 'supplier_payment', party: 'P8 Vendor X', amount: 1_000_000, date: today }, ADMIN)))
    const succeeded = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<{ id: number; number: string }>[]
    const ids = new Set(succeeded.map(r => r.value.id))
    ok(ids.size === 1, `5 concurrent identical createPayment calls -> exactly ONE payment_orders row — ids=${[...ids]}`)
    const count = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM payment_orders WHERE party='P8 Vendor X'`)
    ok(count.c === 1, `exactly one row persisted — count=${count.c}`)
  }

  console.log('— بند ۳: Treasury duplicate PROCESS (5 concurrent process calls on the SAME approved payment) —')
  let payId = 0
  {
    const p = await createPayment({ paymentType: 'supplier_payment', party: 'P8 Vendor Y', amount: 2_000_000, date: today }, ADMIN)
    payId = p.id
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [payId])
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => processPayment(payId, adminUser as never)))
    const succeeded = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<{ glEntryId: number; alreadyProcessed: boolean }>[]
    ok(succeeded.length === 5, `all 5 concurrent process calls resolved without error — ${succeeded.length}/5`)
    const glIds = new Set(succeeded.map(r => r.value.glEntryId))
    ok(glIds.size === 1, `all 5 resolved to the SAME single GL entry — ${[...glIds]}`)
    const glCount = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries WHERE reference=$1`, [`TRZPAY-${payId}`])
    ok(glCount.c === 1, `exactly ONE journal entry posted for this payment — count=${glCount.c}`)
  }

  console.log('— بند ۱۲: Treasury payment respects a CLOSED fiscal period —')
  {
    await pgQuery(`INSERT INTO gl_fiscal_periods (name, start_date, end_date, status, kind) VALUES ('P8-Closed','2020-01-01','2020-12-31','closed','year') ON CONFLICT (name) DO NOTHING`)
    const p2 = await createPayment({ paymentType: 'supplier_payment', party: 'P8 Vendor Closed', amount: 500000, date: '2020-06-15' }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [p2.id])
    let threw = false
    try { await processPayment(p2.id, adminUser as never) } catch { threw = true }
    ok(threw, 'processing a payment dated inside a CLOSED fiscal period is rejected, not silently posted')
    const row = await one<{ status: string; gl_entry_id: number | null }>(`SELECT status, gl_entry_id FROM payment_orders WHERE id=$1`, [p2.id])
    ok(row.status === 'approved' && row.gl_entry_id === null, `the failed period-gate rolled back the WHOLE transaction — status reverts to 'approved' (not stuck 'processing'), no GL link — status=${row.status}`)
  }

  console.log('— بند ۳/۲: Treasury duplicate RECEIPT + gl_entry_id bridging into sales_payments —')
  {
    const cust = (await pgQuery<{ id: number }>(`INSERT INTO sales_customers (code,name,active,created_at,updated_at) VALUES ('P8REC','P8 Receipt Cust',1,to_char(now(),'YYYY-MM-DD HH24:MI:SS'),to_char(now(),'YYYY-MM-DD HH24:MI:SS')) RETURNING id`))[0].id
    const inv = (await pgQuery<{ id: number }>(
      `INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,discount_total,tax_total,total,created_by,currency,exchange_rate,base_total,created_at,updated_at)
       VALUES ('invoice','INV-P8-REC',$1,$2,'confirmed',1000000,0,90000,1090000,$3,'IRR',1,1090000,to_char(now(),'YYYY-MM-DD HH24:MI:SS'),to_char(now(),'YYYY-MM-DD HH24:MI:SS')) RETURNING id`,
      [cust, today, ADMIN]))[0]
    const r = await createReceipt({ customerId: cust, amount: 1_090_000, date: today }, ADMIN)
    ok(r.glEntryId != null, `receipt posted a GL entry — ${r.glEntryId}`)
    const pay = await one<{ id: number; gl_entry_id: number | null }>(`SELECT id, gl_entry_id FROM sales_payments WHERE customer_id=$1`, [cust])
    ok(pay.gl_entry_id === r.glEntryId, `the sales_payments row this receipt created is stamped with the SAME gl_entry_id — ${pay.gl_entry_id} === ${r.glEntryId}`)
    // Now prove the cross-module defect is closed: calling postSalesPaymentToGl
    // on this SAME payment must NOT post a second, duplicate entry.
    const again = await postSalesPaymentToGl(pay.id, ADMIN)
    ok(again.alreadyPosted === true && again.entryId === r.glEntryId, 'postSalesPaymentToGl correctly sees the Treasury-posted entry and refuses to double-post')
    const glCount = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries WHERE reference LIKE $1`, [`%${pay.id}%`])
    void inv; void glCount
    // 5 concurrent identical receipts for the SAME customer/invoice
    const cust2 = (await pgQuery<{ id: number }>(`INSERT INTO sales_customers (code,name,active,created_at,updated_at) VALUES ('P8REC2','P8 Receipt Cust2',1,to_char(now(),'YYYY-MM-DD HH24:MI:SS'),to_char(now(),'YYYY-MM-DD HH24:MI:SS')) RETURNING id`))[0].id
    await pgQuery(
      `INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,discount_total,tax_total,total,created_by,currency,exchange_rate,base_total,created_at,updated_at)
       VALUES ('invoice','INV-P8-REC2',$1,$2,'confirmed',1000000,0,90000,1090000,$3,'IRR',1,1090000,to_char(now(),'YYYY-MM-DD HH24:MI:SS'),to_char(now(),'YYYY-MM-DD HH24:MI:SS')) RETURNING id`,
      [cust2, today, ADMIN])
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => createReceipt({ customerId: cust2, amount: 300_000, date: today }, ADMIN)))
    const succeeded = results.filter(r2 => r2.status === 'fulfilled').length
    ok(succeeded === 5, `5 concurrent DISTINCT receipts for the same customer all succeed without lost writes — ${succeeded}/5`)
    const totalPaid = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM sales_payments WHERE customer_id=$1`, [cust2])
    ok(Math.abs(totalPaid.s - 1_500_000) < 0.01, `total allocated across 5 concurrent 300k receipts = exactly 1,500,000 (no lost/duplicated writes) — actual ${totalPaid.s}`)
  }

  console.log('— بند ۵: CONCURRENT SALES RETURN (Original qty=10, A returns 7, B returns 7) —')
  {
    const cust3 = (await pgQuery<{ id: number }>(`INSERT INTO sales_customers (code,name,active,created_at,updated_at) VALUES ('P8SR','P8 Return Cust',1,to_char(now(),'YYYY-MM-DD HH24:MI:SS'),to_char(now(),'YYYY-MM-DD HH24:MI:SS')) RETURNING id`))[0].id
    const inv2 = (await pgQuery<{ id: number }>(
      `INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,discount_total,tax_total,total,created_by,currency,exchange_rate,base_total,created_at,updated_at)
       VALUES ('invoice','INV-P8-SR',$1,$2,'confirmed',1000000,0,0,1000000,$3,'IRR',1,1000000,to_char(now(),'YYYY-MM-DD HH24:MI:SS'),to_char(now(),'YYYY-MM-DD HH24:MI:SS')) RETURNING id`,
      [cust3, today, ADMIN]))[0]
    const line = (await pgQuery<{ id: number }>(
      `INSERT INTO sales_document_lines (document_id,description,qty,unit_price,discount_pct,tax_pct,line_total,line_no) VALUES ($1,'return item',10,100000,0,0,1000000,0) RETURNING id`, [inv2.id]))[0]
    const results = await Promise.allSettled([
      createSalesReturn(inv2.id, { lines: [{ lineId: line.id, qty: 7 }], userId: ADMIN }),
      createSalesReturn(inv2.id, { lines: [{ lineId: line.id, qty: 7 }], userId: ADMIN }),
    ])
    const oks = (results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<{ ok: boolean }>).value) as { ok: boolean }[]).filter(v => v.ok).length
    ok(oks === 1, `exactly one of two concurrent 7-unit (700,000) returns on a 1,000,000 invoice succeeded — ${oks}/2`)
    const totalReturned = await one<{ s: number }>(`SELECT COALESCE(SUM(total),0)::float AS s FROM sales_documents WHERE source_id=$1 AND doc_type='credit_note' AND status<>'void'`, [inv2.id])
    ok(totalReturned.s <= 1_000_000 + 0.01, `total returned never exceeds the invoice total (1,000,000) — actual ${totalReturned.s}`)
    ok(Math.abs(totalReturned.s - 700_000) < 0.01, `total returned is exactly 700,000 (one success, one correctly rejected) — actual ${totalReturned.s}`)
  }

  console.log('— بند ۸: CONCURRENT REFUND (double-refund defect this phase fixed) —')
  {
    const cust4 = (await pgQuery<{ id: number }>(`INSERT INTO sales_customers (code,name,active,created_at,updated_at) VALUES ('P8RF','P8 Refund Cust',1,to_char(now(),'YYYY-MM-DD HH24:MI:SS'),to_char(now(),'YYYY-MM-DD HH24:MI:SS')) RETURNING id`))[0].id
    const inv3 = (await pgQuery<{ id: number }>(
      `INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,discount_total,tax_total,total,created_by,currency,exchange_rate,base_total,created_at,updated_at)
       VALUES ('invoice','INV-P8-RF',$1,$2,'confirmed',1000000,0,0,1000000,$3,'IRR',1,1000000,to_char(now(),'YYYY-MM-DD HH24:MI:SS'),to_char(now(),'YYYY-MM-DD HH24:MI:SS')) RETURNING id`,
      [cust4, today, ADMIN]))[0]
    await pgQuery(`INSERT INTO sales_document_lines (document_id,description,qty,unit_price,discount_pct,tax_pct,line_total,line_no) VALUES ($1,'refund item',1,1000000,0,0,1000000,0)`, [inv3.id])
    await postSalesInvoiceToGl(inv3.id, ADMIN)
    await pgQuery(`INSERT INTO sales_payments (customer_id,document_id,date,amount,method,currency,exchange_rate) VALUES ($1,$2,$3,1000000,'bank','IRR',1)`, [cust4, inv3.id, today])
    await pgQuery(`UPDATE erp_settings SET value='refund' WHERE key='sales_return_settlement'`)
    const cn = await createSalesReturn(inv3.id, { userId: ADMIN }) // full return
    ok(cn.ok === true, `full return of the paid invoice created — ${cn.error ?? ''}`)
    // 5 concurrent settlement attempts for the SAME credit note
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => settleReturnIfPaid(cn.id!, ADMIN)))
    const succeeded = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<{ settled: string; paymentId?: number }>[]
    ok(succeeded.length === 5, `all 5 concurrent settlement calls resolved without error — ${succeeded.length}/5`)
    const payIds = new Set(succeeded.map(r => r.value.paymentId))
    ok(payIds.size === 1, `all 5 resolved to the SAME single refund payment — ${[...payIds]}`)
    const refundCount = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM sales_payments WHERE reference=$1 AND method='refund'`, [`REFUND-CN-${cn.id}`])
    ok(refundCount.c === 1, `exactly ONE refund payment row exists, never a double-refund — count=${refundCount.c}`)
  }

  console.log('— بند ۶: CONCURRENT PURCHASE RETURN (double-return defect this phase fixed) —')
  {
    const vendorId = await createVendor({ name: 'P8 Vendor Return', kind: 'company' }, ADMIN)
    const pinv = await savePurchaseDoc({ docType: 'invoice', vendorId, date: today, currency: 'IRR',
      lines: [{ description: 'p8 return item', qty: 10, unitPrice: 100000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(pinv, ADMIN)
    const results = await Promise.allSettled([
      convertPurchaseDoc(pinv, 'return', ADMIN),
      convertPurchaseDoc(pinv, 'return', ADMIN),
    ])
    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const rejected = results.filter(r => r.status === 'rejected').length
    ok(succeeded === 1 && rejected === 1, `exactly one of two concurrent full-invoice purchase returns succeeded — ${succeeded} succeeded / ${rejected} rejected`)
    const totalReturned = await one<{ s: number }>(`SELECT COALESCE(SUM(total),0)::float AS s FROM purchase_documents WHERE source_id=$1 AND doc_type IN ('return','credit_note') AND status<>'void'`, [pinv])
    ok(Math.abs(totalReturned.s - 1_000_000) < 0.01, `total purchase-returned equals exactly the invoice total (1,000,000), never double (2,000,000) — actual ${totalReturned.s}`)
  }

  console.log('— بند ۱۶: FORCED ROLLBACK on a sales return (2+ writes, then a real failure) —')
  {
    const cust5 = (await pgQuery<{ id: number }>(`INSERT INTO sales_customers (code,name,active,created_at,updated_at) VALUES ('P8RB','P8 Rollback Cust',1,to_char(now(),'YYYY-MM-DD HH24:MI:SS'),to_char(now(),'YYYY-MM-DD HH24:MI:SS')) RETURNING id`))[0].id
    const inv4 = (await pgQuery<{ id: number }>(
      `INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,discount_total,tax_total,total,created_by,currency,exchange_rate,base_total,created_at,updated_at)
       VALUES ('invoice','INV-P8-RB',$1,$2,'confirmed',500000,0,0,500000,$3,'IRR',1,500000,to_char(now(),'YYYY-MM-DD HH24:MI:SS'),to_char(now(),'YYYY-MM-DD HH24:MI:SS')) RETURNING id`,
      [cust5, today, ADMIN]))[0]
    await pgQuery(`INSERT INTO sales_document_lines (document_id,description,qty,unit_price,discount_pct,tax_pct,line_total,line_no) VALUES ($1,'rb item',1,500000,0,0,500000,0)`, [inv4.id])
    const beforeCn = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM sales_documents WHERE doc_type='credit_note'`)
    // Force a genuine failure inside the SAME lock scope createSalesReturn
    // uses: insert the credit-note header for real, then a second write
    // with a bogus FK — the whole transaction must roll back, taking the
    // (already-written) header with it.
    let threw = false
    try {
      await withTransaction(async query => {
        await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`sales_invoice_return:${inv4.id}`])
        await query(
          `INSERT INTO sales_documents (doc_type, doc_no, customer_id, date, status, subtotal, discount_total, tax_total, total, source_id, created_at, updated_at)
           VALUES ('credit_note','RBTEST-CN',$1,to_char(now(),'YYYY-MM-DD'),'draft',500000,0,0,500000,$2,to_char(now(),'YYYY-MM-DD HH24:MI:SS'),to_char(now(),'YYYY-MM-DD HH24:MI:SS'))`,
          [cust5, inv4.id])
        await query(`INSERT INTO sales_document_lines (document_id, description, qty, unit_price, discount_pct, tax_pct, line_total, line_no) VALUES (999999999,'x',1,1,0,0,1,0)`) // FK violation
      })
    } catch { threw = true }
    ok(threw, 'forced failure (FK violation) threw')
    const afterCn = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM sales_documents WHERE doc_type='credit_note'`)
    ok(afterCn.c === beforeCn.c, `zero orphan credit notes survived the forced failure — before=${beforeCn.c} after=${afterCn.c}`)
  }

  console.log('— بند ۱۷: final trial balance across the whole run —')
  const tallies = await loadTallies()
  const tb = trialBalance(tallies)
  ok(Math.abs(tb.totalDebit - tb.totalCredit) < 0.01, `debit ${tb.totalDebit} == credit ${tb.totalCredit}`)

  console.log(failed === 0 ? `\n✅ Phase 8 finance verification: ${n}/${n} passed` : `\n❌ Phase 8 finance verification: ${failed}/${n} FAILED`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
