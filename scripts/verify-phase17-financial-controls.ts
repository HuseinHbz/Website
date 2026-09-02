/**
 * Phase 17 live-PG verification — customer AR unapplied-receipt (advance)
 * consumption against future sales invoices, the AR-side mirror of Phase
 * 12's `consumeUnappliedForVendor`. Money-conservation invariant:
 *   source.amount == Σ(consumed) + remaining
 *   invoice.old_outstanding == allocated + invoice.new_outstanding
 * plus its concurrency/rollback/GL/fiscal-period/reversal guarantees.
 * Committed as a permanent regression suite (rule 6: the full regression
 * history stays green in CI).
 *
 * Assertion counting is fully dynamic (`n`/`failed`) — no fixed count is
 * ever written into this file or its output.
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery, withTransaction } from '@/lib/db'
import { createReceipt, reverseCustomerReceipt, consumeUnappliedForCustomer } from '@/lib/treasury/paymentData'
import { postSalesInvoiceToGl } from '@/lib/erp/salesData'
import { postSalesPaymentToGl } from '@/lib/erp/glPosting'
import { createPeriod, transitionPeriod } from '@/lib/erp/accountingData'
import { loadTallies } from '@/lib/erp/ledgerData'
import { trialBalance } from '@/lib/erp/ledger'
import { customerArBalance } from '@/lib/crm/customer360Data'

let n = 0, failed = 0
const ok = (c: boolean, l: string) => { n++; if (c) console.log(`  ✅ ${n}. ${l}`); else { failed++; console.error(`  ❌ ${n}. ${l}`) } }
const one = async <T>(sql: string, p: unknown[] = []) => (await pgQuery<T>(sql, p))[0]

let seq = 0
async function makeCustomer(name: string): Promise<number> {
  return (await one<{ id: number }>(`INSERT INTO sales_customers (name, kind, code) VALUES ($1,'company',$2) RETURNING id`, [name, `C17-${++seq}`])).id
}
/** Insert a DRAFT sales invoice (not yet confirmed/posted) — the "future
 * invoice" the unapplied balance is waiting for. Mirrors Phase 16's
 * `makeInvoice` but starts at 'draft' so the caller can exercise the real
 * confirm path below. */
async function makeDraftInvoice(customerId: number, total: number, date: string): Promise<number> {
  return (await one<{ id: number }>(
    `INSERT INTO sales_documents (doc_type, customer_id, date, status, subtotal, tax_total, total, doc_no) VALUES ('invoice',$1,$2,'draft',$3,0,$3,$4) RETURNING id`,
    [customerId, date, total, `INV-17-${++seq}`])).id
}
/** Confirms a sales invoice EXACTLY the way the real route does it (see
 * `src/app/api/admin/erp/sales/documents/route.ts`, op==='confirm'):
 * status -> confirmed, post to GL, THEN (outside that try/catch, matching
 * the real trigger placement) auto-consume unapplied AR. Calls the same two
 * real production functions the HTTP route calls — this is not a second
 * implementation of the confirm logic, it is the same two calls in the
 * same order, exercised without an HTTP server. */
async function confirmSalesInvoice(invId: number, userId: string): Promise<{ entryId: number; consumed: number }> {
  await pgQuery(`UPDATE sales_documents SET status='confirmed' WHERE id=$1`, [invId])
  const { entryId } = await postSalesInvoiceToGl(invId, userId)
  const customerId = (await one<{ customer_id: number }>(`SELECT customer_id FROM sales_documents WHERE id=$1`, [invId])).customer_id
  const res = await consumeUnappliedForCustomer(customerId, userId)
  return { entryId, consumed: res.totalConsumed }
}
/** Create an unapplied Treasury balance for a customer (no open invoices
 * yet) — the SAME `createReceipt` advance path production uses. */
async function makeUnapplied(name: string, amount: number, ADMIN: string, today: string): Promise<{ customerId: number; glEntryId: number }> {
  const customerId = await makeCustomer(name)
  const r = await createReceipt({ receiptType: 'customer_receipt', customerId, amount, date: today }, ADMIN)
  return { customerId, glEntryId: r.glEntryId }
}

