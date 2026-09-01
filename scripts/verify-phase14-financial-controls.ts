/**
 * Phase 14 live-PG verification — Treasury payment reversal. Money-
 * conservation invariant: every purchase_payments row sharing a reversed
 * payment's gl_entry_id sums to exactly zero once fully reversed, and the
 * GL entry itself is mirrored by a real balanced reversal (reuses
 * reverseEntry unchanged). Committed as a permanent regression suite
 * (rule 6: the full regression history stays green in CI).
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery, withTransaction } from '@/lib/db'
import { createPayment, processPayment, consumeUnappliedForVendor, reversePayment } from '@/lib/treasury/paymentData'
import { createVendor, saveDocument as savePurchaseDoc, confirmPurchaseInvoice, voidPurchaseInvoice, vendorPosition } from '@/lib/erp/purchasingData'
import { postPurchasePaymentToGl } from '@/lib/erp/glPosting'
import { createPeriod, transitionPeriod } from '@/lib/erp/accountingData'
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

  console.log('— Scenario A: unpaid/unused payment (draft/approved, never processed) cannot be reversed —')
  {
    const v = await createVendor({ name: 'P14 Vendor A', kind: 'company' }, ADMIN)
    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P14 Vendor A', partyRef: `vendor:${v}`, amount: 100_000, date: today }, ADMIN)
    let threw = false
    try { await reversePayment(pay.id, ADMIN) } catch { threw = true }
    ok(threw, 'reversePayment on a draft (never processed) payment throws — nothing to reverse')
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    let threw2 = false
    try { await reversePayment(pay.id, ADMIN) } catch { threw2 = true }
    ok(threw2, 'reversePayment on an approved-but-not-processed payment also throws')
  }

  console.log('— Scenario B: single invoice full allocation, reverse —')
  {
    const v = await createVendor({ name: 'P14 Vendor B', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'b', qty: 1, unitPrice: 500_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P14 Vendor B', partyRef: `vendor:${v}`, amount: 500_000, date: today }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    await processPayment(pay.id, adminUser as never)
    const res = await reversePayment(pay.id, ADMIN)
    ok(res.paymentAmount === 500_000 && res.ledgerRowsReversed === 1, `full allocation reversed — ${JSON.stringify(res)}`)
    const inv = await one<{ paid_total: number }>(`SELECT paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(inv.paid_total === 0, `invoice paid_total returned to 0 — ${inv.paid_total}`)
  }

  console.log('— Scenario C: single invoice partial allocation, reverse (invoice keeps other payments untouched) —')
  {
    const v = await createVendor({ name: 'P14 Vendor C', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'c', qty: 1, unitPrice: 800_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay1 = await createPayment({ paymentType: 'supplier_payment', party: 'P14 Vendor C', partyRef: `vendor:${v}`, amount: 300_000, date: today, memo: 'c1' }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay1.id])
    await processPayment(pay1.id, adminUser as never)
    const pay2 = await createPayment({ paymentType: 'supplier_payment', party: 'P14 Vendor C', partyRef: `vendor:${v}`, amount: 500_000, date: today, memo: 'c2' }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay2.id])
    await processPayment(pay2.id, adminUser as never)
    const invBefore = await one<{ paid_total: number }>(`SELECT paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(Math.abs(invBefore.paid_total - 800_000) < 0.01, `invoice fully paid from 2 payments — ${invBefore.paid_total}`)
    await reversePayment(pay1.id, ADMIN)
    const invAfter = await one<{ paid_total: number; status: string }>(`SELECT paid_total::float AS "paid_total", status FROM purchase_documents WHERE id=$1`, [invId])
    ok(Math.abs(invAfter.paid_total - 500_000) < 0.01 && invAfter.status === 'partial', `only pay1's 300,000 reversed — pay2's 500,000 untouched — ${JSON.stringify(invAfter)}`)
  }

  console.log('— Scenario D: multi-invoice allocation, reverse (both invoices corrected) —')
  {
    const v = await createVendor({ name: 'P14 Vendor D', kind: 'company' }, ADMIN)
    const inv1 = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: '2020-01-01', lines: [{ description: 'd1', qty: 1, unitPrice: 200_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    const inv2 = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: '2020-02-01', lines: [{ description: 'd2', qty: 1, unitPrice: 300_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(inv1, ADMIN)
    await confirmPurchaseInvoice(inv2, ADMIN)
    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P14 Vendor D', partyRef: `vendor:${v}`, amount: 500_000, date: today }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    const payRes = await processPayment(pay.id, adminUser as never)
    ok(payRes.apAllocations.length === 2, `payment split across both invoices — ${JSON.stringify(payRes.apAllocations)}`)
    const res = await reversePayment(pay.id, ADMIN)
    ok(res.ledgerRowsReversed === 2, `both allocation rows reversed — ${res.ledgerRowsReversed}`)
    const inv1After = await one<{ paid_total: number }>(`SELECT paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [inv1])
    const inv2After = await one<{ paid_total: number }>(`SELECT paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [inv2])
    ok(inv1After.paid_total === 0 && inv2After.paid_total === 0, `both invoices fully reverted — ${JSON.stringify([inv1After, inv2After])}`)
  }

  console.log('— Scenario E: payment with unapplied remainder, reverse —')
  {
    const v = await createVendor({ name: 'P14 Vendor E', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'e', qty: 1, unitPrice: 400_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P14 Vendor E', partyRef: `vendor:${v}`, amount: 600_000, date: today }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    const payRes = await processPayment(pay.id, adminUser as never)
    ok(payRes.unappliedAmount === 200_000, `200,000 unapplied remainder — ${payRes.unappliedAmount}`)
    await reversePayment(pay.id, ADMIN)
    const inv = await one<{ paid_total: number }>(`SELECT paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    const unapplied = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE vendor_id=$1 AND document_id IS NULL`, [v])
    ok(inv.paid_total === 0 && unapplied.s === 0, `both the allocated 400,000 and unapplied 200,000 fully reversed — invoice=${inv.paid_total}, unapplied=${unapplied.s}`)
  }

  console.log('— Scenario F: unapplied payment PARTIALLY consumed, then reverse (must undo the partial consumption too) —')
  {
    const v = await createVendor({ name: 'P14 Vendor F', kind: 'company' }, ADMIN)
    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P14 Vendor F', partyRef: `vendor:${v}`, amount: 900_000, date: today }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    await processPayment(pay.id, adminUser as never)   // unapplied = 900,000
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'f', qty: 1, unitPrice: 350_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)   // auto-consumes 350,000, 550,000 remains unapplied
    const unappliedBefore = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE vendor_id=$1 AND document_id IS NULL`, [v])
    ok(Math.abs(unappliedBefore.s - 550_000) < 0.01, `550,000 remains unapplied after partial consumption — ${unappliedBefore.s}`)
    const res = await reversePayment(pay.id, ADMIN)
    ok(res.ledgerRowsReversed === 3, `3 rows reversed: original unapplied(900k), AP-CONSUME neg(-350k), AP-CONSUME pos(+350k) — all tagged with this payment's gl_entry_id — got ${res.ledgerRowsReversed}`)
    const invAfter = await one<{ paid_total: number }>(`SELECT paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    const unappliedAfter = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE vendor_id=$1 AND document_id IS NULL`, [v])
    ok(invAfter.paid_total === 0, `the consumed invoice reverts to 0 — ${invAfter.paid_total}`)
    ok(unappliedAfter.s === 0, `unapplied balance fully zeroed (both the untouched 550k and the consumed 350k undone) — ${unappliedAfter.s}`)
  }

  console.log('— Scenario G: unapplied payment FULLY consumed, then reverse —')
  {
    const v = await createVendor({ name: 'P14 Vendor G', kind: 'company' }, ADMIN)
    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P14 Vendor G', partyRef: `vendor:${v}`, amount: 700_000, date: today }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    await processPayment(pay.id, adminUser as never)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'g', qty: 1, unitPrice: 700_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)   // fully consumes
    const res = await reversePayment(pay.id, ADMIN)
    ok(res.ledgerRowsReversed === 3, `3 rows reversed (original unapplied, consume-neg, consume-pos) — ${res.ledgerRowsReversed}`)
    const inv = await one<{ paid_total: number; status: string }>(`SELECT paid_total::float AS "paid_total", status FROM purchase_documents WHERE id=$1`, [invId])
    ok(inv.paid_total === 0, `invoice fully reverted — ${JSON.stringify(inv)}`)
  }

  console.log('— Scenario H: consumption followed by invoice cancellation, THEN payment reversal —')
  {
    const v = await createVendor({ name: 'P14 Vendor H', kind: 'company' }, ADMIN)
    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P14 Vendor H', partyRef: `vendor:${v}`, amount: 250_000, date: today }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    await processPayment(pay.id, adminUser as never)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'h', qty: 1, unitPrice: 250_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)   // consumes
    await voidPurchaseInvoice(invId, ADMIN)      // Phase 13: restores to unapplied
    const unappliedAfterVoid = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE vendor_id=$1 AND document_id IS NULL`, [v])
    ok(Math.abs(unappliedAfterVoid.s - 250_000) < 0.01, `invoice void restored the full 250,000 to unapplied — ${unappliedAfterVoid.s}`)
    const res = await reversePayment(pay.id, ADMIN)
    ok(res.ledgerRowsReversed === 5, `5 rows reversed (original, consume pair, void-restoration pair) — ${res.ledgerRowsReversed}`)
    const unappliedAfterReverse = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE vendor_id=$1 AND document_id IS NULL`, [v])
    ok(unappliedAfterReverse.s === 0, `payment reversal correctly cascades through consume+void and zeroes the unapplied balance — ${unappliedAfterReverse.s}`)
  }

  console.log('— Scenario I: multiple payment sources on one invoice — reversing ONE leaves the others untouched —')
  {
    const v = await createVendor({ name: 'P14 Vendor I', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'i', qty: 1, unitPrice: 900_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay1 = await createPayment({ paymentType: 'supplier_payment', party: 'P14 Vendor I', partyRef: `vendor:${v}`, amount: 300_000, date: today, memo: 'i1' }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay1.id])
    await processPayment(pay1.id, adminUser as never)
    const pay2 = await createPayment({ paymentType: 'supplier_payment', party: 'P14 Vendor I', partyRef: `vendor:${v}`, amount: 600_000, date: today, memo: 'i2' }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay2.id])
    await processPayment(pay2.id, adminUser as never)
    const res = await reversePayment(pay2.id, ADMIN)
    ok(res.paymentAmount === 600_000, `only pay2 reversed — ${res.paymentAmount}`)
    const inv = await one<{ paid_total: number; status: string }>(`SELECT paid_total::float AS "paid_total", status FROM purchase_documents WHERE id=$1`, [invId])
    ok(Math.abs(inv.paid_total - 300_000) < 0.01 && inv.status === 'partial', `invoice keeps pay1's 300,000 untouched — ${JSON.stringify(inv)}`)
  }

  console.log('— IDEMPOTENCY Scenario J: double reversal —')
  {
    const v = await createVendor({ name: 'P14 Vendor J', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'j', qty: 1, unitPrice: 150_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P14 Vendor J', partyRef: `vendor:${v}`, amount: 150_000, date: today }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    await processPayment(pay.id, adminUser as never)
    const first = await reversePayment(pay.id, ADMIN)
    const second = await reversePayment(pay.id, ADMIN)
    const third = await reversePayment(pay.id, ADMIN)
    ok(first.ledgerRowsReversed === 1 && second.ledgerRowsReversed === 0 && third.ledgerRowsReversed === 0, `repeated reversal is a stable no-op after the first — ${JSON.stringify([first.ledgerRowsReversed, second.ledgerRowsReversed, third.ledgerRowsReversed])}`)
    ok(second.alreadyReversed && third.alreadyReversed && second.reversalId === first.reversalId, 'the SAME GL reversal id returned every time, no self-reversal loop (the P14 defect this phase found and fixed)')
    const rows = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_payments WHERE vendor_id=$1`, [v])
    ok(rows.c === 2, `exactly 2 purchase_payments rows total (1 original + 1 reversal), never re-reversed — ${rows.c}`)
  }

  console.log('— CONCURRENCY Scenario K: 5 concurrent reversal calls on the SAME payment —')
  {
    const v = await createVendor({ name: 'P14 Vendor K', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'k', qty: 1, unitPrice: 220_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P14 Vendor K', partyRef: `vendor:${v}`, amount: 220_000, date: today }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    await processPayment(pay.id, adminUser as never)
    const results = await Promise.all(Array.from({ length: 5 }, () => reversePayment(pay.id, ADMIN)))
    const totalRowsReversed = results.reduce((s, r) => s + r.ledgerRowsReversed, 0)
    ok(totalRowsReversed === 1, `exactly ONE row reversed across all 5 concurrent calls — ${totalRowsReversed}`)
    const reversalIds = new Set(results.map(r => r.reversalId))
    ok(reversalIds.size === 1, `exactly ONE GL reversal entry across all 5 — ${[...reversalIds]}`)
    const inv = await one<{ paid_total: number }>(`SELECT paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(inv.paid_total === 0, 'invoice correctly reverted exactly once')
  }

  console.log('— CONCURRENCY Scenario L: reversal vs a genuinely distinct NEW payment for the same vendor —')
  {
    const v = await createVendor({ name: 'P14 Vendor L', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'l', qty: 1, unitPrice: 500_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay1 = await createPayment({ paymentType: 'supplier_payment', party: 'P14 Vendor L', partyRef: `vendor:${v}`, amount: 500_000, date: today, memo: 'l1' }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay1.id])
    await processPayment(pay1.id, adminUser as never)   // invoice fully paid
    const pay2 = await createPayment({ paymentType: 'supplier_payment', party: 'P14 Vendor L', partyRef: `vendor:${v}`, amount: 500_000, date: today, memo: 'l2' }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay2.id])
    const [revRes, payRes] = await Promise.all([reversePayment(pay1.id, ADMIN), processPayment(pay2.id, adminUser as never)])
    const inv = await one<{ paid_total: number }>(`SELECT paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(Math.abs(inv.paid_total - 500_000) < 0.01, `invoice ends at exactly 500,000 (pay1 reversed, pay2 allocated) — never overpaid, never lost — ${inv.paid_total}`)
    ok(revRes.ledgerRowsReversed === 1 && payRes.apAllocations.length === 1, 'both concurrent operations completed correctly, no interleaving corruption')
  }

  console.log('— CONCURRENCY Scenario M: reversal vs a concurrent consumeUnappliedForVendor for the same vendor —')
  {
    const v = await createVendor({ name: 'P14 Vendor M', kind: 'company' }, ADMIN)
    const pay1 = await createPayment({ paymentType: 'supplier_payment', party: 'P14 Vendor M', partyRef: `vendor:${v}`, amount: 400_000, date: today, memo: 'm1' }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay1.id])
    await processPayment(pay1.id, adminUser as never)   // unapplied = 400,000, reversal target
    const pay2 = await createPayment({ paymentType: 'supplier_payment', party: 'P14 Vendor M', partyRef: `vendor:${v}`, amount: 300_000, date: today, memo: 'm2' }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay2.id])
    await processPayment(pay2.id, adminUser as never)   // unapplied = 700,000 total
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'm', qty: 1, unitPrice: 300_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await pgQuery(`UPDATE purchase_documents SET status='confirmed' WHERE id=$1`, [invId])   // open, unconsumed
    const [revRes, consumeRes] = await Promise.all([reversePayment(pay1.id, ADMIN), consumeUnappliedForVendor(v, ADMIN)])
    // Genuine race: the vendor-lock serializes these two operations in
    // whichever order actually wins, and BOTH orderings are valid — if the
    // reversal wins first, it reverses just pay1's 1 original row; if
    // consumption wins first, it may draw from pay1's (oldest) unapplied
    // pool to settle invId, and the reversal then also undoes that
    // consumption pair (3 rows). What must hold regardless of ordering is
    // exact money conservation (asserted below), not a specific row count.
    ok(revRes.ledgerRowsReversed === 1 || revRes.ledgerRowsReversed === 3, `pay1 reversed via one of the two valid lock-ordering outcomes — ${revRes.ledgerRowsReversed}`)
    ok(typeof consumeRes.totalConsumed === 'number', 'concurrent consumption completed without throwing')
    const unapplied = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE vendor_id=$1 AND document_id IS NULL`, [v])
    const inv = await one<{ paid_total: number }>(`SELECT paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(Math.abs(unapplied.s + inv.paid_total - 300_000) < 0.01, `no lost update: (remaining unapplied) + (consumed into invoice) == 300,000 (the only money left after pay1's reversal) — unapplied=${unapplied.s}, invoice=${inv.paid_total}`)
  }

  console.log('— CONCURRENCY Scenario N: reversal vs a concurrent invoice void for a DIFFERENT invoice, same vendor —')
  {
    const v = await createVendor({ name: 'P14 Vendor N', kind: 'company' }, ADMIN)
    const invA = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'na', qty: 1, unitPrice: 250_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invA, ADMIN)
    const pay1 = await createPayment({ paymentType: 'supplier_payment', party: 'P14 Vendor N', partyRef: `vendor:${v}`, amount: 250_000, date: today, memo: 'n1' }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay1.id])
    await processPayment(pay1.id, adminUser as never)   // invA fully paid via pay1
    const invB = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'nb', qty: 1, unitPrice: 180_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invB, ADMIN)
    const pay2 = await createPayment({ paymentType: 'supplier_payment', party: 'P14 Vendor N', partyRef: `vendor:${v}`, amount: 180_000, date: today, memo: 'n2' }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay2.id])
    await processPayment(pay2.id, adminUser as never)   // invB fully paid via pay2 (separate payment/gl_entry_id)
    const [revRes, voidRes] = await Promise.all([reversePayment(pay1.id, ADMIN), voidPurchaseInvoice(invB, ADMIN)])
    ok(revRes.ledgerRowsReversed === 1 && voidRes.paymentsReversed === 180_000, `both independent operations on different invoices/payments completed exactly — ${JSON.stringify({ revRes, voidRes })}`)
    const invAAfter = await one<{ paid_total: number }>(`SELECT paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invA])
    ok(invAAfter.paid_total === 0, `invA correctly reverted by pay1's reversal, unaffected by invB's void — ${invAAfter.paid_total}`)
  }

  console.log('— ROLLBACK Scenario O: forced failure after a reversal-shaped write must roll back everything atomically —')
  {
    const v = await createVendor({ name: 'P14 Vendor O', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'o', qty: 1, unitPrice: 140_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P14 Vendor O', partyRef: `vendor:${v}`, amount: 140_000, date: today }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    await processPayment(pay.id, adminUser as never)
    const glId = (await one<{ gl_entry_id: number }>(`SELECT gl_entry_id FROM payment_orders WHERE id=$1`, [pay.id])).gl_entry_id
    const beforeGl = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    const beforeRows = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_payments WHERE vendor_id=$1`, [v])
    let threw = false
    try {
      await withTransaction(async query => {
        await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`treasury_ap_allocate:vendor:${v}`])
        await query(`INSERT INTO purchase_payments (vendor_id, document_id, date, amount, method, reference, created_by, gl_entry_id, created_at) VALUES ($1,$2,$3,$4,'bank','TRZPAY-REVERSE:FORCED',$5,$6,${new Date().toISOString()})`, [v, invId, today, -140_000, ADMIN, glId])
        await query(`UPDATE purchase_documents SET paid_total=0 WHERE id=$1`, [invId])
        throw new Error('forced rollback mid-reversal')
      })
    } catch { threw = true }
    ok(threw, 'forced failure threw')
    const afterGl = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    ok(beforeGl.c === afterGl.c, `no orphan GL entry — ${beforeGl.c} == ${afterGl.c}`)
    const afterRows = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_payments WHERE vendor_id=$1`, [v])
    ok(beforeRows.c === afterRows.c, `no orphan reversal rows — ${beforeRows.c} == ${afterRows.c}`)
    const inv = await one<{ paid_total: number }>(`SELECT paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(Math.abs(inv.paid_total - 140_000) < 0.01, `invoice payment ledger fully restored — ${inv.paid_total}`)
    const payOrder = await one<{ status: string }>(`SELECT status FROM payment_orders WHERE id=$1`, [pay.id])
    ok(payOrder.status === 'completed', 'payment_orders row untouched by the forced-failure attempt (reversePayment itself never got this far)')
  }

  console.log('— FISCAL PERIOD Scenario P: reversal is rejected when TODAY\'s posting date falls in a closed period —')
  {
    // reverseEntry (reused unchanged) dates the reversal entry `asOf ??
    // today` — NOT the original entry's own date — matching standard
    // reversing-entry accounting (a reversal happening now posts now, into
    // whichever period covers today, never retroactively into an already-
    // closed historical period). So the correct test of the fiscal-period
    // gate closes the period covering TODAY, not the original transaction's
    // (already-past, never separately gated) date.
    const v = await createVendor({ name: 'P14 Vendor P', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'p', qty: 1, unitPrice: 90_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P14 Vendor P', partyRef: `vendor:${v}`, amount: 90_000, date: today }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    await processPayment(pay.id, adminUser as never)
    const year = today.slice(0, 4)
    const periodId = await createPeriod({ name: `P14 closed ${year}`, startDate: `${year}-01-01`, endDate: `${year}-12-31`, kind: 'year' })
    await transitionPeriod(periodId, 'closed', ADMIN)
    let threw = false
    try { await reversePayment(pay.id, ADMIN) } catch { threw = true }
    ok(threw, 'reversal rejected — today\'s posting date falls inside a closed period (reverseEntry\'s own assertPostable gate, unchanged)')
    const inv = await one<{ paid_total: number }>(`SELECT paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(Math.abs(inv.paid_total - 90_000) < 0.01, `invoice untouched — the subledger-reversal step never ran since reverseEntry threw first — ${inv.paid_total}`)
    await transitionPeriod(periodId, 'open', ADMIN)   // reopen so later scenarios in this run are unaffected
  }

  console.log('— GL INTEGRITY Scenario Q: reversal balance + no phantom cash movement —')
  {
    const before = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    const v = await createVendor({ name: 'P14 Vendor Q', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'q', qty: 1, unitPrice: 310_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P14 Vendor Q', partyRef: `vendor:${v}`, amount: 310_000, date: today }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    const payRes = await processPayment(pay.id, adminUser as never)
    const afterProcess = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    ok(afterProcess.c === before.c + 2, `2 GL events so far (invoice + payment) — ${before.c} -> ${afterProcess.c}`)

    const res = await reversePayment(pay.id, ADMIN)
    const afterReverse = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    ok(afterReverse.c === afterProcess.c + 1, `exactly ONE new GL entry from the reversal (the mirror of the payment's own entry) — ${afterProcess.c} -> ${afterReverse.c}`)

    const revEntry = await one<{ total_debit: number; total_credit: number }>(
      `SELECT COALESCE(SUM(debit),0)::float AS total_debit, COALESCE(SUM(credit),0)::float AS total_credit FROM gl_journal_lines WHERE entry_id=$1`, [res.reversalId])
    ok(Math.abs(revEntry.total_debit - revEntry.total_credit) < 0.01 && Math.abs(revEntry.total_debit - 310_000) < 0.01, `the reversal entry itself is balanced at the full payment amount — Dr ${revEntry.total_debit} == Cr ${revEntry.total_credit}`)

    const originalEntry = await one<{ status: string; reversed_by: number | null }>(`SELECT status, reversed_by FROM gl_journal_entries WHERE id=$1`, [payRes.glEntryId])
    ok(originalEntry.status === 'posted' && originalEntry.reversed_by === res.reversalId, `original entry stays posted (rule 11), two-way linked to the reversal — ${JSON.stringify(originalEntry)}`)

    const revRows = await pgQuery<{ id: number; gl_entry_id: number | null }>(`SELECT id, gl_entry_id FROM purchase_payments WHERE reference LIKE 'TRZPAY-REVERSE:%' AND vendor_id=$1`, [v])
    let doublePosted = false
    for (const r of revRows) { const pr = await postPurchasePaymentToGl(r.id, ADMIN); if (!pr.alreadyPosted) doublePosted = true }
    ok(!doublePosted, 'every subledger reversal row correctly refuses a new GL post — no phantom Dr AP/Cr Bank entry')
  }

  console.log('— VENDOR AP RECONCILIATION Scenario R —')
  {
    const v = await createVendor({ name: 'P14 Vendor R', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'r', qty: 1, unitPrice: 600_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const posBefore = await vendorPosition(v)
    ok(Math.abs(posBefore.outstanding - 600_000) < 0.01, `unpaid invoice: vendor outstanding = 600,000 — ${JSON.stringify(posBefore)}`)
    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P14 Vendor R', partyRef: `vendor:${v}`, amount: 600_000, date: today }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    await processPayment(pay.id, adminUser as never)
    const posPaid = await vendorPosition(v)
    ok(Math.abs(posPaid.outstanding) < 0.01, `paid: vendor outstanding = 0 — ${JSON.stringify(posPaid)}`)
    await reversePayment(pay.id, ADMIN)
    const posReversed = await vendorPosition(v)
    ok(Math.abs(posReversed.outstanding - 600_000) < 0.01, `after reversal: vendor outstanding returns to exactly 600,000 (before payment - allocation + reversal = after) — ${JSON.stringify(posReversed)}`)
  }

  console.log('— UNAPPLIED BALANCE Scenario S + PRECISION Scenario U —')
  {
    const cases = [0.01, 0.02, 0.05, 0.1, 0.99, 1.01, 999.99, 1_000_000.01]
    for (const amt of cases) {
      const v = await createVendor({ name: `P14 Precision ${amt}`, kind: 'company' }, ADMIN)
      const pay = await createPayment({ paymentType: 'supplier_payment', party: `p${amt}`, partyRef: `vendor:${v}`, amount: amt, date: today }, ADMIN)
      await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
      await processPayment(pay.id, adminUser as never)   // fully unapplied (no invoice)
      const res = await reversePayment(pay.id, ADMIN)
      ok(Math.abs(res.paymentAmount - amt) < 0.005, `amount ${amt}: reversal amount == exactly ${amt} — ${res.paymentAmount}`)
      const unapplied = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE vendor_id=$1 AND document_id IS NULL`, [v])
      ok(Math.abs(unapplied.s) < 0.005, `amount ${amt}: unapplied balance == exactly 0 after reversal, zero drift — ${unapplied.s}`)
    }
  }

  console.log('— TRIAL BALANCE Scenario T: fresh trial balance ties out after every Phase 14 scenario —')
  {
    const tallies = await loadTallies()
    const tb = trialBalance(tallies)
    ok(Math.abs(tb.totalDebit - tb.totalCredit) < 0.01, `Σdebit == Σcredit — ${tb.totalDebit} == ${tb.totalCredit}`)
  }

  console.log(`\n${failed === 0 ? '✅ ALL' : `❌ ${failed}/${n}`} Phase 14 assertions passed`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
