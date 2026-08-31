/**
 * Phase 12 live-PG verification — supplier unapplied-payment (prepayment)
 * consumption against future invoices. Money-conservation invariant:
 *   source.amount == Σ(consumed) + remaining
 *   invoice.old_outstanding == allocated + invoice.new_outstanding
 * plus its concurrency/rollback/GL/fiscal-period guarantees. Committed as a
 * permanent regression suite (rule 6: the full regression history stays
 * green in CI).
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery, withTransaction } from '@/lib/db'
import { createPayment, processPayment, consumeUnappliedForVendor } from '@/lib/treasury/paymentData'
import { createVendor, saveDocument as savePurchaseDoc, confirmPurchaseInvoice } from '@/lib/erp/purchasingData'
import { postPurchasePaymentToGl } from '@/lib/erp/glPosting'
import { createPeriod, transitionPeriod } from '@/lib/erp/accountingData'
import { loadTallies } from '@/lib/erp/ledgerData'
import { trialBalance } from '@/lib/erp/ledger'

let n = 0, failed = 0
const ok = (c: boolean, l: string) => { n++; if (c) console.log(`  ✅ ${n}. ${l}`); else { failed++; console.error(`  ❌ ${n}. ${l}`) } }
const one = async <T>(sql: string, p: unknown[] = []) => (await pgQuery<T>(sql, p))[0]

/** Create an unapplied Treasury balance for a vendor (no open invoices yet). */
async function makeUnapplied(vendorName: string, amount: number, ADMIN: string, adminUser: unknown, today: string, memo?: string) {
  const vendorId = await createVendor({ name: vendorName, kind: 'company' }, ADMIN)
  const pay = await createPayment({ paymentType: 'supplier_payment', party: vendorName, partyRef: `vendor:${vendorId}`, amount, date: today, memo }, ADMIN)
  await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
  const res = await processPayment(pay.id, adminUser as never)
  return { vendorId, unappliedAmount: res.unappliedAmount, glEntryId: res.glEntryId }
}

