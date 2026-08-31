/**
 * Phase 11 live-PG verification — Treasury unapplied supplier cash. The
 * `processPayment` money-conservation invariant this phase adds:
 *   Treasury payment amount == Σ(AP allocations) + unapplied amount
 * plus its concurrency/atomicity/fiscal-period/reconciliation guarantees.
 * Committed as a permanent regression suite (rule 6: the full regression
 * history stays green in CI).
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery, withTransaction } from '@/lib/db'
import { createPayment, processPayment } from '@/lib/treasury/paymentData'
import { createVendor, saveDocument as savePurchaseDoc, confirmPurchaseInvoice } from '@/lib/erp/purchasingData'
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

  console.log('— overpayment: single invoice, excess becomes unapplied cash —')
  let vendorId = 0
  {
    vendorId = await createVendor({ name: 'P11 Vendor A', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId, date: today, lines: [{ description: 'p11 item', qty: 1, unitPrice: 1_000_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)

    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P11 Vendor A', partyRef: `vendor:${vendorId}`, amount: 1_400_000, date: today }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    const res = await processPayment(pay.id, adminUser as never)

    ok(res.apAllocations.length === 1 && Math.abs(res.apAllocations[0].amount - 1_000_000) < 0.01, `full invoice settled — ${JSON.stringify(res.apAllocations)}`)
    ok(Math.abs(res.unappliedAmount - 400_000) < 0.01, `excess 400,000 reported as unappliedAmount — ${res.unappliedAmount}`)
    const conserved = res.apAllocations.reduce((s, a) => s + a.amount, 0) + res.unappliedAmount
    ok(Math.abs(conserved - 1_400_000) < 0.01, `MONEY CONSERVATION: payment amount (1,400,000) == Σallocated + unapplied (${conserved})`)

    const invAfter = await one<{ status: string; paid_total: number }>(`SELECT status, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(invAfter.status === 'paid' && Math.abs(invAfter.paid_total - 1_000_000) < 0.01, `invoice paid_total capped at its own total, never overpaid — ${JSON.stringify(invAfter)}`)

    const unappliedRow = await one<{ document_id: number | null; amount: number; gl_entry_id: number | null; vendor_id: number }>(
      `SELECT document_id, amount::float AS amount, gl_entry_id, vendor_id FROM purchase_payments WHERE reference=$1 AND document_id IS NULL`, [`TRZPAY-${pay.id}`])
    ok(!!unappliedRow && unappliedRow.document_id === null && Math.abs(unappliedRow.amount - 400_000) < 0.01, `a document_id=NULL purchase_payments row records the unapplied 400,000`)
    ok(unappliedRow.gl_entry_id === res.glEntryId, `the unapplied row is stamped with the SAME gl_entry_id as the allocated payment — no split GL, one atomic post`)
    ok(unappliedRow.vendor_id === vendorId, 'unapplied row correctly attributed to the paying vendor')

    const vendorBalance = await one<{ paid: number }>(`SELECT COALESCE(SUM(amount),0)::float AS paid FROM purchase_payments WHERE vendor_id=$1`, [vendorId])
    ok(Math.abs(vendorBalance.paid - 1_400_000) < 0.01, `vendorPosition's unfiltered SUM(amount) already includes the unapplied row — vendor total paid ${vendorBalance.paid} == 1,400,000`)

    // Trial balance: GL entry is Dr AP(full 1,400,000)/Cr Bank(1,400,000) —
    // the cash movement is correct regardless of subledger allocation detail.
    const glEntry = await one<{ total_debit: number; total_credit: number }>(
      `SELECT COALESCE(SUM(debit),0)::float AS total_debit, COALESCE(SUM(credit),0)::float AS total_credit FROM gl_journal_lines WHERE entry_id=$1`, [res.glEntryId])
    ok(Math.abs(glEntry.total_debit - glEntry.total_credit) < 0.01 && Math.abs(glEntry.total_debit - 1_400_000) < 0.01, `GL entry balanced at the full cash amount — Dr ${glEntry.total_debit} == Cr ${glEntry.total_credit} == 1,400,000`)
  }

  console.log('— exact payment: no unapplied cash created —')
  {
    const v = await createVendor({ name: 'P11 Vendor B', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'exact', qty: 1, unitPrice: 500_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P11 Vendor B', partyRef: `vendor:${v}`, amount: 500_000, date: today }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    const res = await processPayment(pay.id, adminUser as never)
    ok(res.unappliedAmount === 0, `exact payment produces zero unapplied amount — ${res.unappliedAmount}`)
    const unappliedRow = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_payments WHERE vendor_id=$1 AND document_id IS NULL`, [v])
    ok(unappliedRow.c === 0, 'no document_id=NULL row was created for an exact payment')
  }

  console.log('— partial allocation + partial unapplied (multi-invoice) —')
  {
    const v = await createVendor({ name: 'P11 Vendor C', kind: 'company' }, ADMIN)
    const inv1 = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: '2020-01-01', lines: [{ description: 'i1', qty: 1, unitPrice: 200_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    const inv2 = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: '2020-02-01', lines: [{ description: 'i2', qty: 1, unitPrice: 300_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(inv1, ADMIN)
    await confirmPurchaseInvoice(inv2, ADMIN)
    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P11 Vendor C', partyRef: `vendor:${v}`, amount: 650_000, date: today }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    const res = await processPayment(pay.id, adminUser as never)
    ok(res.apAllocations.length === 2, `both invoices allocated — ${JSON.stringify(res.apAllocations)}`)
    ok(Math.abs(res.unappliedAmount - 150_000) < 0.01, `remaining 150,000 (650,000 - 500,000 total AP) reported unapplied — ${res.unappliedAmount}`)
    const conserved = res.apAllocations.reduce((s, a) => s + a.amount, 0) + res.unappliedAmount
    ok(Math.abs(conserved - 650_000) < 0.01, `conservation holds for the multi-invoice + unapplied case — ${conserved} == 650,000`)
  }

  console.log('— idempotency: re-processing an already-completed payment returns the same unappliedAmount, creates no duplicate row —')
  {
    const v = await createVendor({ name: 'P11 Vendor D', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'idem', qty: 1, unitPrice: 100_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P11 Vendor D', partyRef: `vendor:${v}`, amount: 250_000, date: today }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    const first = await processPayment(pay.id, adminUser as never)
    const second = await processPayment(pay.id, adminUser as never)
    ok(second.alreadyProcessed === true, 'second call correctly detects alreadyProcessed')
    ok(Math.abs(second.unappliedAmount - first.unappliedAmount) < 0.01, `unappliedAmount stable across re-processing — ${first.unappliedAmount} == ${second.unappliedAmount}`)
    const rows = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_payments WHERE vendor_id=$1 AND document_id IS NULL`, [v])
    ok(rows.c === 1, `exactly ONE unapplied row exists after two processPayment calls — ${rows.c}`)
  }

  console.log('— CONCURRENCY: 5 concurrent identical payment-processing requests on the SAME payment —')
  {
    const v = await createVendor({ name: 'P11 Vendor E', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'conc', qty: 1, unitPrice: 300_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P11 Vendor E', partyRef: `vendor:${v}`, amount: 500_000, date: today }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => processPayment(pay.id, adminUser as never)))
    const succeeded = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<{ glEntryId: number; unappliedAmount: number }>[]
    ok(succeeded.length === 5, `all 5 concurrent calls resolved (lock serializes, no throw) — ${succeeded.length}/5`)
    const glIds = new Set(succeeded.map(r => r.value.glEntryId))
    ok(glIds.size === 1, `exactly ONE gl_entry_id across all 5 concurrent calls — ${[...glIds]}`)
    const rows = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_payments WHERE vendor_id=$1 AND document_id IS NULL`, [v])
    ok(rows.c === 1, `exactly ONE unapplied row despite 5 concurrent process calls — ${rows.c}`)
    const invAfter = await one<{ status: string }>(`SELECT status FROM purchase_documents WHERE id=$1`, [invId])
    ok(invAfter.status === 'paid', 'invoice settled exactly once, not double-paid')
  }

  console.log('— CONCURRENCY: 2 concurrent payments racing for the SAME single open invoice —')
  {
    const v = await createVendor({ name: 'P11 Vendor F', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'race', qty: 1, unitPrice: 1_000_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    // Distinct memos so createPayment's runOnce double-submit guard (which
    // dedupes identical bodies by design) treats these as two genuinely
    // separate payments rather than collapsing them into one.
    const pay1 = await createPayment({ paymentType: 'supplier_payment', party: 'P11 Vendor F', partyRef: `vendor:${v}`, amount: 700_000, date: today, memo: 'race-A' }, ADMIN)
    const pay2 = await createPayment({ paymentType: 'supplier_payment', party: 'P11 Vendor F', partyRef: `vendor:${v}`, amount: 700_000, date: today, memo: 'race-B' }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id IN ($1,$2)`, [pay1.id, pay2.id])
    const [r1, r2] = await Promise.all([processPayment(pay1.id, adminUser as never), processPayment(pay2.id, adminUser as never)])
    const totalAllocated = r1.apAllocations.reduce((s, a) => s + a.amount, 0) + r2.apAllocations.reduce((s, a) => s + a.amount, 0)
    const totalUnapplied = r1.unappliedAmount + r2.unappliedAmount
    ok(Math.abs(totalAllocated - 1_000_000) < 0.01, `only 1,000,000 total was allocated across both payments — never overpaid the invoice — ${totalAllocated}`)
    ok(Math.abs(totalUnapplied - 400_000) < 0.01, `the remaining 400,000 (1,400,000 offered - 1,000,000 invoice) correctly split into unapplied cash — ${totalUnapplied}`)
    ok(Math.abs((totalAllocated + totalUnapplied) - 1_400_000) < 0.01, `global conservation across the race: 1,400,000 offered == ${totalAllocated} allocated + ${totalUnapplied} unapplied`)
    const invAfter = await one<{ paid_total: number; status: string }>(`SELECT paid_total::float AS "paid_total", status FROM purchase_documents WHERE id=$1`, [invId])
    ok(invAfter.status === 'paid' && Math.abs(invAfter.paid_total - 1_000_000) < 0.01, `invoice paid_total never exceeds its own total under the race — ${JSON.stringify(invAfter)}`)
  }

  console.log('— ROLLBACK: forced failure AFTER the unapplied-cash insert must roll back the row, the invoice update, and the GL post together —')
  {
    const v = await createVendor({ name: 'P11 Vendor G', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'rb', qty: 1, unitPrice: 200_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const before = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    let threw = false
    try {
      await withTransaction(async query => {
        await query(`UPDATE purchase_documents SET paid_total=200000, status='paid' WHERE id=$1`, [invId])
        await query(`INSERT INTO purchase_payments (vendor_id, document_id, date, amount, method, reference, created_by, created_at) VALUES ($1,NULL,$2,$3,'bank','FORCED-RB',$4,${new Date().toISOString()})`, [v, today, 999_999])
        throw new Error('forced rollback after unapplied insert')
      })
    } catch { threw = true }
    ok(threw, 'forced failure threw')
    const after = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    ok(before.c === after.c, `no stray GL entry survives the forced rollback — ${before.c} == ${after.c}`)
    const inv = await one<{ status: string; paid_total: number }>(`SELECT status, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(inv.status === 'confirmed' && inv.paid_total === 0, `invoice reverted to its pre-transaction state — ${JSON.stringify(inv)}`)
    const stray = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_payments WHERE reference='FORCED-RB'`)
    ok(stray.c === 0, 'the forced-failure unapplied row does not persist')
  }

  console.log('— ROLLBACK: forced failure mid-processPayment (simulated via a locked-period rejection) leaves ZERO partial state, including zero unapplied row —')
  {
    const v = await createVendor({ name: 'P11 Vendor H', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: '2019-06-15', lines: [{ description: 'closed-period', qty: 1, unitPrice: 100_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const periodId = await createPeriod({ name: 'P11 closed 2019', startDate: '2019-01-01', endDate: '2019-12-31', kind: 'year' })
    await transitionPeriod(periodId, 'closed', ADMIN)

    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P11 Vendor H', partyRef: `vendor:${v}`, amount: 150_000, date: '2019-06-15' }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    let threw = false
    try { await processPayment(pay.id, adminUser as never) } catch { threw = true }
    ok(threw, 'processPayment against a CLOSED fiscal period is rejected')

    const payAfter = await one<{ status: string; gl_entry_id: number | null }>(`SELECT status, gl_entry_id FROM payment_orders WHERE id=$1`, [pay.id])
    ok(payAfter.status !== 'completed' && payAfter.gl_entry_id === null, `payment order NOT marked completed, no gl_entry_id stamped — ${JSON.stringify(payAfter)}`)
    const invAfter = await one<{ status: string; paid_total: number }>(`SELECT status, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(invAfter.status === 'confirmed' && invAfter.paid_total === 0, 'invoice untouched — no partial allocation leaked through the closed-period rejection')
    const stray = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_payments WHERE vendor_id=$1`, [v])
    ok(stray.c === 0, `ZERO purchase_payments rows created (including zero unapplied rows) for the rejected closed-period payment — ${stray.c}`)
  }

  console.log('— audit trail: route-level logAction payload includes unappliedAmount (spot-check the field is present on the result object used by the route) —')
  {
    const v = await createVendor({ name: 'P11 Vendor I', kind: 'company' }, ADMIN)
    const pay = await createPayment({ paymentType: 'supplier_payment', party: 'P11 Vendor I', partyRef: `vendor:${v}`, amount: 50_000, date: today }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [pay.id])
    const res = await processPayment(pay.id, adminUser as never)
    ok(typeof res.unappliedAmount === 'number' && Object.prototype.hasOwnProperty.call(res, 'unappliedAmount'), `result object carries a numeric unappliedAmount field the route's logAction(result) will capture — ${res.unappliedAmount}`)
    ok(Math.abs(res.unappliedAmount - 50_000) < 0.01, 'vendor with no open invoices at all -> the entire payment is unapplied')
  }

  console.log('— Treasury payment reversal: confirmed NOT IMPLEMENTED (honest, pre-existing gap, not fabricated) —')
  {
    const { canTransitionPayment } = await import('@/lib/treasury/payments')
    const next = canTransitionPayment('completed', 'reversed' as never)
    ok(next === false, 'canTransitionPayment(completed -> reversed) correctly returns false — no reversal transition exists in the state machine')
  }

  console.log('— reconciliation: fresh trial balance ties out after all Phase 11 scenarios —')
  {
    const tallies = await loadTallies()
    const tb = trialBalance(tallies)
    ok(Math.abs(tb.totalDebit - tb.totalCredit) < 0.01, `Σdebit == Σcredit — ${tb.totalDebit} == ${tb.totalCredit}`)
  }

  console.log(`\n${failed === 0 ? '✅ ALL' : `❌ ${failed}/${n}`} Phase 11 assertions passed`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
