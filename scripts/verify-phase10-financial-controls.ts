/**
 * Phase 10 live-PG verification — Treasury supplier-payment ↔ AP allocation
 * (the new implementation this phase adds), its concurrency/atomicity, plus
 * a fresh Sales master reconciliation and cross-module idempotency spot
 * checks not already owned by the Phase 7/8/9 committed suites. Committed
 * as a permanent regression suite (rule 6: the full regression history
 * stays green in CI).
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery, withTransaction } from '@/lib/db'
import { createPayment, processPayment } from '@/lib/treasury/paymentData'
import { createVendor, saveDocument as savePurchaseDoc, confirmPurchaseInvoice } from '@/lib/erp/purchasingData'
import { loadTallies } from '@/lib/erp/ledgerData'
import { trialBalance } from '@/lib/erp/ledger'

let n = 0, failed = 0
const ok = (c: boolean, l: string) => { n++; if (c) console.log(`  ✅ ${n}. ${l}`); else { failed++; console.error(`  ❌ ${n}. ${l}`) } }
const one = async <T>(sql: string, p: unknown[] = []) => (await pgQuery<T>(sql, p))[0]

async function main() {
  await runMigrations()
  await seedDatabase()
  const ADMIN = (await one<{ id: string }>(`SELECT id FROM users ORDER BY created_at LIMIT 1`)).id
  const adminUser = (await one<{ id: string; role: string; name: string; email: string }>(`SELECT id, role, name, email FROM users WHERE id=$1`, [ADMIN]))
  const today = new Date().toISOString().slice(0, 10)

  console.log('— بند ۳: Treasury supplier payment ↔ AP allocation — full settlement, single invoice —')
  let vendorId = 0, invId = 0
  {
    vendorId = await createVendor({ name: 'P10 Vendor A', kind: 'company' }, ADMIN)
    invId = await savePurchaseDoc({ docType: 'invoice', vendorId, date: today, lines: [{ description: 'p10 item', qty: 1, unitPrice: 1_000_000, discountPct: 0, taxPct: 9 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const apBefore = await one<{ total: number; paid_total: number; status: string }>(`SELECT total::float AS total, paid_total::float AS "paid_total", status FROM purchase_documents WHERE id=$1`, [invId])
    ok(apBefore.status === 'confirmed' && apBefore.paid_total === 0, `invoice confirmed, unpaid — total ${apBefore.total}`)

    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P10 Vendor A', partyRef: `vendor:${vendorId}`, amount: apBefore.total, date: today }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    const res = await processPayment(pay.id, adminUser as never)
    ok(res.apAllocations.length === 1 && Math.abs(res.apAllocations[0].amount - apBefore.total) < 0.01, `payment allocated in full to the single open invoice — ${JSON.stringify(res.apAllocations)}`)

    const invAfter = await one<{ paid_total: number; status: string }>(`SELECT paid_total::float AS "paid_total", status FROM purchase_documents WHERE id=$1`, [invId])
    ok(invAfter.status === 'paid' && Math.abs(invAfter.paid_total - apBefore.total) < 0.01, `invoice status -> paid, paid_total == total — ${JSON.stringify(invAfter)}`)

    const ppRow = await one<{ id: number; amount: number; gl_entry_id: number | null }>(`SELECT id, amount::float AS amount, gl_entry_id FROM purchase_payments WHERE document_id=$1`, [invId])
    ok(ppRow.gl_entry_id === res.glEntryId, `the purchase_payments row is stamped with the SAME gl_entry_id the Treasury payment posted — ${ppRow.gl_entry_id} === ${res.glEntryId}`)

    // Cross-module double-post proof: calling the direct-path GL poster on
    // this same purchase_payments row must correctly no-op.
    const { postPurchasePaymentToGl } = await import('@/lib/erp/glPosting')
    const again = await postPurchasePaymentToGl(ppRow.id, ADMIN)
    ok(again.alreadyPosted === true && again.entryId === res.glEntryId, 'postPurchasePaymentToGl correctly sees the Treasury-posted entry and refuses to double-post')
  }

  console.log('— بند ۳: split allocation across TWO invoices for the same vendor —')
  {
    const vendorId2 = await createVendor({ name: 'P10 Vendor B', kind: 'company' }, ADMIN)
    const inv1 = await savePurchaseDoc({ docType: 'invoice', vendorId: vendorId2, date: today, lines: [{ description: 'i1', qty: 1, unitPrice: 400_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    const inv2 = await savePurchaseDoc({ docType: 'invoice', vendorId: vendorId2, date: '2020-01-01', lines: [{ description: 'i2', qty: 1, unitPrice: 300_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(inv1, ADMIN)
    await confirmPurchaseInvoice(inv2, ADMIN)
    // inv2 is dated earlier -> oldest-first allocation consumes it FIRST.
    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P10 Vendor B', partyRef: `vendor:${vendorId2}`, amount: 500_000, date: today }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    const res = await processPayment(pay.id, adminUser as never)
    ok(res.apAllocations.length === 2, `500,000 split across both open invoices — ${JSON.stringify(res.apAllocations)}`)
    const total = res.apAllocations.reduce((s, a) => s + a.amount, 0)
    ok(Math.abs(total - 500_000) < 0.01, `payment amount == sum(allocated amounts) exactly — Σ${total} == 500000 (money conserved, never created or lost)`)
    const inv2After = await one<{ status: string }>(`SELECT status FROM purchase_documents WHERE id=$1`, [inv2])
    ok(inv2After.status === 'paid', 'the OLDER invoice (inv2) was fully settled first (oldest-first allocation)')
    const inv1After = await one<{ status: string; paid_total: number }>(`SELECT status, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [inv1])
    ok(inv1After.status === 'partial' && Math.abs(inv1After.paid_total - 200_000) < 0.01, `the newer invoice (inv1) received the remainder (200,000) and is partial — ${JSON.stringify(inv1After)}`)
  }

  console.log('— بند ۴/۵: IDEMPOTENCY + CONCURRENCY — 5 concurrent identical Treasury payment creates —')
  {
    const results = await Promise.allSettled(Array.from({ length: 5 }, () =>
      createPayment({ paymentType: 'supplier_payment', party: 'P10 Vendor C', amount: 111_000, date: today }, ADMIN)))
    const succeeded = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<{ id: number }>[]
    const ids = new Set(succeeded.map(r => r.value.id))
    ok(ids.size === 1, `5 concurrent identical createPayment calls -> exactly ONE row — ids=${[...ids]}`)
  }

  console.log('— بند ۵ Scenario A: TWO concurrent Treasury payments against the SAME vendor/invoice —')
  {
    const vendorId3 = await createVendor({ name: 'P10 Vendor D', kind: 'company' }, ADMIN)
    const inv3 = await savePurchaseDoc({ docType: 'invoice', vendorId: vendorId3, date: today, lines: [{ description: 'i3', qty: 1, unitPrice: 1_000_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(inv3, ADMIN)
    const payA = await createPayment({ paymentType: 'supplier_payment', party: 'P10 Vendor D', partyRef: `vendor:${vendorId3}`, amount: 700_000, date: today, memo: 'A' }, ADMIN)
    const payB = await createPayment({ paymentType: 'supplier_payment', party: 'P10 Vendor D', partyRef: `vendor:${vendorId3}`, amount: 700_000, date: today, memo: 'B' }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id IN ($1,$2)`, [payA.id, payB.id])
    const results = await Promise.allSettled([processPayment(payA.id, adminUser as never), processPayment(payB.id, adminUser as never)])
    const succeeded = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<{ apAllocations: { invoiceId: number; amount: number }[] }>[]
    ok(succeeded.length === 2, 'both concurrent payments resolved without error (each is a real, independent payment order — both legitimately process)')
    const totalAllocated = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE document_id=$1`, [inv3])
    ok(totalAllocated.s <= 1_000_000 + 0.01, `total allocated to this invoice never exceeds its total (1,000,000) despite 1,400,000 offered — actual ${totalAllocated.s}`)
    const invFinal = await one<{ paid_total: number; status: string }>(`SELECT paid_total::float AS "paid_total", status FROM purchase_documents WHERE id=$1`, [inv3])
    ok(Math.abs(invFinal.paid_total - totalAllocated.s) < 0.01 && invFinal.status !== 'draft', `invoice paid_total matches actual allocations exactly, never overpaid — ${JSON.stringify(invFinal)}`)
  }

  console.log('— بند ۶: FORCED ROLLBACK on Treasury supplier payment with AP allocation —')
  {
    const vendorId4 = await createVendor({ name: 'P10 Vendor RB', kind: 'company' }, ADMIN)
    const inv4 = await savePurchaseDoc({ docType: 'invoice', vendorId: vendorId4, date: today, lines: [{ description: 'i4', qty: 1, unitPrice: 500_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(inv4, ADMIN)
    const beforePP = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_payments WHERE document_id=$1`, [inv4])
    const beforeInv = await one<{ paid_total: number; status: string }>(`SELECT paid_total::float AS "paid_total", status FROM purchase_documents WHERE id=$1`, [inv4])
    let threw = false
    try {
      await withTransaction(async query => {
        await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`treasury_payment_process:999999999`])
        await query(`INSERT INTO purchase_payments (vendor_id, document_id, date, amount, method, created_by, created_at) VALUES ($1,$2,$3,$4,'bank',$5,to_char(now(),'YYYY-MM-DD HH24:MI:SS'))`, [vendorId4, inv4, today, 500_000, ADMIN])
        await query(`UPDATE purchase_documents SET paid_total=500000, status='paid' WHERE id=$1`, [inv4])
        await query(`INSERT INTO gl_journal_lines (entry_id, account_id, debit, credit, line_no) VALUES (999999999, 999999999, 500000, 0, 0)`) // FK violation
      })
    } catch { threw = true }
    ok(threw, 'forced failure threw')
    const afterPP = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_payments WHERE document_id=$1`, [inv4])
    const afterInv = await one<{ paid_total: number; status: string }>(`SELECT paid_total::float AS "paid_total", status FROM purchase_documents WHERE id=$1`, [inv4])
    ok(afterPP.c === beforePP.c, `zero orphan purchase_payments rows survived — before=${beforePP.c} after=${afterPP.c}`)
    ok(afterInv.paid_total === beforeInv.paid_total && afterInv.status === beforeInv.status, `invoice paid_total/status reverted exactly to pre-transaction state — ${JSON.stringify(afterInv)}`)
  }

  console.log('— بند ۷: fresh SALES master reconciliation snapshot (order→reserve→deliver→invoice→pay→GL) —')
  {
    const cust = (await pgQuery<{ id: number }>(`INSERT INTO sales_customers (code,name,active,created_at,updated_at) VALUES ('P10CUST','P10 Sales Cust',1,to_char(now(),'YYYY-MM-DD HH24:MI:SS'),to_char(now(),'YYYY-MM-DD HH24:MI:SS')) RETURNING id`))[0].id
    await pgQuery(`INSERT INTO inv_warehouses (code,name_en,name_fa,active) VALUES ('P10WH','P10 WH','P10 WH',1)`)
    const wh = (await one<{ id: number }>(`SELECT id FROM inv_warehouses WHERE code='P10WH'`)).id
    const prod = (await pgQuery<{ id: number }>(`INSERT INTO inv_products (sku,name_en,name_fa,active,cost,created_at) VALUES ('P10SKU','P10 Product','P10 Product',1,40000,to_char(now(),'YYYY-MM-DD HH24:MI:SS')) RETURNING id`))[0].id
    await pgQuery(`INSERT INTO inv_moves (product_id,warehouse_id,type,qty,unit_cost,ref,created_by,created_at) VALUES ($1,$2,'receipt',20,40000,'P10SEED',$3,to_char(now(),'YYYY-MM-DD HH24:MI:SS'))`, [prod, wh, ADMIN])
    const order = (await pgQuery<{ id: number }>(
      `INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,discount_total,tax_total,total,warehouse_id,created_by,currency,exchange_rate,base_total,created_at,updated_at)
       VALUES ('order','SO-P10',$1,$2,'draft',800000,0,0,800000,$3,$4,'IRR',1,800000,to_char(now(),'YYYY-MM-DD HH24:MI:SS'),to_char(now(),'YYYY-MM-DD HH24:MI:SS')) RETURNING id`,
      [cust, today, wh, ADMIN]))[0]
    const line = (await pgQuery<{ id: number }>(`INSERT INTO sales_document_lines (document_id,description,qty,unit_price,discount_pct,tax_pct,line_total,line_no,product_id) VALUES ($1,'p10 item',10,80000,0,0,800000,0,$2) RETURNING id`, [order.id, prod]))[0]
    const { reserveSalesOrderTx, deliverSalesOrder } = await import('@/lib/erp/salesFulfillment')
    await withTransaction(async query => {
      const r = await reserveSalesOrderTx(query, order.id, wh, ADMIN)
      if (!r.ok) throw new Error(r.error)
      await query(`UPDATE sales_documents SET status='confirmed' WHERE id=$1`, [order.id])
    })
    const deliverRes = await deliverSalesOrder(order.id, [{ lineId: line.id, qty: 10 }], ADMIN)
    ok(deliverRes.ok === true, `delivery succeeds — ${deliverRes.error ?? ''}`)
    ok(deliverRes.cogsEntryId != null, `COGS posted on delivery — entry ${deliverRes.cogsEntryId}`)

    const delivered = await one<{ s: number }>(`SELECT COALESCE(SUM(shl.qty),0)::float AS s FROM inv_shipment_lines shl JOIN inv_shipments sh ON sh.id=shl.shipment_id WHERE sh.sales_document_id=$1`, [order.id])
    ok(delivered.s === 10, `ordered qty (10) == delivered qty (${delivered.s})`)

    const cogsAmt = await one<{ v: number }>(`SELECT COALESCE(SUM(l.debit),0)::float AS v FROM gl_journal_lines l JOIN gl_journal_entries e ON e.id=l.entry_id WHERE e.id=$1`, [deliverRes.cogsEntryId!])
    ok(Math.abs(cogsAmt.v - 10 * 40000) < 1, `COGS value (${cogsAmt.v}) == inventory issue valuation (10 * 40,000 = 400,000)`)

    const invId2 = (await pgQuery<{ id: number }>(
      `INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,discount_total,tax_total,total,source_id,created_by,currency,exchange_rate,base_total,created_at,updated_at)
       VALUES ('invoice','INV-P10',$1,$2,'confirmed',800000,0,72000,872000,$3,$4,'IRR',1,872000,to_char(now(),'YYYY-MM-DD HH24:MI:SS'),to_char(now(),'YYYY-MM-DD HH24:MI:SS')) RETURNING id`,
      [cust, today, order.id, ADMIN]))[0]
    const { postSalesInvoiceToGl } = await import('@/lib/erp/salesData')
    const post = await postSalesInvoiceToGl(invId2.id, ADMIN)
    ok(post.entryId != null, `invoice posted to GL — entry ${post.entryId}`)
    const revenueGl = await one<{ v: number }>(`SELECT COALESCE(SUM(l.credit),0)::float AS v FROM gl_journal_lines l JOIN gl_journal_entries e ON e.id=l.entry_id JOIN gl_accounts a ON a.id=l.account_id WHERE a.code='4000' AND e.reference=$1`, [`SAL-${invId2.id}`])
    ok(Math.abs(revenueGl.v - 800000) < 0.01, `sales invoice subtotal (800,000) == revenue GL movement (${revenueGl.v})`)

    const { postSalesPaymentToGl } = await import('@/lib/erp/glPosting')
    const payRow = (await pgQuery<{ id: number }>(`INSERT INTO sales_payments (customer_id,document_id,date,amount,method) VALUES ($1,$2,$3,872000,'bank') RETURNING id`, [cust, invId2.id, today]))[0]
    const payPost = await postSalesPaymentToGl(payRow.id, ADMIN)
    const cashGl = await one<{ v: number }>(`SELECT COALESCE(SUM(l.debit),0)::float AS v FROM gl_journal_lines l WHERE l.entry_id=$1 AND l.debit>0`, [payPost.entryId])
    ok(Math.abs(cashGl.v - 872000) < 0.01, `payment amount (872,000) == cash/bank GL movement (${cashGl.v})`)
  }

  console.log('— بند ۱۷: final trial balance across the whole run —')
  const tallies = await loadTallies()
  const tb = trialBalance(tallies)
  ok(Math.abs(tb.totalDebit - tb.totalCredit) < 0.01, `debit ${tb.totalDebit} == credit ${tb.totalCredit}`)

  console.log(failed === 0 ? `\n✅ Phase 10 financial controls verification: ${n}/${n} passed` : `\n❌ Phase 10 financial controls verification: ${failed}/${n} FAILED`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