async function main() {
  await runMigrations()
  await seedDatabase()
  const ADMIN = (await one<{ id: string }>(`SELECT id FROM users ORDER BY created_at LIMIT 1`)).id
  const adminUser = (await one<{ id: string; role: string; name: string; email: string }>(`SELECT id, role, name, email FROM users WHERE id=$1`, [ADMIN]))
  const today = new Date().toISOString().slice(0, 10)

  console.log('— Scenario A: one unapplied payment -> one future invoice (auto-consumed on confirm) —')
  {
    const { vendorId, unappliedAmount, glEntryId } = await makeUnapplied('P12 Vendor A', 500_000, ADMIN, adminUser, today)
    ok(unappliedAmount === 500_000, `unapplied balance created with zero open invoices — ${unappliedAmount}`)

    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId, date: today, lines: [{ description: 'future A', qty: 1, unitPrice: 300_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)   // auto-consumption fires here

    const inv = await one<{ status: string; paid_total: number }>(`SELECT status, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(inv.status === 'paid' && Math.abs(inv.paid_total - 300_000) < 0.01, `future invoice auto-settled from the pre-existing unapplied balance — ${JSON.stringify(inv)}`)

    const remaining = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE vendor_id=$1 AND document_id IS NULL`, [vendorId])
    ok(Math.abs(remaining.s - 200_000) < 0.01, `remaining unapplied balance = 500,000 - 300,000 = 200,000 — actual ${remaining.s}`)

    const pair = await pgQuery<{ document_id: number | null; amount: number; reference: string; gl_entry_id: number | null }>(
      `SELECT document_id, amount::float AS amount, reference, gl_entry_id FROM purchase_payments WHERE reference=$1 ORDER BY id`, [`AP-CONSUME:1`])
    ok(pair.length === 2 && Math.abs(Number(pair[0].amount) + Number(pair[1].amount)) < 0.01, `exactly TWO linked rows (negative source adjustment + positive invoice allocation) that net to zero — ${JSON.stringify(pair)}`)
    ok(pair.every(r => r.gl_entry_id === glEntryId), `both consumption rows carry the SOURCE payment's original gl_entry_id, never NULL — ${JSON.stringify(pair.map(r => r.gl_entry_id))}`)

    const vendorBalance = await one<{ paid: number }>(`SELECT COALESCE(SUM(amount),0)::float AS paid FROM purchase_payments WHERE vendor_id=$1`, [vendorId])
    ok(Math.abs(vendorBalance.paid - 500_000) < 0.01, `vendor's total paid (vendorPosition input) is UNCHANGED by consumption — still 500,000 — ${vendorBalance.paid}`)
  }

  console.log('— Scenario B: one unapplied payment -> MULTIPLE future invoices —')
  {
    const { vendorId } = await makeUnapplied('P12 Vendor B', 700_000, ADMIN, adminUser, today)
    const inv1 = await savePurchaseDoc({ docType: 'invoice', vendorId, date: today, lines: [{ description: 'b1', qty: 1, unitPrice: 200_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(inv1, ADMIN)
    const inv2 = await savePurchaseDoc({ docType: 'invoice', vendorId, date: today, lines: [{ description: 'b2', qty: 1, unitPrice: 300_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(inv2, ADMIN)

    const inv1After = await one<{ status: string; paid_total: number }>(`SELECT status, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [inv1])
    const inv2After = await one<{ status: string; paid_total: number }>(`SELECT status, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [inv2])
    ok(inv1After.status === 'paid' && Math.abs(inv1After.paid_total - 200_000) < 0.01, `first future invoice settled from the ONE unapplied source — ${JSON.stringify(inv1After)}`)
    ok(inv2After.status === 'paid' && Math.abs(inv2After.paid_total - 300_000) < 0.01, `second future invoice ALSO settled from the SAME unapplied source — ${JSON.stringify(inv2After)}`)
    const remaining = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE vendor_id=$1 AND document_id IS NULL`, [vendorId])
    ok(Math.abs(remaining.s - 200_000) < 0.01, `700,000 - 200,000 - 300,000 = 200,000 remaining unapplied — ${remaining.s}`)
  }

  console.log('— Scenario C: MULTIPLE unapplied payments -> one future invoice —')
  {
    const vendorId = await createVendor({ name: 'P12 Vendor C', kind: 'company' }, ADMIN)
    const pay1 = await createPayment({ paymentType: 'supplier_payment', party: 'P12 Vendor C', partyRef: `vendor:${vendorId}`, amount: 150_000, date: today, memo: 'c1' }, ADMIN)
    const pay2 = await createPayment({ paymentType: 'supplier_payment', party: 'P12 Vendor C', partyRef: `vendor:${vendorId}`, amount: 250_000, date: today, memo: 'c2' }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id IN ($1,$2)`, [pay1.id, pay2.id])
    await processPayment(pay1.id, adminUser as never)
    await processPayment(pay2.id, adminUser as never)

    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId, date: today, lines: [{ description: 'c-target', qty: 1, unitPrice: 350_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)

    const inv = await one<{ status: string; paid_total: number }>(`SELECT status, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(inv.status === 'paid' && Math.abs(inv.paid_total - 350_000) < 0.01, `ONE invoice settled by TWO distinct unapplied sources combined — ${JSON.stringify(inv)}`)
    const remaining = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE vendor_id=$1 AND document_id IS NULL`, [vendorId])
    ok(Math.abs(remaining.s - 50_000) < 0.01, `150,000 + 250,000 - 350,000 = 50,000 remaining unapplied — ${remaining.s}`)
  }

  console.log('— unapplied payment GREATER than the invoice balance (Q15) —')
  {
    const { vendorId } = await makeUnapplied('P12 Vendor Q15', 1_000_000, ADMIN, adminUser, today)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId, date: today, lines: [{ description: 'small', qty: 1, unitPrice: 40_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const inv = await one<{ status: string; paid_total: number }>(`SELECT status, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(inv.status === 'paid' && Math.abs(inv.paid_total - 40_000) < 0.01, `invoice capped at its own total, never overpaid — ${JSON.stringify(inv)}`)
    const remaining = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE vendor_id=$1 AND document_id IS NULL`, [vendorId])
    ok(Math.abs(remaining.s - 960_000) < 0.01, `the large remainder stays correctly unconsumed/unapplied — ${remaining.s}`)
  }

  console.log('— idempotency: explicit re-call after auto-consumption is a stable no-op —')
  {
    const { vendorId } = await makeUnapplied('P12 Vendor Idem', 100_000, ADMIN, adminUser, today)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId, date: today, lines: [{ description: 'idem', qty: 1, unitPrice: 100_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)   // auto-consumes fully
    const before = await pgQuery<{ id: number }>(`SELECT id FROM purchase_payments WHERE vendor_id=$1`, [vendorId])
    const again = await consumeUnappliedForVendor(vendorId, ADMIN)
    ok(again.totalConsumed === 0 && again.details.length === 0, `re-running consumption after full settlement is a stable no-op — ${JSON.stringify(again)}`)
    const after = await pgQuery<{ id: number }>(`SELECT id FROM purchase_payments WHERE vendor_id=$1`, [vendorId])
    ok(before.length === after.length, `no new rows created by the redundant call — ${before.length} == ${after.length}`)
  }

  console.log('— CONCURRENCY Scenario D: 2 concurrent workers consuming the SAME unapplied balance —')
  {
    const vendorId = await createVendor({ name: 'P12 Vendor D', kind: 'company' }, ADMIN)
    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P12 Vendor D', partyRef: `vendor:${vendorId}`, amount: 400_000, date: today }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    await processPayment(pay.id, adminUser as never)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId, date: today, lines: [{ description: 'd-target', qty: 1, unitPrice: 400_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    // Confirm WITHOUT the userId auto-consumption trigger's side effect racing —
    // call consumeUnappliedForVendor directly, twice, concurrently, against the
    // now-open invoice (confirmPurchaseInvoice already auto-consumed once; to
    // exercise the race deliberately we top up unapplied cash again first).
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay2 = await createPayment({ paymentType: 'supplier_payment', party: 'P12 Vendor D', partyRef: `vendor:${vendorId}`, amount: 250_000, date: today, memo: 'd-topup' }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay2.id])
    await processPayment(pay2.id, adminUser as never)
    const inv2 = await savePurchaseDoc({ docType: 'invoice', vendorId, date: today, lines: [{ description: 'd-target-2', qty: 1, unitPrice: 250_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    // Don't auto-confirm (would consume immediately, single-threaded) — leave
    // it draft, then race two DIRECT concurrent consumeUnappliedForVendor
    // calls against the same 250,000 unapplied balance while inv2 is
    // manually opened first, un-raced, so both concurrent calls see the
    // SAME available target.
    await pgQuery(`UPDATE purchase_documents SET status='confirmed' WHERE id=$1`, [inv2])
    const [r1, r2] = await Promise.all([consumeUnappliedForVendor(vendorId, ADMIN), consumeUnappliedForVendor(vendorId, ADMIN)])
    const totalConsumed = r1.totalConsumed + r2.totalConsumed
    ok(Math.abs(totalConsumed - 250_000) < 0.01, `two concurrent consumption calls together consume EXACTLY the 250,000 available, never double — ${totalConsumed}`)
    const inv2After = await one<{ status: string; paid_total: number }>(`SELECT status, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [inv2])
    ok(inv2After.status === 'paid' && Math.abs(inv2After.paid_total - 250_000) < 0.01, `invoice settled exactly once despite the race — ${JSON.stringify(inv2After)}`)
    const remaining = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE vendor_id=$1 AND document_id IS NULL`, [vendorId])
    ok(Math.abs(remaining.s) < 0.01, `zero unapplied balance remains after the race — ${remaining.s}`)
  }

  console.log('— CONCURRENCY Scenario E: 2 concurrent consumption workers vs the SAME single invoice, unapplied larger than needed —')
  {
    const { vendorId } = await makeUnapplied('P12 Vendor E', 900_000, ADMIN, adminUser, today)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId, date: today, lines: [{ description: 'e-target', qty: 1, unitPrice: 500_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await pgQuery(`UPDATE purchase_documents SET status='confirmed' WHERE id=$1`, [invId])   // open, unconsumed yet
    const [r1, r2] = await Promise.all([consumeUnappliedForVendor(vendorId, ADMIN), consumeUnappliedForVendor(vendorId, ADMIN)])
    const totalConsumed = r1.totalConsumed + r2.totalConsumed
    ok(Math.abs(totalConsumed - 500_000) < 0.01, `invoice's own outstanding balance (500,000) is never exceeded despite 900,000 available and two racing workers — ${totalConsumed}`)
    const invAfter = await one<{ status: string; paid_total: number }>(`SELECT status, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(invAfter.status === 'paid' && Math.abs(invAfter.paid_total - 500_000) < 0.01, `invoice paid_total never exceeds its own total under the race — ${JSON.stringify(invAfter)}`)
  }

  console.log('— CONCURRENCY Scenario F: consumption vs a DISTINCT new Treasury supplier payment for the SAME vendor, running concurrently —')
  {
    const { vendorId } = await makeUnapplied('P12 Vendor F', 300_000, ADMIN, adminUser, today)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId, date: today, lines: [{ description: 'f-target', qty: 1, unitPrice: 300_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await pgQuery(`UPDATE purchase_documents SET status='confirmed' WHERE id=$1`, [invId])   // open, unconsumed
    const pay2 = await createPayment({ paymentType: 'supplier_payment', party: 'P12 Vendor F', partyRef: `vendor:${vendorId}`, amount: 150_000, date: today, memo: 'f-concurrent' }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay2.id])
    const [consumeRes, payRes] = await Promise.all([
      consumeUnappliedForVendor(vendorId, ADMIN),
      processPayment(pay2.id, adminUser as never),
    ])
    const invAfter = await one<{ status: string; paid_total: number }>(`SELECT status, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(invAfter.status === 'paid' && Math.abs(invAfter.paid_total - 300_000) < 0.01, `the invoice is settled exactly once (from the pre-existing unapplied balance, since consumeUnappliedForVendor's own snapshot ran first or the lock ordered them), never touched twice — ${JSON.stringify(invAfter)}`)
    ok(invAfter.paid_total <= 300_000 + 0.01, `invoice never overpaid despite a concurrent NEW Treasury payment landing for the same vendor — ${invAfter.paid_total}`)
    const vendorTotalPaid = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE vendor_id=$1`, [vendorId])
    ok(Math.abs(vendorTotalPaid.s - (300_000 + 150_000)) < 0.01, `vendor's total paid = original unapplied (300,000) + the new concurrent payment (150,000), no money lost or duplicated — ${vendorTotalPaid.s}`)
    ok(typeof consumeRes.totalConsumed === 'number' && typeof payRes.unappliedAmount === 'number', 'both concurrent operations completed without throwing, both self-consistent')
  }

  console.log('— CLOSED FISCAL PERIOD: consumption succeeds against an invoice whose period has since been closed (no new GL event is created, so the period gate is not applicable) —')
  {
    const pastDate = '2018-05-10'
    const vendorId = await createVendor({ name: 'P12 Vendor Period', kind: 'company' }, ADMIN)
    // The unapplied balance must exist BEFORE the invoice is opened, and the
    // invoice must be opened WITHOUT going through confirmPurchaseInvoice
    // (whose own auto-consumption would settle it immediately, before the
    // period below even exists) — this isolates an EXPLICIT
    // consumeUnappliedForVendor call as the thing actually being tested
    // against a closed period, not Phase 10's payment-time allocation or
    // Phase 12's auto-trigger.
    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P12 Vendor Period', partyRef: `vendor:${vendorId}`, amount: 90_000, date: today }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    await processPayment(pay.id, adminUser as never)   // vendor has zero open invoices -> fully unapplied
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId, date: pastDate, lines: [{ description: 'old', qty: 1, unitPrice: 90_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await pgQuery(`UPDATE purchase_documents SET status='confirmed' WHERE id=$1`, [invId])   // opened directly, no GL post, no auto-consumption
    const periodId = await createPeriod({ name: 'P12 closed 2018', startDate: '2018-01-01', endDate: '2018-12-31', kind: 'year' })
    await transitionPeriod(periodId, 'closed', ADMIN)

    const res = await consumeUnappliedForVendor(vendorId, ADMIN)
    ok(res.totalConsumed === 90_000, `explicit consumption against an invoice inside a NOW-CLOSED fiscal period succeeds — no new GL event, so the period gate correctly does not apply — ${res.totalConsumed}`)
    const inv = await one<{ status: string }>(`SELECT status FROM purchase_documents WHERE id=$1`, [invId])
    ok(inv.status === 'paid', 'the old invoice settles correctly despite its period being closed')
  }

  console.log('— GL INTEGRITY: consumption creates NO new GL entries, never double-posts —')
  {
    const before = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    const { vendorId } = await makeUnapplied('P12 Vendor GL', 220_000, ADMIN, adminUser, today)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId, date: today, lines: [{ description: 'gl-target', qty: 1, unitPrice: 220_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    const beforeConfirm = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    await confirmPurchaseInvoice(invId, ADMIN)   // posts ONE GL entry for the invoice itself + auto-consumes (no extra GL)
    const afterConfirm = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    ok(afterConfirm.c === beforeConfirm.c + 1, `confirming the invoice posts exactly ONE new GL entry (the invoice itself) — consumption added zero more — ${beforeConfirm.c} -> ${afterConfirm.c}`)

    const rows = await pgQuery<{ id: number; gl_entry_id: number | null }>(`SELECT id, gl_entry_id FROM purchase_payments WHERE reference LIKE 'AP-CONSUME:%' AND vendor_id=$1`, [vendorId])
    let doublePosted = false
    for (const r of rows) {
      const res = await postPurchasePaymentToGl(r.id, ADMIN)
      if (!res.alreadyPosted) doublePosted = true
    }
    ok(!doublePosted, 'calling postPurchasePaymentToGl on every consumption row correctly refuses to post (alreadyPosted=true for all) — no phantom Dr AP/Cr Bank entry')
    const finalCount = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    ok(finalCount.c === before.c + 2, `only the 2 real GL events this block caused exist — the unapplied payment's own post + the invoice's own post; consumption contributed zero — before=${before.c} final=${finalCount.c}`)
  }

  console.log('— ROLLBACK: forced failure after a consumption-shaped write must roll back everything atomically —')
  {
    const { vendorId } = await makeUnapplied('P12 Vendor RB', 150_000, ADMIN, adminUser, today)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId, date: today, lines: [{ description: 'rb-target', qty: 1, unitPrice: 150_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await pgQuery(`UPDATE purchase_documents SET status='confirmed' WHERE id=$1`, [invId])   // open, NOT yet consumed
    const beforeGl = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    const beforeRows = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_payments WHERE vendor_id=$1`, [vendorId])
    let threw = false
    try {
      await withTransaction(async query => {
        await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`treasury_ap_allocate:vendor:${vendorId}`])
        await query(`INSERT INTO purchase_payments (vendor_id, document_id, date, amount, method, reference, created_by, created_at) VALUES ($1,NULL,$2,$3,'bank','AP-CONSUME:FORCED',$4,${new Date().toISOString()})`, [vendorId, today, -150_000, ADMIN])
        await query(`INSERT INTO purchase_payments (vendor_id, document_id, date, amount, method, reference, created_by, created_at) VALUES ($1,$2,$3,$4,'bank','AP-CONSUME:FORCED',$5,${new Date().toISOString()})`, [vendorId, invId, today, 150_000, ADMIN])
        await query(`UPDATE purchase_documents SET paid_total=150000, status='paid' WHERE id=$1`, [invId])
        throw new Error('forced rollback mid-consumption')
      })
    } catch { threw = true }
    ok(threw, 'forced failure threw')
    const afterGl = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    ok(beforeGl.c === afterGl.c, `no stray GL entry survives the forced rollback — ${beforeGl.c} == ${afterGl.c}`)
    const afterRows = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_payments WHERE vendor_id=$1`, [vendorId])
    ok(beforeRows.c === afterRows.c, `zero orphan purchase_payments rows survive — ${beforeRows.c} == ${afterRows.c}`)
    const inv = await one<{ status: string; paid_total: number }>(`SELECT status, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(inv.status === 'confirmed' && inv.paid_total === 0, `invoice reverted to its pre-transaction state — ${JSON.stringify(inv)}`)
    const remaining = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE vendor_id=$1 AND document_id IS NULL`, [vendorId])
    ok(Math.abs(remaining.s - 150_000) < 0.01, `the original unapplied amount is fully restored/untouched — ${remaining.s}`)
  }

  console.log('— PRECISION MATRIX: sub-unit and large amounts, exact conservation —')
  {
    const cases = [0.01, 0.02, 0.05, 0.1, 0.99, 1.01, 999.99, 1_000_000.01]
    for (const amt of cases) {
      const vendorId = await createVendor({ name: `P12 Precision ${amt}`, kind: 'company' }, ADMIN)
      const pay = await createPayment({ paymentType: 'supplier_payment', party: `p${amt}`, partyRef: `vendor:${vendorId}`, amount: amt, date: today }, ADMIN)
      await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
      await processPayment(pay.id, adminUser as never)
      const invId = await savePurchaseDoc({ docType: 'invoice', vendorId, date: today, lines: [{ description: 'precision', qty: 1, unitPrice: amt, discountPct: 0, taxPct: 0 }] }, ADMIN)
      await confirmPurchaseInvoice(invId, ADMIN)
      const inv = await one<{ paid_total: number }>(`SELECT paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
      ok(Math.abs(Number(inv.paid_total) - amt) < 0.005, `amount ${amt}: invoice paid_total == exactly ${amt} — actual ${inv.paid_total}`)
      const remaining = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE vendor_id=$1 AND document_id IS NULL`, [vendorId])
      ok(Math.abs(remaining.s) < 0.005, `amount ${amt}: zero precision drift in the remaining unapplied balance — ${remaining.s}`)
    }
  }

  console.log('— reconciliation: fresh trial balance ties out after every Phase 12 scenario —')
  {
    const tallies = await loadTallies()
    const tb = trialBalance(tallies)
    ok(Math.abs(tb.totalDebit - tb.totalCredit) < 0.01, `Σdebit == Σcredit — ${tb.totalDebit} == ${tb.totalCredit}`)
  }

  console.log(`\n${failed === 0 ? '✅ ALL' : `❌ ${failed}/${n}`} Phase 12 assertions passed`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
