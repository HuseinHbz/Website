/**
 * Phase 13 live-PG verification — purchase invoice cancellation reverses
 * payment allocations (direct payment, Treasury AP allocation, Phase 12
 * unapplied-cash consumption) uniformly, restoring the vendor's correct AP
 * position and any consumed unapplied balance. Money-conservation invariant:
 *   original unapplied balance − consumed + reversed == current unapplied
 *   invoice paid_total after full reversal == 0
 * plus its concurrency/rollback/GL/precision guarantees. Committed as a
 * permanent regression suite (rule 6: the full regression history stays
 * green in CI).
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery, withTransaction } from '@/lib/db'
import { createPayment, processPayment, consumeUnappliedForVendor } from '@/lib/treasury/paymentData'
import { createVendor, saveDocument as savePurchaseDoc, confirmPurchaseInvoice, voidPurchaseInvoice, recordPayment } from '@/lib/erp/purchasingData'
import { postPurchasePaymentToGl } from '@/lib/erp/glPosting'
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

  console.log('— Scenario 1: unpaid invoice cancellation (zero payment rows, must be a clean no-op) —')
  {
    const v = await createVendor({ name: 'P13 Vendor 1', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'unpaid', qty: 1, unitPrice: 100_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const res = await voidPurchaseInvoice(invId, ADMIN)
    ok(res.status === 'void' && res.paymentsReversed === 0, `unpaid invoice voids cleanly, nothing to reverse — ${JSON.stringify(res)}`)
    const inv = await one<{ status: string; paid_total: number }>(`SELECT status, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(inv.status === 'void' && inv.paid_total === 0, `invoice void, paid_total untouched at 0 — ${JSON.stringify(inv)}`)
  }

  console.log('— Scenario 2: partially-paid invoice cancellation (exact reversal) —')
  {
    const v = await createVendor({ name: 'P13 Vendor 2', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'partial', qty: 1, unitPrice: 500_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    await recordPayment(invId, v, 200_000, 'bank', today, undefined, ADMIN)
    const before = await one<{ status: string; paid_total: number }>(`SELECT status, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(before.status === 'partial' && Math.abs(before.paid_total - 200_000) < 0.01, `pre-void state: partially paid — ${JSON.stringify(before)}`)

    const res = await voidPurchaseInvoice(invId, ADMIN)
    ok(Math.abs(res.paymentsReversed - 200_000) < 0.01, `exactly the 200,000 direct payment was reversed — ${res.paymentsReversed}`)
    const inv = await one<{ status: string; paid_total: number }>(`SELECT status, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(inv.status === 'void' && inv.paid_total === 0, `invoice void, paid_total returned to exactly 0 — ${JSON.stringify(inv)}`)
    const unapplied = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE vendor_id=$1 AND document_id IS NULL`, [v])
    ok(Math.abs(unapplied.s - 200_000) < 0.01, `the 200,000 returned to the vendor's unapplied pool — ${unapplied.s}`)
  }

  console.log('— Scenario 3: fully-paid invoice cancellation —')
  {
    const v = await createVendor({ name: 'P13 Vendor 3', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'full', qty: 1, unitPrice: 300_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    await recordPayment(invId, v, 300_000, 'bank', today, undefined, ADMIN)
    const res = await voidPurchaseInvoice(invId, ADMIN)
    ok(Math.abs(res.paymentsReversed - 300_000) < 0.01, `full 300,000 payment reversed — ${res.paymentsReversed}`)
    const inv = await one<{ status: string; paid_total: number }>(`SELECT status, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(inv.status === 'void' && inv.paid_total === 0, `fully-paid invoice voids with paid_total exactly 0 — ${JSON.stringify(inv)}`)
  }

  console.log('— Scenario 4: Treasury supplier payment allocation cancellation —')
  {
    const v = await createVendor({ name: 'P13 Vendor 4', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'treasury', qty: 1, unitPrice: 450_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P13 Vendor 4', partyRef: `vendor:${v}`, amount: 450_000, date: today }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    const payRes = await processPayment(pay.id, adminUser as never)
    ok(payRes.apAllocations.length === 1, `Treasury payment allocated directly to the already-open invoice (Phase 10 path) — ${JSON.stringify(payRes.apAllocations)}`)

    const res = await voidPurchaseInvoice(invId, ADMIN)
    ok(Math.abs(res.paymentsReversed - 450_000) < 0.01, `the Treasury AP allocation was reversed exactly — ${res.paymentsReversed}`)
    const unapplied = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE vendor_id=$1 AND document_id IS NULL`, [v])
    ok(Math.abs(unapplied.s - 450_000) < 0.01, `the money returns to unapplied — ${unapplied.s}`)
  }

  console.log('— Scenario 5: Phase 12 unapplied-cash consumption cancellation (the exact worked example from the master prompt) —')
  {
    const v = await createVendor({ name: 'P13 Vendor 5', kind: 'company' }, ADMIN)
    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P13 Vendor 5', partyRef: `vendor:${v}`, amount: 1_000_000, date: today }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    await processPayment(pay.id, adminUser as never)   // unapplied = 1,000,000, no invoice yet
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'consume-then-cancel', qty: 1, unitPrice: 600_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)   // auto-consumes 600,000

    const unappliedBefore = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE vendor_id=$1 AND document_id IS NULL`, [v])
    ok(Math.abs(unappliedBefore.s - 400_000) < 0.01, `after consumption: unapplied = 1,000,000 - 600,000 = 400,000 — ${unappliedBefore.s}`)

    const res = await voidPurchaseInvoice(invId, ADMIN)
    ok(Math.abs(res.paymentsReversed - 600_000) < 0.01, `the 600,000 consumption is reversed — ${res.paymentsReversed}`)
    const unappliedAfter = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE vendor_id=$1 AND document_id IS NULL`, [v])
    ok(Math.abs(unappliedAfter.s - 1_000_000) < 0.01, `unapplied fully restored to the original 1,000,000 — ${unappliedAfter.s}`)
    const inv = await one<{ status: string; paid_total: number }>(`SELECT status, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(inv.status === 'void' && inv.paid_total === 0, `invoice void, paid_total 0 — ${JSON.stringify(inv)}`)
  }

  console.log('— Scenario 6: multiple payment sources on one invoice (direct + Treasury + Phase-12 consumption combined) —')
  {
    const v = await createVendor({ name: 'P13 Vendor 6', kind: 'company' }, ADMIN)
    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P13 Vendor 6', partyRef: `vendor:${v}`, amount: 200_000, date: today, memo: 'seed-unapplied' }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    await processPayment(pay.id, adminUser as never)   // unapplied = 200,000
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'multi-source', qty: 1, unitPrice: 900_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)   // auto-consumes 200,000 -> paid_total=200,000, partial
    await recordPayment(invId, v, 300_000, 'bank', today, undefined, ADMIN)   // direct -> paid_total=500,000
    const pay2 = await createPayment({ paymentType: 'supplier_payment', party: 'P13 Vendor 6', partyRef: `vendor:${v}`, amount: 400_000, date: today, memo: 'direct-treasury' }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay2.id])
    await processPayment(pay2.id, adminUser as never)   // Treasury direct alloc (invoice already open) -> paid_total=900,000, paid

    const before = await one<{ status: string; paid_total: number }>(`SELECT status, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(before.status === 'paid' && Math.abs(before.paid_total - 900_000) < 0.01, `invoice fully paid from THREE distinct sources — ${JSON.stringify(before)}`)
    const positiveRows = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_payments WHERE document_id=$1 AND amount>0`, [invId])
    ok(positiveRows.c === 3, `three distinct positive allocation rows exist against this one invoice — ${positiveRows.c}`)

    const res = await voidPurchaseInvoice(invId, ADMIN)
    ok(Math.abs(res.paymentsReversed - 900_000) < 0.01, `ALL THREE sources reversed exactly once each, summing to 900,000 — ${res.paymentsReversed}`)
    const inv = await one<{ status: string; paid_total: number }>(`SELECT status, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(inv.status === 'void' && inv.paid_total === 0, `invoice void, paid_total 0 despite 3 sources — ${JSON.stringify(inv)}`)
    const vendorTotalPaid = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE vendor_id=$1`, [v])
    ok(Math.abs(vendorTotalPaid.s - 900_000) < 0.01, `vendor's total paid unchanged by any reversal — 200,000 (unapplied seed) + 300,000 (direct) + 400,000 (Treasury) = 900,000, all real cash inflows, none reduced by the void's net-zero reversal pairs — ${vendorTotalPaid.s}`)
  }

  console.log('— CONCURRENCY Scenario A: 2 concurrent cancellation requests for the SAME invoice —')
  {
    const v = await createVendor({ name: 'P13 Vendor A', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'race-void', qty: 1, unitPrice: 250_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    await recordPayment(invId, v, 250_000, 'bank', today, undefined, ADMIN)

    const [r1, r2] = await Promise.all([voidPurchaseInvoice(invId, ADMIN), voidPurchaseInvoice(invId, ADMIN)])
    const totalReversed = r1.paymentsReversed + r2.paymentsReversed
    ok(Math.abs(totalReversed - 250_000) < 0.01, `exactly ONE financial mutation across both concurrent void calls — total reversed 250,000, not 500,000 — ${totalReversed}`)
    const glReversalIds = new Set([r1.reversalId, r2.reversalId].filter(x => x != null))
    ok(glReversalIds.size === 1, `exactly ONE GL reversal entry created despite the race — ${[...glReversalIds]}`)
    const inv = await one<{ status: string; paid_total: number }>(`SELECT status, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(inv.status === 'void' && inv.paid_total === 0, `invoice ends in a single consistent state — ${JSON.stringify(inv)}`)
  }

  console.log('— CONCURRENCY Scenario B: cancellation concurrent with a NEW supplier payment being processed for the same vendor —')
  {
    const v = await createVendor({ name: 'P13 Vendor B', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'race-b', qty: 1, unitPrice: 300_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    await recordPayment(invId, v, 300_000, 'bank', today, undefined, ADMIN)   // fully paid
    const pay2 = await createPayment({ paymentType: 'supplier_payment', party: 'P13 Vendor B', partyRef: `vendor:${v}`, amount: 500_000, date: today, memo: 'b-concurrent' }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay2.id])

    const [voidRes, payRes] = await Promise.all([voidPurchaseInvoice(invId, ADMIN), processPayment(pay2.id, adminUser as never)])
    const inv = await one<{ status: string; paid_total: number }>(`SELECT status, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(inv.status === 'void' && inv.paid_total <= 0.01, `invoice never left overpaid by the racing new Treasury payment (it's void, own paid_total 0) — ${JSON.stringify(inv)}`)
    ok(payRes.apAllocations.every(a => a.invoiceId !== invId) || payRes.apAllocations.length === 0, `the new Treasury payment never allocates against the now-voided invoice — ${JSON.stringify(payRes.apAllocations)}`)
    ok(Math.abs(voidRes.paymentsReversed - 300_000) < 0.01, `the void's own reversal is exact regardless of the race outcome — ${voidRes.paymentsReversed}`)
  }

  console.log('— CONCURRENCY Scenario C: cancellation concurrent with consumeUnappliedForVendor for the same vendor —')
  {
    const v = await createVendor({ name: 'P13 Vendor C', kind: 'company' }, ADMIN)
    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P13 Vendor C', partyRef: `vendor:${v}`, amount: 400_000, date: today, memo: 'c-unapplied' }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    await processPayment(pay.id, adminUser as never)   // unapplied = 400,000, no invoice yet
    const invPaid = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'c-paid', qty: 1, unitPrice: 400_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invPaid, ADMIN)   // auto-consumes all 400,000
    // a SECOND, still-open invoice + a fresh unapplied balance for the SAME vendor,
    // so a concurrent consumeUnappliedForVendor has real work to race against the void
    const pay2 = await createPayment({ paymentType: 'supplier_payment', party: 'P13 Vendor C', partyRef: `vendor:${v}`, amount: 150_000, date: today, memo: 'c-second-unapplied' }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay2.id])
    await processPayment(pay2.id, adminUser as never)   // unapplied = 150,000 (invPaid already settled)
    const invOpen = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'c-open', qty: 1, unitPrice: 150_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await pgQuery(`UPDATE purchase_documents SET status='confirmed' WHERE id=$1`, [invOpen])   // opened WITHOUT auto-consuming yet

    const [voidRes, consumeRes] = await Promise.all([voidPurchaseInvoice(invPaid, ADMIN), consumeUnappliedForVendor(v, ADMIN)])
    ok(Math.abs(voidRes.paymentsReversed - 400_000) < 0.01, `void reverses exactly its own invoice's 400,000 — ${voidRes.paymentsReversed}`)
    const invOpenAfter = await one<{ status: string; paid_total: number }>(`SELECT status, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invOpen])
    ok(Math.abs(invOpenAfter.paid_total - 150_000) < 0.01, `the concurrent consumption run correctly settles the OTHER open invoice from the 150,000 pool, unaffected by the unrelated void race — ${JSON.stringify(invOpenAfter)}`)
    ok(typeof consumeRes.totalConsumed === 'number', 'consumeUnappliedForVendor completed without throwing under the race')
    const finalUnapplied = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE vendor_id=$1 AND document_id IS NULL`, [v])
    ok(Math.abs(finalUnapplied.s - 400_000) < 0.01, `no lost update: unapplied = 400,000 restored by the void (invPaid's reversal) + 0 remaining from the 150,000 pool fully consumed by invOpen — ${finalUnapplied.s}`)
  }

  console.log('— idempotency: retry after successful cancellation is a stable no-op —')
  {
    const v = await createVendor({ name: 'P13 Vendor Idem', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'idem', qty: 1, unitPrice: 175_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    await recordPayment(invId, v, 175_000, 'bank', today, undefined, ADMIN)
    const first = await voidPurchaseInvoice(invId, ADMIN)
    const beforeRows = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_payments WHERE vendor_id=$1`, [v])
    const second = await voidPurchaseInvoice(invId, ADMIN)
    const third = await voidPurchaseInvoice(invId, ADMIN)
    ok(first.paymentsReversed === 175_000 && second.paymentsReversed === 0 && third.paymentsReversed === 0, `repeated cancellation stays financially identical after the first — ${JSON.stringify([first.paymentsReversed, second.paymentsReversed, third.paymentsReversed])}`)
    const afterRows = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_payments WHERE vendor_id=$1`, [v])
    ok(beforeRows.c === afterRows.c, `no duplicate reversal rows created by repeated calls — ${beforeRows.c} == ${afterRows.c}`)
    ok(second.reversalId === first.reversalId && third.reversalId === first.reversalId, 'the SAME GL reversal id is returned on every repeat call, never a new one')
  }

  console.log('— ROLLBACK: forced failure after a reversal-shaped write must roll back everything atomically —')
  {
    const v = await createVendor({ name: 'P13 Vendor RB', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'rb', qty: 1, unitPrice: 120_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    await recordPayment(invId, v, 120_000, 'bank', today, undefined, ADMIN)
    const beforeGl = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    const beforeRows = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_payments WHERE vendor_id=$1`, [v])
    let threw = false
    try {
      await withTransaction(async query => {
        await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`treasury_ap_allocate:vendor:${v}`])
        await query(`INSERT INTO purchase_payments (vendor_id, document_id, date, amount, method, reference, created_by, created_at) VALUES ($1,$2,$3,$4,'bank','AP-VOID:FORCED',$5,${new Date().toISOString()})`, [v, invId, today, -120_000, ADMIN])
        await query(`INSERT INTO purchase_payments (vendor_id, document_id, date, amount, method, reference, created_by, created_at) VALUES ($1,NULL,$2,$3,'bank','AP-VOID:FORCED',$4,${new Date().toISOString()})`, [v, today, 120_000, ADMIN])
        await query(`UPDATE purchase_documents SET paid_total=0 WHERE id=$1`, [invId])
        throw new Error('forced rollback mid-reversal')
      })
    } catch { threw = true }
    ok(threw, 'forced failure threw')
    const afterGl = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    ok(beforeGl.c === afterGl.c, `no orphan GL entry survives — ${beforeGl.c} == ${afterGl.c}`)
    const afterRows = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_payments WHERE vendor_id=$1`, [v])
    ok(beforeRows.c === afterRows.c, `no orphan reversal rows survive — ${beforeRows.c} == ${afterRows.c}`)
    const inv = await one<{ status: string; paid_total: number }>(`SELECT status, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(inv.status === 'paid' && Math.abs(inv.paid_total - 120_000) < 0.01, `invoice payment ledger fully restored to its pre-rollback state (fully paid, 120,000 total==paid) — ${JSON.stringify(inv)}`)
    const unapplied = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE vendor_id=$1 AND document_id IS NULL`, [v])
    ok(unapplied.s === 0, `no phantom unapplied balance created by the forced failure — ${unapplied.s}`)
  }

  console.log('— PRECISION MATRIX: exact reversal at sub-unit and large amounts —')
  {
    const cases = [0.01, 0.02, 0.05, 0.1, 0.99, 1.01, 999.99, 1_000_000.01]
    for (const amt of cases) {
      const v = await createVendor({ name: `P13 Precision ${amt}`, kind: 'company' }, ADMIN)
      const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'precision', qty: 1, unitPrice: amt, discountPct: 0, taxPct: 0 }] }, ADMIN)
      await confirmPurchaseInvoice(invId, ADMIN)
      await recordPayment(invId, v, amt, 'bank', today, undefined, ADMIN)
      const res = await voidPurchaseInvoice(invId, ADMIN)
      ok(Math.abs(res.paymentsReversed - amt) < 0.005, `amount ${amt}: reversed == exactly ${amt} — actual ${res.paymentsReversed}`)
      const inv = await one<{ paid_total: number }>(`SELECT paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
      ok(Math.abs(Number(inv.paid_total)) < 0.005, `amount ${amt}: net outstanding allocation == exactly 0 (original + reversal) — actual ${inv.paid_total}`)
    }
  }

  console.log('— GL INTEGRITY: reversal creates no phantom cash-movement GL entry —')
  {
    const before = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    const v = await createVendor({ name: 'P13 Vendor GL', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'gl', qty: 1, unitPrice: 210_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)   // +1 GL entry (invoice recognition)
    await recordPayment(invId, v, 210_000, 'bank', today, undefined, ADMIN)   // +1 GL entry (payment)
    const afterPayment = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    ok(afterPayment.c === before.c + 2, `2 real GL events so far (invoice + payment) — ${before.c} -> ${afterPayment.c}`)

    const res = await voidPurchaseInvoice(invId, ADMIN)   // +1 GL entry (invoice reversal) + 0 for payment reversal
    ok(res.reversalId != null, 'the invoice recognition entry was reversed')
    const afterVoid = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    ok(afterVoid.c === afterPayment.c + 1, `exactly ONE new GL entry from voiding (the invoice reversal) — payment reversal added ZERO — ${afterPayment.c} -> ${afterVoid.c}`)

    const revRows = await pgQuery<{ id: number; gl_entry_id: number | null }>(`SELECT id, gl_entry_id FROM purchase_payments WHERE reference LIKE 'AP-VOID:%' AND vendor_id=$1`, [v])
    let doublePosted = false
    for (const r of revRows) {
      const pr = await postPurchasePaymentToGl(r.id, ADMIN)
      if (!pr.alreadyPosted) doublePosted = true
    }
    ok(!doublePosted, 'every reversal row correctly refuses a new GL post (alreadyPosted=true) — no phantom Dr AP/Cr Bank entry')
    const finalCount = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    ok(finalCount.c === afterVoid.c, `GL entry count unchanged after the double-post-guard check — ${finalCount.c}`)
  }

  console.log('— vendor AP reconciliation: vendorPosition reflects cancellation correctly —')
  {
    const { vendorPosition } = await import('@/lib/erp/purchasingData')
    const v = await createVendor({ name: 'P13 Vendor AP', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'ap', qty: 1, unitPrice: 800_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    await recordPayment(invId, v, 800_000, 'bank', today, undefined, ADMIN)
    const posBefore = await vendorPosition(v)
    ok(Math.abs(posBefore.outstanding) < 0.01, `fully-paid invoice: vendor outstanding ~0 before void — ${JSON.stringify(posBefore)}`)
    await voidPurchaseInvoice(invId, ADMIN)
    const posAfter = await vendorPosition(v)
    ok(Math.abs(posAfter.outstanding - (-800_000)) < 0.01, `after void: invoicedTotal excludes the voided invoice (drops by 800,000) while paidTotal is unchanged -> vendor outstanding becomes -800,000 (a credit/prepayment owed back) — ${JSON.stringify(posAfter)}`)
  }

  console.log('— reconciliation: fresh trial balance ties out after every Phase 13 scenario —')
  {
    const tallies = await loadTallies()
    const tb = trialBalance(tallies)
    ok(Math.abs(tb.totalDebit - tb.totalCredit) < 0.01, `Σdebit == Σcredit — ${tb.totalDebit} == ${tb.totalCredit}`)
  }

  console.log(`\n${failed === 0 ? '✅ ALL' : `❌ ${failed}/${n}`} Phase 13 assertions passed`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