async function main() {
  await runMigrations()
  await seedDatabase()
  const ADMIN = (await one<{ id: string }>(`SELECT id FROM users ORDER BY created_at LIMIT 1`)).id
  const today = new Date().toISOString().slice(0, 10)

  console.log('— DISCOVERY: schema assumptions (AR-01..AR-03) —')
  {
    const col = await one<{ is_nullable: string }>(
      `SELECT is_nullable FROM information_schema.columns WHERE table_name='sales_payments' AND column_name='document_id'`)
    ok(col.is_nullable === 'YES', `AR-02: sales_payments.document_id IS nullable — ${col.is_nullable}`)
    const colC = await one<{ is_nullable: string }>(
      `SELECT is_nullable FROM information_schema.columns WHERE table_name='sales_payments' AND column_name='customer_id'`)
    ok(colC.is_nullable === 'NO', `AR-01/AR-03: sales_payments.customer_id is NOT NULL — an unapplied row still carries customer_id — ${colC.is_nullable}`)
    const paidTotalCol = await one<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM information_schema.columns WHERE table_name='sales_documents' AND column_name='paid_total'`)
    ok(paidTotalCol.c === 0, `discovery: sales_documents has NO paid_total column (unlike purchase_documents) — AR "open" must be derived, never assumed equal to total`)
  }

  console.log('— Scenario 1: one unapplied receipt -> one future invoice (auto-consumed on confirm) —')
  {
    const { customerId, glEntryId } = await makeUnapplied('P17 Cust 1', 500_000, ADMIN, today)
    const balance0 = await customerArBalance(customerId)
    ok(balance0 === 0, `zero open AR with no invoices yet, despite the unapplied cash sitting there — ${balance0}`)

    const invId = await makeDraftInvoice(customerId, 300_000, today)
    const { consumed } = await confirmSalesInvoice(invId, ADMIN)
    ok(consumed === 300_000, `auto-consumption fired on confirm, settled exactly the invoice total — ${consumed}`)

    const inv = await one<{ status: string }>(`SELECT status FROM sales_documents WHERE id=$1`, [invId])
    ok(inv.status === 'paid', `future invoice auto-settled from the pre-existing unapplied balance — ${inv.status}`)

    const remaining = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM sales_payments WHERE customer_id=$1 AND document_id IS NULL`, [customerId])
    ok(Math.abs(remaining.s - 200_000) < 0.01, `remaining unapplied balance = 500,000 - 300,000 = 200,000 — actual ${remaining.s}`)

    const pair = await pgQuery<{ document_id: number | null; amount: number; gl_entry_id: number | null }>(
      `SELECT document_id, amount::float AS amount, gl_entry_id FROM sales_payments WHERE reference=$1 ORDER BY id`, [`AR-CONSUME:1`])
    ok(pair.length === 2 && Math.abs(Number(pair[0].amount) + Number(pair[1].amount)) < 0.01, `exactly TWO linked rows (negative source adjustment + positive invoice allocation) that net to zero — ${JSON.stringify(pair)}`)
    ok(pair.every(r => r.gl_entry_id === glEntryId), `both consumption rows carry the SOURCE receipt's original gl_entry_id, never NULL — ${JSON.stringify(pair.map(r => r.gl_entry_id))}`)

    const balanceAfter = await customerArBalance(customerId)
    ok(balanceAfter === 0, `Customer 360 AR balance correctly 0 after full settlement, with zero code changes to customerArBalance — ${balanceAfter}`)
  }

  console.log('— Scenario 2: one unapplied receipt -> MULTIPLE future invoices (one-to-many) —')
  {
    const { customerId } = await makeUnapplied('P17 Cust 2', 700_000, ADMIN, today)
    const inv1 = await makeDraftInvoice(customerId, 200_000, today)
    await confirmSalesInvoice(inv1, ADMIN)
    const inv2 = await makeDraftInvoice(customerId, 300_000, today)
    await confirmSalesInvoice(inv2, ADMIN)

    const inv1After = await one<{ status: string }>(`SELECT status FROM sales_documents WHERE id=$1`, [inv1])
    const inv2After = await one<{ status: string }>(`SELECT status FROM sales_documents WHERE id=$1`, [inv2])
    ok(inv1After.status === 'paid', `first future invoice settled from the ONE unapplied source — ${inv1After.status}`)
    ok(inv2After.status === 'paid', `second future invoice ALSO settled from the SAME unapplied source — ${inv2After.status}`)
    const remaining = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM sales_payments WHERE customer_id=$1 AND document_id IS NULL`, [customerId])
    ok(Math.abs(remaining.s - 200_000) < 0.01, `700,000 - 200,000 - 300,000 = 200,000 remaining unapplied — ${remaining.s}`)
  }

  console.log('— Scenario 3: MULTIPLE unapplied receipts -> one future invoice (many-to-one) —')
  {
    const customerId = await makeCustomer('P17 Cust 3')
    const r1 = await createReceipt({ receiptType: 'customer_receipt', customerId, amount: 150_000, date: today }, ADMIN)
    const r2 = await createReceipt({ receiptType: 'customer_receipt', customerId, amount: 250_000, date: today }, ADMIN)
    ok(r1.advance === 150_000 && r2.advance === 250_000, 'two independent unapplied receipts created for the same customer, zero open invoices')

    const invId = await makeDraftInvoice(customerId, 350_000, today)
    await confirmSalesInvoice(invId, ADMIN)
    const inv = await one<{ status: string }>(`SELECT status FROM sales_documents WHERE id=$1`, [invId])
    ok(inv.status === 'paid', `ONE invoice settled by TWO distinct unapplied sources combined — ${inv.status}`)
    const remaining = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM sales_payments WHERE customer_id=$1 AND document_id IS NULL`, [customerId])
    ok(Math.abs(remaining.s - 50_000) < 0.01, `150,000 + 250,000 - 350,000 = 50,000 remaining unapplied — ${remaining.s}`)
  }

  console.log('— partial allocation: unapplied smaller than the invoice —')
  {
    const { customerId } = await makeUnapplied('P17 Cust Partial', 100_000, ADMIN, today)
    const invId = await makeDraftInvoice(customerId, 400_000, today)
    await confirmSalesInvoice(invId, ADMIN)
    const inv = await one<{ status: string }>(`SELECT status FROM sales_documents WHERE id=$1`, [invId])
    ok(inv.status === 'partial', `invoice partially settled by a smaller unapplied balance — ${inv.status}`)
    const paid = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM sales_payments WHERE document_id=$1`, [invId])
    ok(Math.abs(paid.s - 100_000) < 0.01, `paid = exactly the available unapplied amount — ${paid.s}`)
  }

  console.log('— excess balance: unapplied GREATER than the invoice —')
  {
    const { customerId } = await makeUnapplied('P17 Cust Excess', 1_000_000, ADMIN, today)
    const invId = await makeDraftInvoice(customerId, 40_000, today)
    await confirmSalesInvoice(invId, ADMIN)
    const inv = await one<{ status: string }>(`SELECT status FROM sales_documents WHERE id=$1`, [invId])
    const paid = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM sales_payments WHERE document_id=$1`, [invId])
    ok(inv.status === 'paid' && Math.abs(paid.s - 40_000) < 0.01, `invoice capped at its own total, never overpaid — ${JSON.stringify({ status: inv.status, paid: paid.s })}`)
    const remaining = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM sales_payments WHERE customer_id=$1 AND document_id IS NULL`, [customerId])
    ok(Math.abs(remaining.s - 960_000) < 0.01, `the large remainder stays correctly unconsumed/unapplied — ${remaining.s}`)
  }

  console.log('— IDEMPOTENCY: explicit re-call after full auto-consumption is a stable no-op —')
  {
    const { customerId } = await makeUnapplied('P17 Cust Idem', 100_000, ADMIN, today)
    const invId = await makeDraftInvoice(customerId, 100_000, today)
    await confirmSalesInvoice(invId, ADMIN) // auto-consumes fully
    const before = await pgQuery<{ id: number }>(`SELECT id FROM sales_payments WHERE customer_id=$1`, [customerId])
    const again = await consumeUnappliedForCustomer(customerId, ADMIN)
    ok(again.totalConsumed === 0 && again.details.length === 0, `re-running consumption after full settlement is a stable no-op — ${JSON.stringify(again)}`)
    const afterOnce = await pgQuery<{ id: number }>(`SELECT id FROM sales_payments WHERE customer_id=$1`, [customerId])
    ok(before.length === afterOnce.length, `no new rows from the redundant call — ${before.length} == ${afterOnce.length}`)
    // Two concurrent identical calls against an already-fully-consumed source.
    const [c1, c2] = await Promise.all([consumeUnappliedForCustomer(customerId, ADMIN), consumeUnappliedForCustomer(customerId, ADMIN)])
    ok(c1.totalConsumed === 0 && c2.totalConsumed === 0, 'two CONCURRENT identical calls against an exhausted source both correctly consume zero')
    const afterTwice = await pgQuery<{ id: number }>(`SELECT id FROM sales_payments WHERE customer_id=$1`, [customerId])
    ok(before.length === afterTwice.length, `still no new rows after the concurrent identical calls — ${before.length} == ${afterTwice.length}`)
  }

  console.log('— CONCURRENCY Scenario A: FIVE concurrent workers consuming the SAME unapplied receipt —')
  {
    const { customerId } = await makeUnapplied('P17 Cust ConcA', 500_000, ADMIN, today)
    const invId = await makeDraftInvoice(customerId, 500_000, today)
    await pgQuery(`UPDATE sales_documents SET status='confirmed' WHERE id=$1`, [invId]) // open, un-posted/un-consumed
    await postSalesInvoiceToGl(invId, ADMIN)
    const results = await Promise.all(Array.from({ length: 5 }, () => consumeUnappliedForCustomer(customerId, ADMIN)))
    const totalConsumed = results.reduce((s, r) => s + r.totalConsumed, 0)
    ok(Math.abs(totalConsumed - 500_000) < 0.01, `five concurrent workers together consume EXACTLY the 500,000 available, never double, never negative — ${totalConsumed}`)
    const invAfter = await one<{ status: string }>(`SELECT status FROM sales_documents WHERE id=$1`, [invId])
    const paidAfter = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM sales_payments WHERE document_id=$1`, [invId])
    ok(invAfter.status === 'paid' && Math.abs(paidAfter.s - 500_000) < 0.01, `invoice settled exactly once despite the 5-way race, paid_total never exceeds total — ${JSON.stringify({ status: invAfter.status, paid: paidAfter.s })}`)
    const remaining = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM sales_payments WHERE customer_id=$1 AND document_id IS NULL`, [customerId])
    ok(remaining.s >= -0.01, `unapplied balance never went negative — ${remaining.s}`)
    ok(Math.abs(remaining.s) < 0.01, `zero unapplied balance remains after the race — ${remaining.s}`)
  }

  console.log('— CONCURRENCY Scenario B: two DISTINCT unapplied receipts, two workers, targeting the SAME invoice —')
  {
    const customerId = await makeCustomer('P17 Cust ConcB')
    const r1 = await createReceipt({ receiptType: 'customer_receipt', customerId, amount: 300_000, date: today }, ADMIN)
    const r2 = await createReceipt({ receiptType: 'customer_receipt', customerId, amount: 300_000, date: today }, ADMIN)
    ok(r1.glEntryId !== r2.glEntryId, 'two genuinely distinct receipts (distinct GL entries) created')
    const invId = await makeDraftInvoice(customerId, 500_000, today)
    await pgQuery(`UPDATE sales_documents SET status='confirmed' WHERE id=$1`, [invId])
    await postSalesInvoiceToGl(invId, ADMIN)
    const [w1, w2] = await Promise.all([consumeUnappliedForCustomer(customerId, ADMIN), consumeUnappliedForCustomer(customerId, ADMIN)])
    const totalConsumed = w1.totalConsumed + w2.totalConsumed
    ok(Math.abs(totalConsumed - 500_000) < 0.01, `invoice's own outstanding (500,000) is settled exactly, from 600,000 available and two racing workers — ${totalConsumed}`)
    const paidAfter = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM sales_payments WHERE document_id=$1`, [invId])
    ok(paidAfter.s <= 500_000 + 0.01, `invoice paid_total <= invoice total, always — ${paidAfter.s}`)
    const remaining = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM sales_payments WHERE customer_id=$1 AND document_id IS NULL`, [customerId])
    ok(Math.abs(remaining.s - 100_000) < 0.01, `600,000 - 500,000 = 100,000 remaining unapplied, split correctly across the two sources — ${remaining.s}`)
  }

  console.log('— CONCURRENCY Scenario C: consumption racing a NEW Treasury receipt for the SAME customer —')
  {
    const { customerId } = await makeUnapplied('P17 Cust ConcC', 300_000, ADMIN, today)
    const invId = await makeDraftInvoice(customerId, 300_000, today)
    await pgQuery(`UPDATE sales_documents SET status='confirmed' WHERE id=$1`, [invId])
    await postSalesInvoiceToGl(invId, ADMIN)
    const [consumeRes, receiptRes] = await Promise.all([
      consumeUnappliedForCustomer(customerId, ADMIN),
      createReceipt({ receiptType: 'customer_receipt', customerId, amount: 150_000, date: today }, ADMIN),
    ])
    ok(typeof consumeRes.totalConsumed === 'number' && typeof receiptRes.glEntryId === 'number', 'both concurrent operations completed without throwing')
    const paidAfter = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM sales_payments WHERE document_id=$1`, [invId])
    ok(paidAfter.s <= 300_000 + 0.01, `invoice never overpaid despite a concurrent NEW Treasury receipt landing for the same customer — ${paidAfter.s}`)
    const customerTotal = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM sales_payments WHERE customer_id=$1`, [customerId])
    ok(Math.abs(customerTotal.s - (300_000 + 150_000)) < 0.01, `customer's total AR movement = original unapplied (300,000) + the new concurrent receipt (150,000), no money lost or duplicated — ${customerTotal.s}`)
  }

  console.log('— CONCURRENCY Scenario D: consumption racing a DIRECT customer payment for the SAME customer —')
  {
    const { customerId } = await makeUnapplied('P17 Cust ConcD', 200_000, ADMIN, today)
    const invId = await makeDraftInvoice(customerId, 200_000, today)
    await pgQuery(`UPDATE sales_documents SET status='confirmed' WHERE id=$1`, [invId])
    await postSalesInvoiceToGl(invId, ADMIN)
    const directPay = async () => {
      const row = (await one<{ id: number }>(
        `INSERT INTO sales_payments (customer_id, document_id, date, amount, method, reference, created_by) VALUES ($1,NULL,$2,$3,'cash','direct-race',$4) RETURNING id`,
        [customerId, today, 50_000, ADMIN]))
      return row.id
    }
    const [consumeRes] = await Promise.all([consumeUnappliedForCustomer(customerId, ADMIN), directPay()])
    ok(typeof consumeRes.totalConsumed === 'number', 'consumption completed without throwing while a direct customer payment landed concurrently')
    const paidAfter = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM sales_payments WHERE document_id=$1`, [invId])
    ok(paidAfter.s <= 200_000 + 0.01, `invoice never overpaid despite the concurrent direct-payment race — ${paidAfter.s}`)
    const customerTotal = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM sales_payments WHERE customer_id=$1`, [customerId])
    ok(Math.abs(customerTotal.s - (200_000 + 50_000)) < 0.01, `customer's total AR movement = original unapplied (200,000) + the new direct payment (50,000) — ${customerTotal.s}`)
  }

  console.log('— ARCHITECTURAL BOUNDARY: an unapplied row with NO gl_entry_id (unposted) is never consumed —')
  {
    const customerId = await makeCustomer('P17 Cust Unposted')
    // A direct-payment unapplied row whose GL post never happened (matches
    // the real production case: postSalesPaymentToGl called best-effort
    // and failed/never ran) — gl_entry_id stays NULL.
    await pgQuery(`INSERT INTO sales_payments (customer_id, document_id, date, amount, method, reference, created_by) VALUES ($1,NULL,$2,$3,'cash','unposted-direct',$4)`,
      [customerId, today, 90_000, ADMIN])
    const invId = await makeDraftInvoice(customerId, 90_000, today)
    await pgQuery(`UPDATE sales_documents SET status='confirmed' WHERE id=$1`, [invId])
    await postSalesInvoiceToGl(invId, ADMIN)
    const res = await consumeUnappliedForCustomer(customerId, ADMIN)
    ok(res.totalConsumed === 0, `an UNPOSTED unapplied source (gl_entry_id IS NULL) is correctly excluded — consumed 0, not 90,000 — ${res.totalConsumed}`)
    const inv = await one<{ status: string }>(`SELECT status FROM sales_documents WHERE id=$1`, [invId])
    ok(inv.status === 'confirmed', `invoice stays open (not settled) since its only unapplied source is unposted — ${inv.status}`)
    // Now post it for real and re-run — it becomes consumable.
    const glId = await one<{ id: number }>(`SELECT id FROM sales_payments WHERE customer_id=$1 AND reference='unposted-direct'`, [customerId])
    await postSalesPaymentToGl(glId.id, ADMIN)
    const res2 = await consumeUnappliedForCustomer(customerId, ADMIN)
    ok(res2.totalConsumed === 90_000, `once posted, the SAME source becomes consumable and settles the invoice — ${res2.totalConsumed}`)
  }

  console.log('— CLOSED FISCAL PERIOD: explicit consumption succeeds against an invoice whose period has since closed (no new GL event -> no gate) —')
  {
    const pastDate = '2018-05-10'
    const { customerId } = await makeUnapplied('P17 Cust Period', 90_000, ADMIN, today)
    // Opened directly (no confirmSalesInvoice / no GL post / no auto-consumption)
    // to isolate an EXPLICIT consumeUnappliedForCustomer call as the thing
    // actually being tested against a closed period.
    const invId = await makeDraftInvoice(customerId, 90_000, pastDate)
    await pgQuery(`UPDATE sales_documents SET status='confirmed' WHERE id=$1`, [invId])
    const periodId = await createPeriod({ name: 'P17 closed 2018', startDate: '2018-01-01', endDate: '2018-12-31', kind: 'year' })
    await transitionPeriod(periodId, 'closed', ADMIN)

    const res = await consumeUnappliedForCustomer(customerId, ADMIN)
    ok(res.totalConsumed === 90_000, `explicit consumption against an invoice inside a NOW-CLOSED fiscal period succeeds — no new GL event, so the period gate correctly does not apply — ${res.totalConsumed}`)
    const inv = await one<{ status: string }>(`SELECT status FROM sales_documents WHERE id=$1`, [invId])
    ok(inv.status === 'paid', 'the old invoice settles correctly despite its period being closed')
  }

  console.log('— GL INTEGRITY: consumption creates NO new GL entries, never double-posts —')
  {
    const before = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    const { customerId } = await makeUnapplied('P17 Cust GL', 220_000, ADMIN, today)
    const beforeConfirm = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    const invId = await makeDraftInvoice(customerId, 220_000, today)
    await confirmSalesInvoice(invId, ADMIN) // posts ONE GL entry for the invoice itself + auto-consumes (no extra GL)
    const afterConfirm = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    ok(afterConfirm.c === beforeConfirm.c + 1, `confirming the invoice posts exactly ONE new GL entry (the invoice itself) — consumption added zero more — ${beforeConfirm.c} -> ${afterConfirm.c}`)

    const rows = await pgQuery<{ id: number; gl_entry_id: number | null }>(`SELECT id, gl_entry_id FROM sales_payments WHERE reference LIKE 'AR-CONSUME:%' AND customer_id=$1`, [customerId])
    let doublePosted = false
    for (const r of rows) {
      const res = await postSalesPaymentToGl(r.id, ADMIN)
      if (!res.alreadyPosted) doublePosted = true
    }
    ok(!doublePosted, 'calling postSalesPaymentToGl on every consumption row correctly refuses to post (alreadyPosted=true for all) — no phantom Dr Bank/Cr AR entry')
    const finalCount = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    ok(finalCount.c === before.c + 2, `only the 2 real GL events this block caused exist — the unapplied receipt's own post + the invoice's own post; consumption contributed zero — before=${before.c} final=${finalCount.c}`)
  }

  console.log('— ROLLBACK: forced failure after a consumption-shaped write must roll back everything atomically —')
  {
    const { customerId } = await makeUnapplied('P17 Cust RB', 150_000, ADMIN, today)
    const invId = await makeDraftInvoice(customerId, 150_000, today)
    await pgQuery(`UPDATE sales_documents SET status='confirmed' WHERE id=$1`, [invId])
    await postSalesInvoiceToGl(invId, ADMIN) // open, NOT yet consumed
    const beforeGl = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    const beforeRows = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM sales_payments WHERE customer_id=$1`, [customerId])
    let threw = false
    try {
      await withTransaction(async query => {
        await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`treasury_receipt_customer:${customerId}`])
        await query(`INSERT INTO sales_payments (customer_id, document_id, date, amount, method, reference, created_by, created_at) VALUES ($1,NULL,$2,$3,'bank','AR-CONSUME:FORCED',$4,to_char(now(),'YYYY-MM-DD HH24:MI:SS'))`, [customerId, today, -150_000, ADMIN])
        await query(`INSERT INTO sales_payments (customer_id, document_id, date, amount, method, reference, created_by, created_at) VALUES ($1,$2,$3,$4,'bank','AR-CONSUME:FORCED',$5,to_char(now(),'YYYY-MM-DD HH24:MI:SS'))`, [customerId, invId, today, 150_000, ADMIN])
        await query(`UPDATE sales_documents SET status='paid' WHERE id=$1`, [invId])
        throw new Error('forced rollback mid-consumption')
      })
    } catch { threw = true }
    ok(threw, 'forced failure threw')
    const afterGl = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM gl_journal_entries`)
    ok(beforeGl.c === afterGl.c, `no stray GL entry survives the forced rollback — ${beforeGl.c} == ${afterGl.c}`)
    const afterRows = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM sales_payments WHERE customer_id=$1`, [customerId])
    ok(beforeRows.c === afterRows.c, `zero orphan sales_payments rows survive — ${beforeRows.c} == ${afterRows.c}`)
    const inv = await one<{ status: string }>(`SELECT status FROM sales_documents WHERE id=$1`, [invId])
    const paid = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM sales_payments WHERE document_id=$1`, [invId])
    ok(inv.status === 'confirmed' && paid.s === 0, `invoice reverted to its pre-transaction state — ${JSON.stringify({ status: inv.status, paid: paid.s })}`)
    const remaining = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM sales_payments WHERE customer_id=$1 AND document_id IS NULL`, [customerId])
    ok(Math.abs(remaining.s - 150_000) < 0.01, `the original unapplied amount is fully restored/untouched — ${remaining.s}`)
  }

  console.log('— REVERSAL: reversing the ORIGINAL receipt after PARTIAL consumption also reverses the consumption rows (inherited via gl_entry_id lineage, zero new code) —')
  {
    const customerId = await makeCustomer('P17 Cust Reversal')
    const r = await createReceipt({ receiptType: 'customer_receipt', customerId, amount: 1_000_000, date: today }, ADMIN)
    const invId = await makeDraftInvoice(customerId, 400_000, today)
    await confirmSalesInvoice(invId, ADMIN) // consumes 400,000 of the 1,000,000
    const remainingBefore = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM sales_payments WHERE customer_id=$1 AND document_id IS NULL`, [customerId])
    ok(Math.abs(remainingBefore.s - 600_000) < 0.01, `pre-reversal: 1,000,000 - 400,000 = 600,000 unapplied remains — ${remainingBefore.s}`)

    const rev = await reverseCustomerReceipt(r.id, ADMIN)
    ok(!rev.alreadyReversed && rev.amountReversed > 0, `original receipt reversed for the first time — ${JSON.stringify(rev)}`)

    const invAfter = await one<{ status: string }>(`SELECT status FROM sales_documents WHERE id=$1`, [invId])
    const paidAfter = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM sales_payments WHERE document_id=$1`, [invId])
    ok(Math.abs(paidAfter.s) < 0.01, `invoice's paid amount reverts to 0 — the consumption allocation was swept up by the receipt reversal too — ${paidAfter.s}`)
    ok(invAfter.status !== 'paid', `invoice is no longer paid after the underlying cash was reversed — ${invAfter.status}`)
    const remainingAfter = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM sales_payments WHERE customer_id=$1 AND document_id IS NULL`, [customerId])
    ok(Math.abs(remainingAfter.s) < 0.01, `unapplied balance also reverts to 0 (the 600,000 remainder AND the consumed 400,000 both unwind) — ${remainingAfter.s}`)
    const netTotal = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM sales_payments WHERE customer_id=$1`, [customerId])
    ok(Math.abs(netTotal.s) < 0.01, `every sales_payments row for this customer nets to exactly zero — full reversal, no orphan balance — ${netTotal.s}`)
  }

  console.log('— PRECISION MATRIX: sub-unit and large amounts, exact conservation —')
  {
    const cases = [0.01, 0.02, 0.05, 0.1, 0.99, 1.01, 999.99, 1_000_000.01]
    for (const amt of cases) {
      const { customerId } = await makeUnapplied(`P17 Precision ${amt}`, amt, ADMIN, today)
      const invId = await makeDraftInvoice(customerId, amt, today)
      await confirmSalesInvoice(invId, ADMIN)
      const paid = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM sales_payments WHERE document_id=$1`, [invId])
      ok(Math.abs(Number(paid.s) - amt) < 0.005, `amount ${amt}: invoice paid == exactly ${amt} — actual ${paid.s}`)
      const remaining = await one<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM sales_payments WHERE customer_id=$1 AND document_id IS NULL`, [customerId])
      ok(Math.abs(remaining.s) < 0.005, `amount ${amt}: zero precision drift in the remaining unapplied balance — ${remaining.s}`)
    }
  }

  console.log('— AUDIT TRACEABILITY: every consumption row traces back to its source and target —')
  {
    const { customerId } = await makeUnapplied('P17 Cust Audit', 60_000, ADMIN, today)
    const invId = await makeDraftInvoice(customerId, 60_000, today)
    await confirmSalesInvoice(invId, ADMIN)
    const rows = await pgQuery<{ id: number; document_id: number | null; reference: string; note: string | null }>(
      `SELECT id, document_id, reference, note FROM sales_payments WHERE customer_id=$1 AND reference LIKE 'AR-CONSUME:%' ORDER BY id`, [customerId])
    ok(rows.length === 2, `two traceable rows written for this consumption — ${rows.length}`)
    const sourceId = Number(rows[0].reference.split(':')[1])
    const sourceRow = await one<{ id: number; document_id: number | null }>(`SELECT id, document_id FROM sales_payments WHERE id=$1`, [sourceId])
    ok(sourceRow.document_id === null, `reference parses back to a real unapplied SOURCE row (document_id IS NULL) — ${JSON.stringify(sourceRow)}`)
    const targetRow = rows.find(r => r.document_id === invId)
    ok(!!targetRow, `one of the two rows targets the exact invoice that was settled — traceable customer -> source -> target invoice`)
  }

  console.log('— reconciliation: fresh trial balance ties out after every Phase 17 scenario —')
  {
    const tallies = await loadTallies()
    const tb = trialBalance(tallies)
    ok(Math.abs(tb.totalDebit - tb.totalCredit) < 0.01, `Σdebit == Σcredit — ${tb.totalDebit} == ${tb.totalCredit}`)
  }

  console.log(`\nPhase 17 verification`)
  console.log(`Discovered: ${n}`)
  console.log(`Passed: ${n - failed}`)
  console.log(`Failed: ${failed}`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
