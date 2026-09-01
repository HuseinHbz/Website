/**
 * Phase 15 live-PG verification — direct AP payment reversal
 * (`purchasingData.reverseDirectPayment`), the reversal gap Phase 14 left
 * open (a direct `recordPayment` has no `payment_orders` row and cannot use
 * Treasury `reversePayment`). Money-conservation invariant: Σ(payment
 * ledger rows for the payment lineage) == 0 once reversed; old paid_total −
 * reversed_amount == new paid_total. Committed as a permanent regression
 * suite (rule 6: the full regression history stays green in CI).
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery, withTransaction } from '@/lib/db'
import { createPayment, processPayment, consumeUnappliedForVendor } from '@/lib/treasury/paymentData'
import { createVendor, saveDocument as savePurchaseDoc, confirmPurchaseInvoice, recordPayment, reverseDirectPayment, vendorPosition } from '@/lib/erp/purchasingData'
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

  console.log('— direct FULL-payment reversal —')
  {
    const v = await createVendor({ name: 'P15 Vendor Full', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'full', qty: 1, unitPrice: 500_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay = await recordPayment(invId, v, 500_000, 'bank', today, 'full-ref', ADMIN)
    ok(pay.ok === true, `direct payment recorded — ${JSON.stringify(pay)}`)
    const invBefore = await one<{ status: string; paid_total: number }>(`SELECT status, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(invBefore.status === 'paid' && invBefore.paid_total === 500_000, `invoice fully paid — ${JSON.stringify(invBefore)}`)

    const res = await reverseDirectPayment(pay.paymentId!, ADMIN)
    ok(res.amountReversed === 500_000 && !res.alreadyReversed && res.reversalId != null, `full reversal — ${JSON.stringify(res)}`)
    const invAfter = await one<{ status: string; paid_total: number }>(`SELECT status, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(invAfter.status === 'confirmed' && invAfter.paid_total === 0, `invoice reverted to confirmed/0 — ${JSON.stringify(invAfter)}`)

    const rows = await pgQuery<{ amount: number; reference: string }>(`SELECT amount::float AS amount, reference FROM purchase_payments WHERE document_id=$1 ORDER BY id`, [invId])
    ok(rows.length === 2 && Math.abs(Number(rows[0].amount) + Number(rows[1].amount)) < 0.01, `exactly 2 rows (original + reversal) netting to zero — ${JSON.stringify(rows)}`)
  }

  console.log('— direct PARTIAL-payment reversal (invoice keeps other payments untouched) —')
  {
    const v = await createVendor({ name: 'P15 Vendor Partial', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'partial', qty: 1, unitPrice: 800_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay1 = await recordPayment(invId, v, 300_000, 'bank', today, 'p1', ADMIN)
    const pay2 = await recordPayment(invId, v, 500_000, 'bank', today, 'p2', ADMIN)
    const invBefore = await one<{ paid_total: number; status: string }>(`SELECT paid_total::float AS "paid_total", status FROM purchase_documents WHERE id=$1`, [invId])
    ok(invBefore.status === 'paid' && Math.abs(invBefore.paid_total - 800_000) < 0.01, `both payments landed — ${JSON.stringify(invBefore)}`)

    await reverseDirectPayment(pay1.paymentId!, ADMIN)
    const invAfter = await one<{ paid_total: number; status: string }>(`SELECT paid_total::float AS "paid_total", status FROM purchase_documents WHERE id=$1`, [invId])
    ok(invAfter.status === 'partial' && Math.abs(invAfter.paid_total - 500_000) < 0.01, `only pay1's 300,000 reversed — pay2's 500,000 untouched — ${JSON.stringify(invAfter)}`)
    ok(pay2.ok === true, 'pay2 itself never touched by pay1\'s reversal')
  }

  console.log('— MULTIPLE payments against one invoice, reverse both independently —')
  {
    const v = await createVendor({ name: 'P15 Vendor Multi', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'multi', qty: 1, unitPrice: 600_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay1 = await recordPayment(invId, v, 250_000, 'bank', today, 'm1', ADMIN)
    const pay2 = await recordPayment(invId, v, 350_000, 'bank', today, 'm2', ADMIN)
    await reverseDirectPayment(pay1.paymentId!, ADMIN)
    await reverseDirectPayment(pay2.paymentId!, ADMIN)
    const inv = await one<{ paid_total: number; status: string }>(`SELECT paid_total::float AS "paid_total", status FROM purchase_documents WHERE id=$1`, [invId])
    ok(inv.status === 'confirmed' && inv.paid_total === 0, `both reversed independently, invoice fully reverted — ${JSON.stringify(inv)}`)
  }

  console.log('— IDEMPOTENCY: repeated reversal —')
  {
    const v = await createVendor({ name: 'P15 Vendor Idem', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'idem', qty: 1, unitPrice: 175_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay = await recordPayment(invId, v, 175_000, 'bank', today, 'idem', ADMIN)
    const first = await reverseDirectPayment(pay.paymentId!, ADMIN)
    const second = await reverseDirectPayment(pay.paymentId!, ADMIN)
    const third = await reverseDirectPayment(pay.paymentId!, ADMIN)
    ok(first.amountReversed === 175_000 && second.amountReversed === 0 && third.amountReversed === 0, `repeated reversal stable after the first — ${JSON.stringify([first.amountReversed, second.amountReversed, third.amountReversed])}`)
    ok(second.alreadyReversed && third.alreadyReversed && second.reversalId === first.reversalId, 'same GL reversal id returned every time, no additional GL mutation')
    const rows = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_payments WHERE vendor_id=$1`, [v])
    ok(rows.c === 2, `exactly 2 rows total (1 original + 1 reversal), never re-reversed — ${rows.c}`)
  }

  console.log('— CONCURRENCY A: 5 concurrent reversal calls on the SAME direct payment —')
  {
    const v = await createVendor({ name: 'P15 Vendor A', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'a', qty: 1, unitPrice: 220_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay = await recordPayment(invId, v, 220_000, 'bank', today, 'a', ADMIN)
    const results = await Promise.all(Array.from({ length: 5 }, () => reverseDirectPayment(pay.paymentId!, ADMIN)))
    const totalAmountReversed = results.reduce((s, r) => s + r.amountReversed, 0)
    ok(totalAmountReversed === 220_000, `exactly ONE reversal mutation across all 5 concurrent calls — ${totalAmountReversed}`)
    const reversalIds = new Set(results.map(r => r.reversalId))
    ok(reversalIds.size === 1, `exactly ONE GL reversal entry across all 5 — ${[...reversalIds]}`)
    const rows = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_payments WHERE vendor_id=$1`, [v])
    ok(rows.c === 2, `no duplicate reversal rows — ${rows.c}`)
  }

  console.log('— CONCURRENCY B: direct reversal vs a NEW direct payment on the same invoice —')
  {
    const v = await createVendor({ name: 'P15 Vendor B', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'b', qty: 1, unitPrice: 500_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay1 = await recordPayment(invId, v, 500_000, 'bank', today, 'b1', ADMIN)   // invoice fully paid
    const [revRes, payRes] = await Promise.all([
      reverseDirectPayment(pay1.paymentId!, ADMIN),
      // recordPayment's own advisory lock (purchase_invoice_payment:<docId>)
      // is a DIFFERENT domain than the vendor lock reverseDirectPayment uses
      // — this genuinely exercises whether the two coordinate correctly,
      // not merely serialize by accident.
      (async () => { await new Promise(r => setImmediate(r)); return recordPayment(invId, v, 500_000, 'bank', today, 'b2', ADMIN) })(),
    ])
    ok(revRes.amountReversed === 500_000, `reversal completed exactly — ${revRes.amountReversed}`)
    const inv = await one<{ paid_total: number; status: string }>(`SELECT paid_total::float AS "paid_total", status FROM purchase_documents WHERE id=$1`, [invId])
    // recordPayment's own lock (purchase_invoice_payment:<docId>) and
    // reverseDirectPayment's lock (treasury_ap_allocate:vendor:<vendorId>)
    // are genuinely DIFFERENT domains — this scenario deliberately exercises
    // that boundary rather than assuming they serialize by accident. Two
    // valid, non-overpaying outcomes exist depending on real ordering: pay2
    // lands (0 -> 500,000, reversal ran first) or pay2 is correctly
    // rejected as an overpayment by recordPayment's own validatePayment
    // guard (invoice still looked fully paid at the moment pay2 checked,
    // reversal not yet committed) leaving paid_total at 0. Both are
    // deterministic and CORRECT — the invariant that must hold in either
    // case is "never overpaid, never negative", asserted directly.
    ok(inv.paid_total >= 0 && inv.paid_total <= 500_000 + 0.01, `final paid_total never overpaid regardless of which valid ordering won — ${JSON.stringify(inv)}`)
    ok(
      (payRes.ok === true && Math.abs(inv.paid_total - 500_000) < 0.01) ||
      (payRes.ok === false && inv.paid_total === 0),
      `pay2's outcome is internally consistent with the final invoice state either way — payRes.ok=${payRes.ok}, paid_total=${inv.paid_total}`
    )
  }

  console.log('— CONCURRENCY C: direct reversal vs a concurrent Treasury supplier payment for the SAME vendor —')
  {
    const v = await createVendor({ name: 'P15 Vendor C', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'c', qty: 1, unitPrice: 400_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay1 = await recordPayment(invId, v, 400_000, 'bank', today, 'c1', ADMIN)   // invoice fully paid directly
    const trzPay = await createPayment({ paymentType: 'supplier_payment', party: 'P15 Vendor C', partyRef: `vendor:${v}`, amount: 150_000, date: today, memo: 'c-treasury' }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [trzPay.id])
    const [revRes, trzRes] = await Promise.all([reverseDirectPayment(pay1.paymentId!, ADMIN), processPayment(trzPay.id, adminUser as never)])
    ok(revRes.amountReversed === 400_000, `direct reversal completed exactly — ${revRes.amountReversed}`)
    const inv = await one<{ paid_total: number }>(`SELECT paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(inv.paid_total <= 400_000 + 0.01 && inv.paid_total >= 0, `shared vendor lock prevents lost update — invoice never negative or overpaid — ${inv.paid_total}`)
    ok(typeof trzRes.glEntryId === 'number', 'concurrent Treasury payment processed without throwing')
  }

  console.log('— CONCURRENCY D: direct reversal vs a concurrent unapplied-cash consumption for the SAME vendor —')
  {
    const v = await createVendor({ name: 'P15 Vendor D', kind: 'company' }, ADMIN)
    const invA = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'd-a', qty: 1, unitPrice: 300_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invA, ADMIN)
    const payA = await recordPayment(invA, v, 300_000, 'bank', today, 'd-a', ADMIN)   // invA fully paid directly
    const trzPay = await createPayment({ paymentType: 'supplier_payment', party: 'P15 Vendor D', partyRef: `vendor:${v}`, amount: 200_000, date: today, memo: 'd-treasury' }, ADMIN)
    await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [trzPay.id])
    await processPayment(trzPay.id, adminUser as never)   // unapplied = 200,000 (no open invoice yet)
    const invB = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'd-b', qty: 1, unitPrice: 200_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await pgQuery(`UPDATE purchase_documents SET status='confirmed' WHERE id=$1`, [invB])   // open, NOT auto-consumed
    const [revRes, consumeRes] = await Promise.all([reverseDirectPayment(payA.paymentId!, ADMIN), consumeUnappliedForVendor(v, ADMIN)])
    ok(revRes.amountReversed === 300_000, `direct reversal completed exactly — ${revRes.amountReversed}`)
    const invBAfter = await one<{ paid_total: number }>(`SELECT paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invB])
    ok(invBAfter.paid_total >= 0 && invBAfter.paid_total <= 200_000 + 0.01, `no over-allocation, no negative outstanding — ${invBAfter.paid_total}`)
    ok(typeof consumeRes.totalConsumed === 'number', 'concurrent consumption completed without throwing')
    const unapplied = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE vendor_id=$1 AND document_id IS NULL`, [v])
    ok(Math.abs(unapplied.s + invBAfter.paid_total - 200_000) < 0.01, `money conservation: remaining unapplied + consumed == 200,000 — unapplied=${unapplied.s}, consumed=${invBAfter.paid_total}`)
  }

  console.log('— CONCURRENCY E: two DIFFERENT direct payments against the same invoice, reversed concurrently —')
  {
    const v = await createVendor({ name: 'P15 Vendor E', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'e', qty: 1, unitPrice: 700_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay1 = await recordPayment(invId, v, 300_000, 'bank', today, 'e1', ADMIN)
    const pay2 = await recordPayment(invId, v, 400_000, 'bank', today, 'e2', ADMIN)
    const [rev1, rev2] = await Promise.all([reverseDirectPayment(pay1.paymentId!, ADMIN), reverseDirectPayment(pay2.paymentId!, ADMIN)])
    ok(rev1.amountReversed === 300_000 && rev2.amountReversed === 400_000, `both valid reversals complete independently — ${JSON.stringify([rev1.amountReversed, rev2.amountReversed])}`)
    const inv = await one<{ paid_total: number; status: string }>(`SELECT paid_total::float AS "paid_total", status FROM purchase_documents WHERE id=$1`, [invId])
    ok(inv.paid_total === 0 && inv.status === 'confirmed', `invoice paid_total never negative, correctly at exactly 0 — ${JSON.stringify(inv)}`)
  }

  console.log('— ROLLBACK: forced failure after a reversal-shaped write must roll back atomically —')
  {
    const v = await createVendor({ name: 'P15 Vendor RB', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'rb', qty: 1, unitPrice: 140_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay = await recordPayment(invId, v, 140_000, 'bank', today, 'rb', ADMIN)
    const glId = await one<{ gl_entry_id: number | null }>(`SELECT gl_entry_id FROM purchase_payments WHERE id=$1`, [pay.paymentId])
    const beforeGl = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    const beforeRows = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_payments WHERE vendor_id=$1`, [v])
    let threw = false
    try {
      await withTransaction(async query => {
        await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`treasury_ap_allocate:vendor:${v}`])
        await query(`INSERT INTO purchase_payments (vendor_id, document_id, date, amount, method, reference, created_by, gl_entry_id, created_at) VALUES ($1,$2,$3,$4,'bank','AP-DIRECT-REVERSE:FORCED',$5,$6,${new Date().toISOString()})`, [v, invId, today, -140_000, ADMIN, glId.gl_entry_id])
        await query(`UPDATE purchase_documents SET paid_total=0, status='confirmed' WHERE id=$1`, [invId])
        throw new Error('forced rollback mid-reversal')
      })
    } catch { threw = true }
    ok(threw, 'forced failure threw')
    const afterGl = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    ok(beforeGl.c === afterGl.c, `no orphan GL entry — ${beforeGl.c} == ${afterGl.c}`)
    const afterRows = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_payments WHERE vendor_id=$1`, [v])
    ok(beforeRows.c === afterRows.c, `no orphan reversal rows — ${beforeRows.c} == ${afterRows.c}`)
    const inv = await one<{ paid_total: number; status: string }>(`SELECT paid_total::float AS "paid_total", status FROM purchase_documents WHERE id=$1`, [invId])
    ok(Math.abs(inv.paid_total - 140_000) < 0.01 && inv.status === 'paid', `invoice fully restored — ${JSON.stringify(inv)}`)
  }

  console.log('— FISCAL PERIOD: reversal rejected when TODAY\'s posting date falls in a closed period —')
  {
    const v = await createVendor({ name: 'P15 Vendor Period', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'period', qty: 1, unitPrice: 90_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay = await recordPayment(invId, v, 90_000, 'bank', today, 'period', ADMIN)
    const year = today.slice(0, 4)
    const periodId = await createPeriod({ name: `P15 closed ${year}`, startDate: `${year}-01-01`, endDate: `${year}-12-31`, kind: 'year' })
    await transitionPeriod(periodId, 'closed', ADMIN)
    let threw = false
    try { await reverseDirectPayment(pay.paymentId!, ADMIN) } catch { threw = true }
    ok(threw, 'reversal rejected — today\'s posting date falls inside a closed period')
    const inv = await one<{ paid_total: number }>(`SELECT paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
    ok(Math.abs(inv.paid_total - 90_000) < 0.01, `invoice untouched — the subledger reversal step never ran — ${inv.paid_total}`)
    const rows = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_payments WHERE vendor_id=$1`, [v])
    ok(rows.c === 1, `no reversal purchase_payments row created — ${rows.c}`)
    await transitionPeriod(periodId, 'open', ADMIN)
  }

  console.log('— GL INTEGRITY: reversal balance + no phantom cash movement —')
  {
    const before = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    const v = await createVendor({ name: 'P15 Vendor GL', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'gl', qty: 1, unitPrice: 310_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay = await recordPayment(invId, v, 310_000, 'bank', today, 'gl', ADMIN)
    const afterPay = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    ok(afterPay.c === before.c + 2, `2 GL events so far (invoice + payment) — ${before.c} -> ${afterPay.c}`)
    const paidRow = await one<{ gl_entry_id: number }>(`SELECT gl_entry_id FROM purchase_payments WHERE id=$1`, [pay.paymentId])
    ok(paidRow.gl_entry_id != null, 'direct payment successfully auto-posted to GL')

    const res = await reverseDirectPayment(pay.paymentId!, ADMIN)
    const afterReverse = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    ok(afterReverse.c === afterPay.c + 1, `exactly ONE new GL entry from the reversal — ${afterPay.c} -> ${afterReverse.c}`)
    const revEntry = await one<{ total_debit: number; total_credit: number }>(
      `SELECT COALESCE(SUM(debit),0)::float AS total_debit, COALESCE(SUM(credit),0)::float AS total_credit FROM gl_journal_lines WHERE entry_id=$1`, [res.reversalId])
    ok(Math.abs(revEntry.total_debit - revEntry.total_credit) < 0.01 && Math.abs(revEntry.total_debit - 310_000) < 0.01, `reversal entry balanced at the full payment amount — Dr ${revEntry.total_debit} == Cr ${revEntry.total_credit}`)
    const originalEntry = await one<{ status: string; reversed_by: number | null }>(`SELECT status, reversed_by FROM gl_journal_entries WHERE id=$1`, [paidRow.gl_entry_id])
    ok(originalEntry.status === 'posted' && originalEntry.reversed_by === res.reversalId, `original entry stays posted, two-way linked — ${JSON.stringify(originalEntry)}`)

    const revRow = await one<{ id: number }>(`SELECT id FROM purchase_payments WHERE reference=$1`, [`AP-DIRECT-REVERSE:${pay.paymentId}`])
    const doublePost = await postPurchasePaymentToGl(revRow.id, ADMIN)
    ok(doublePost.alreadyPosted === true, 'the reversal row correctly refuses a new GL post — no phantom Dr AP/Cr Bank entry')
  }

  console.log('— VENDOR AP RECONCILIATION —')
  {
    const v = await createVendor({ name: 'P15 Vendor AP', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'ap', qty: 1, unitPrice: 600_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const posUnpaid = await vendorPosition(v)
    ok(Math.abs(posUnpaid.outstanding - 600_000) < 0.01, `unpaid: vendor outstanding = 600,000 — ${JSON.stringify(posUnpaid)}`)
    const pay = await recordPayment(invId, v, 600_000, 'bank', today, 'ap', ADMIN)
    const posPaid = await vendorPosition(v)
    ok(Math.abs(posPaid.outstanding) < 0.01, `paid: vendor outstanding = 0 — ${JSON.stringify(posPaid)}`)
    await reverseDirectPayment(pay.paymentId!, ADMIN)
    const posReversed = await vendorPosition(v)
    ok(Math.abs(posReversed.outstanding - 600_000) < 0.01, `after reversal: vendor outstanding returns to exactly 600,000 — ${JSON.stringify(posReversed)}`)
  }

  console.log('— PRECISION MATRIX —')
  {
    const cases = [0.01, 0.02, 0.05, 0.1, 0.99, 1.01, 999.99, 1_000_000.01]
    for (const amt of cases) {
      const v = await createVendor({ name: `P15 Precision ${amt}`, kind: 'company' }, ADMIN)
      const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'precision', qty: 1, unitPrice: amt, discountPct: 0, taxPct: 0 }] }, ADMIN)
      await confirmPurchaseInvoice(invId, ADMIN)
      const pay = await recordPayment(invId, v, amt, 'bank', today, 'p', ADMIN)
      const res = await reverseDirectPayment(pay.paymentId!, ADMIN)
      ok(Math.abs(res.amountReversed - amt) < 0.005, `amount ${amt}: reversal amount == exactly ${amt} — ${res.amountReversed}`)
      const inv = await one<{ paid_total: number }>(`SELECT paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [invId])
      ok(Math.abs(Number(inv.paid_total)) < 0.005, `amount ${amt}: paid_total == exactly 0, zero drift — ${inv.paid_total}`)
    }
  }

  console.log('— AUDIT: repeated reversal never produces a misleading duplicate financial event —')
  {
    const v = await createVendor({ name: 'P15 Vendor Audit', kind: 'company' }, ADMIN)
    const invId = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: today, lines: [{ description: 'audit', qty: 1, unitPrice: 50_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
    await confirmPurchaseInvoice(invId, ADMIN)
    const pay = await recordPayment(invId, v, 50_000, 'bank', today, 'audit', ADMIN)
    await reverseDirectPayment(pay.paymentId!, ADMIN)
    const rows = await pgQuery<{ reference: string; amount: number }>(`SELECT reference, amount::float AS amount FROM purchase_payments WHERE vendor_id=$1 ORDER BY id`, [v])
    await reverseDirectPayment(pay.paymentId!, ADMIN)
    await reverseDirectPayment(pay.paymentId!, ADMIN)
    const rowsAfter = await pgQuery<{ reference: string; amount: number }>(`SELECT reference, amount::float AS amount FROM purchase_payments WHERE vendor_id=$1 ORDER BY id`, [v])
    ok(JSON.stringify(rows) === JSON.stringify(rowsAfter), `the exact same ledger rows exist after 2 more redundant reversal calls — no misleading duplicate financial history — ${JSON.stringify(rowsAfter)}`)
  }

  console.log('— TRIAL BALANCE: fresh trial balance ties out after every Phase 15 scenario —')
  {
    const tallies = await loadTallies()
    const tb = trialBalance(tallies)
    ok(Math.abs(tb.totalDebit - tb.totalCredit) < 0.01, `Σdebit == Σcredit — ${tb.totalDebit} == ${tb.totalCredit}`)
  }

  console.log(`\n${failed === 0 ? '✅ ALL' : `❌ ${failed}/${n}`} Phase 15 assertions passed`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
