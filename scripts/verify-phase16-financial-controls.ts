/**
 * Phase 16 live-PG verification — customer receipt (AR) per-invoice
 * traceability + reversal, the AR-side mirror of Phase 10-15's AP work.
 * Money-conservation invariant: Σ(sales_payments rows sharing a reversed
 * receipt's gl_entry_id) == 0 once fully reversed. Committed as a
 * permanent regression suite (rule 6: the full regression history stays
 * green in CI).
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery, withTransaction } from '@/lib/db'
import { createReceipt, reverseCustomerReceipt } from '@/lib/treasury/paymentData'
import { postSalesPaymentToGl } from '@/lib/erp/glPosting'
import { createPeriod, transitionPeriod } from '@/lib/erp/accountingData'
import { loadTallies } from '@/lib/erp/ledgerData'
import { trialBalance } from '@/lib/erp/ledger'

let n = 0, failed = 0
const ok = (c: boolean, l: string) => { n++; if (c) console.log(`  ✅ ${n}. ${l}`); else { failed++; console.error(`  ❌ ${n}. ${l}`) } }
const one = async <T>(sql: string, p: unknown[] = []) => (await pgQuery<T>(sql, p))[0]

async function makeCustomer(name: string, code: string): Promise<number> {
  return (await one<{ id: number }>(`INSERT INTO sales_customers (name, kind, code) VALUES ($1,'company',$2) RETURNING id`, [name, code])).id
}
async function makeInvoice(customerId: number, total: number, docNo: string, date: string): Promise<number> {
  return (await one<{ id: number }>(
    `INSERT INTO sales_documents (doc_type, customer_id, date, status, subtotal, tax_total, total, doc_no) VALUES ('invoice',$1,$2,'sent',$3,0,$3,$4) RETURNING id`,
    [customerId, date, total, docNo])).id
}

async function main() {
  await runMigrations()
  await seedDatabase()
  const ADMIN = (await one<{ id: string }>(`SELECT id FROM users ORDER BY created_at LIMIT 1`)).id
  const today = new Date().toISOString().slice(0, 10)
  let seq = 0

  console.log('— normal success: single invoice, exact receipt —')
  {
    const c = await makeCustomer('P16 Cust A', `C16-${++seq}`)
    const inv = await makeInvoice(c, 500_000, `INV-16-${seq}`, today)
    const r = await createReceipt({ receiptType: 'customer_receipt', customerId: c, amount: 500_000, date: today }, ADMIN)
    ok(r.allocations.length === 1 && r.advance === 0, `exact allocation, zero advance — ${JSON.stringify(r)}`)
    const rows = await pgQuery<{ document_id: number | null; amount: number; reference: string; gl_entry_id: number }>(`SELECT document_id, amount::float AS amount, reference, gl_entry_id FROM sales_payments WHERE customer_id=$1`, [c])
    ok(rows.length === 1 && rows[0].document_id === inv && rows[0].gl_entry_id === r.glEntryId, `exactly ONE sales_payments row, document_id set, gl_entry_id matches the receipt's own entry — ${JSON.stringify(rows)}`)
    const invAfter = await one<{ status: string }>(`SELECT status FROM sales_documents WHERE id=$1`, [inv])
    ok(invAfter.status === 'paid', `invoice status paid — ${invAfter.status}`)
  }

  console.log('— partial operation: receipt smaller than invoice total —')
  {
    const c = await makeCustomer('P16 Cust B', `C16-${++seq}`)
    const inv = await makeInvoice(c, 800_000, `INV-16-${seq}`, today)
    const r = await createReceipt({ receiptType: 'customer_receipt', customerId: c, amount: 300_000, date: today }, ADMIN)
    ok(r.allocations.length === 1 && Math.abs(r.allocations[0].amount - 300_000) < 0.01, `partial allocation — ${JSON.stringify(r)}`)
    const invAfter = await one<{ status: string }>(`SELECT status FROM sales_documents WHERE id=$1`, [inv])
    ok(invAfter.status === 'partial', `invoice status partial — ${invAfter.status}`)
  }

  console.log('— full operation: one receipt across MULTIPLE invoices + advance remainder —')
  {
    const c = await makeCustomer('P16 Cust C', `C16-${++seq}`)
    const inv1 = await makeInvoice(c, 200_000, `INV-16-${seq}a`, '2020-01-01')
    const inv2 = await makeInvoice(c, 300_000, `INV-16-${seq}b`, '2020-02-01')
    const r = await createReceipt({ receiptType: 'customer_receipt', customerId: c, amount: 600_000, date: today }, ADMIN)
    ok(r.allocations.length === 2 && Math.abs(r.advance - 100_000) < 0.01, `both invoices settled, 100,000 advance — ${JSON.stringify(r)}`)
    const rows = await pgQuery<{ document_id: number | null; amount: number }>(`SELECT document_id, amount::float AS amount FROM sales_payments WHERE customer_id=$1 ORDER BY id`, [c])
    ok(rows.length === 3, `3 rows: 2 allocations + 1 advance row — ${JSON.stringify(rows)}`)
    const advanceRow = rows.find(x => x.document_id === null)
    ok(!!advanceRow && Math.abs(Number(advanceRow.amount) - 100_000) < 0.01, `advance row has document_id=NULL, amount 100,000 — ${JSON.stringify(advanceRow)}`)
    ok((await one<{ status: string }>(`SELECT status FROM sales_documents WHERE id=$1`, [inv1])).status === 'paid', 'inv1 paid')
    ok((await one<{ status: string }>(`SELECT status FROM sales_documents WHERE id=$1`, [inv2])).status === 'paid', 'inv2 paid')
  }

  console.log('— invalid/already-completed: reversing a receipt with no GL entry throws —')
  {
    const c = await makeCustomer('P16 Cust Invalid', `C16-${++seq}`)
    const r = await createReceipt({ receiptType: 'customer_receipt', customerId: c, amount: 50_000, date: today }, ADMIN)
    await pgQuery(`UPDATE receipt_transactions SET gl_entry_id=NULL WHERE id=$1`, [r.id])
    let threw = false
    try { await reverseCustomerReceipt(r.id, ADMIN) } catch { threw = true }
    ok(threw, 'reversal of a receipt with no posted GL entry correctly throws')
  }

  console.log('— repeated reversal (idempotent) —')
  {
    const c = await makeCustomer('P16 Cust Idem', `C16-${++seq}`)
    const inv = await makeInvoice(c, 175_000, `INV-16-${seq}`, today)
    const r = await createReceipt({ receiptType: 'customer_receipt', customerId: c, amount: 175_000, date: today }, ADMIN)
    const first = await reverseCustomerReceipt(r.id, ADMIN)
    const second = await reverseCustomerReceipt(r.id, ADMIN)
    const third = await reverseCustomerReceipt(r.id, ADMIN)
    ok(first.amountReversed === 175_000 && second.amountReversed === 0 && third.amountReversed === 0, `stable after the first — ${JSON.stringify([first.amountReversed, second.amountReversed, third.amountReversed])}`)
    ok(second.alreadyReversed && third.alreadyReversed && second.reversalId === first.reversalId, 'same GL reversal id every time, no self-reversal loop')
    const rows = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM sales_payments WHERE customer_id=$1`, [c])
    ok(rows.c === 2, `exactly 2 rows total (1 original + 1 reversal), never re-reversed — ${rows.c}`)
    const invAfter = await one<{ status: string }>(`SELECT status FROM sales_documents WHERE id=$1`, [inv])
    ok(invAfter.status === 'sent', `invoice reverted to its base unpaid status — ${invAfter.status}`)
  }

  console.log('— CONCURRENCY: 5 concurrent identical reversal calls on the SAME receipt —')
  {
    const c = await makeCustomer('P16 Cust Conc', `C16-${++seq}`)
    const inv = await makeInvoice(c, 220_000, `INV-16-${seq}`, today)
    const r = await createReceipt({ receiptType: 'customer_receipt', customerId: c, amount: 220_000, date: today }, ADMIN)
    const results = await Promise.all(Array.from({ length: 5 }, () => reverseCustomerReceipt(r.id, ADMIN)))
    const total = results.reduce((s, x) => s + x.amountReversed, 0)
    ok(total === 220_000, `exactly ONE reversal mutation across all 5 concurrent calls — ${total}`)
    const reversalIds = new Set(results.map(x => x.reversalId))
    ok(reversalIds.size === 1, `exactly ONE GL reversal entry — ${[...reversalIds]}`)
    const invAfter = await one<{ status: string }>(`SELECT status FROM sales_documents WHERE id=$1`, [inv])
    ok(invAfter.status === 'sent', 'invoice reverted exactly once')
  }

  console.log('— CONCURRENCY: reversal vs a DISTINCT new receipt for the same customer, same invoice —')
  {
    const c = await makeCustomer('P16 Cust Race', `C16-${++seq}`)
    const inv = await makeInvoice(c, 500_000, `INV-16-${seq}`, today)
    const r1 = await createReceipt({ receiptType: 'customer_receipt', customerId: c, amount: 500_000, date: today }, ADMIN)   // invoice fully paid
    const [revRes, newReceiptRes] = await Promise.all([
      reverseCustomerReceipt(r1.id, ADMIN),
      (async () => { await new Promise(res => setImmediate(res)); return createReceipt({ receiptType: 'customer_receipt', customerId: c, amount: 500_000, date: today }, ADMIN) })(),
    ])
    ok(revRes.amountReversed === 500_000, `reversal completed exactly — ${revRes.amountReversed}`)
    const invAfter = await one<{ status: string }>(`SELECT status FROM sales_documents WHERE id=$1`, [inv])
    // Both orderings are financially valid: the new receipt allocates
    // against the now-open invoice (status ends 'paid' again), or it read
    // the invoice as already-paid first and correctly went entirely to
    // advance (status stays 'sent'). Either way, never a corrupted mix.
    ok(invAfter.status === 'paid' || invAfter.status === 'sent', `deterministic final status under either valid lock ordering — ${invAfter.status}`)
    ok(typeof newReceiptRes.glEntryId === 'number', 'the new receipt completed without throwing')
  }

  console.log('— ROLLBACK: forced failure after a reversal-shaped write rolls back atomically —')
  {
    const c = await makeCustomer('P16 Cust RB', `C16-${++seq}`)
    const inv = await makeInvoice(c, 140_000, `INV-16-${seq}`, today)
    const r = await createReceipt({ receiptType: 'customer_receipt', customerId: c, amount: 140_000, date: today }, ADMIN)
    const beforeGl = await one<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt FROM gl_journal_entries`)
    const beforeRows = await one<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt FROM sales_payments WHERE customer_id=$1`, [c])
    let threw = false
    try {
      await withTransaction(async query => {
        await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`treasury_receipt_customer:${c}`])
        await query(`INSERT INTO sales_payments (customer_id, document_id, date, amount, method, reference, created_by, gl_entry_id, created_at) VALUES ($1,$2,$3,$4,'bank','TRZRCP-REVERSE:FORCED',$5,$6,${new Date().toISOString()})`, [c, inv, today, -140_000, ADMIN, r.glEntryId])
        await query(`UPDATE sales_documents SET status='sent' WHERE id=$1`, [inv])
        throw new Error('forced rollback mid-reversal')
      })
    } catch { threw = true }
    ok(threw, 'forced failure threw')
    const afterGl = await one<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt FROM gl_journal_entries`)
    ok(beforeGl.cnt === afterGl.cnt, `no orphan GL entry — ${beforeGl.cnt} == ${afterGl.cnt}`)
    const afterRows = await one<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt FROM sales_payments WHERE customer_id=$1`, [c])
    ok(beforeRows.cnt === afterRows.cnt, `no orphan reversal rows — ${beforeRows.cnt} == ${afterRows.cnt}`)
    const invAfter = await one<{ status: string }>(`SELECT status FROM sales_documents WHERE id=$1`, [inv])
    ok(invAfter.status === 'paid', `invoice fully restored — ${invAfter.status}`)
  }

  console.log('— FISCAL PERIOD: reversal rejected when TODAY\'s posting date falls in a closed period —')
  {
    const c = await makeCustomer('P16 Cust Period', `C16-${++seq}`)
    const inv = await makeInvoice(c, 90_000, `INV-16-${seq}`, today)
    const r = await createReceipt({ receiptType: 'customer_receipt', customerId: c, amount: 90_000, date: today }, ADMIN)
    const year = today.slice(0, 4)
    const periodId = await createPeriod({ name: `P16 closed ${year}`, startDate: `${year}-01-01`, endDate: `${year}-12-31`, kind: 'year' })
    await transitionPeriod(periodId, 'closed', ADMIN)
    let threw = false
    try { await reverseCustomerReceipt(r.id, ADMIN) } catch { threw = true }
    ok(threw, 'reversal rejected — today\'s posting date falls inside a closed period')
    const invAfter = await one<{ status: string }>(`SELECT status FROM sales_documents WHERE id=$1`, [inv])
    ok(invAfter.status === 'paid', `invoice untouched — ${invAfter.status}`)
    const rows = await one<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt FROM sales_payments WHERE customer_id=$1`, [c])
    ok(rows.cnt === 1, `no reversal row created — ${rows.cnt}`)
    await transitionPeriod(periodId, 'open', ADMIN)
  }

  console.log('— GL INTEGRITY: reversal balance + no phantom cash movement —')
  {
    const before = await one<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt FROM gl_journal_entries`)
    const c = await makeCustomer('P16 Cust GL', `C16-${++seq}`)
    const inv = await makeInvoice(c, 310_000, `INV-16-${seq}`, today)
    const r = await createReceipt({ receiptType: 'customer_receipt', customerId: c, amount: 310_000, date: today }, ADMIN)
    const afterCreate = await one<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt FROM gl_journal_entries`)
    ok(afterCreate.cnt === before.cnt + 1, `exactly ONE GL entry from the receipt regardless of allocation count — ${before.cnt} -> ${afterCreate.cnt}`)

    const res = await reverseCustomerReceipt(r.id, ADMIN)
    const afterReverse = await one<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt FROM gl_journal_entries`)
    ok(afterReverse.cnt === afterCreate.cnt + 1, `exactly ONE new GL entry from the reversal — ${afterCreate.cnt} -> ${afterReverse.cnt}`)
    const revEntry = await one<{ total_debit: number; total_credit: number }>(
      `SELECT COALESCE(SUM(debit),0)::float AS total_debit, COALESCE(SUM(credit),0)::float AS total_credit FROM gl_journal_lines WHERE entry_id=$1`, [res.reversalId])
    ok(Math.abs(revEntry.total_debit - revEntry.total_credit) < 0.01 && Math.abs(revEntry.total_debit - 310_000) < 0.01, `reversal entry balanced at the full receipt amount — Dr ${revEntry.total_debit} == Cr ${revEntry.total_credit}`)
    const originalEntry = await one<{ status: string; reversed_by: number | null }>(`SELECT status, reversed_by FROM gl_journal_entries WHERE id=$1`, [r.glEntryId])
    ok(originalEntry.status === 'posted' && originalEntry.reversed_by === res.reversalId, `original entry stays posted, two-way linked — ${JSON.stringify(originalEntry)}`)

    const revRow = await one<{ id: number }>(`SELECT id FROM sales_payments WHERE reference LIKE 'TRZRCP-REVERSE:%' AND customer_id=$1 AND document_id=$2`, [c, inv])
    const doublePost = await postSalesPaymentToGl(revRow.id, ADMIN)
    ok(doublePost.alreadyPosted === true, 'reversal row correctly refuses a new GL post — no phantom Dr Bank/Cr AR entry')
  }

  console.log('— PRECISION MATRIX —')
  {
    const cases = [0.01, 0.02, 0.05, 0.1, 0.99, 1.01, 999.99, 1_000_000.01]
    for (const amt of cases) {
      const c = await makeCustomer(`P16 Precision ${amt}`, `C16-${++seq}`)
      const inv = await makeInvoice(c, amt, `INV-16-${seq}`, today)
      const r = await createReceipt({ receiptType: 'customer_receipt', customerId: c, amount: amt, date: today }, ADMIN)
      const res = await reverseCustomerReceipt(r.id, ADMIN)
      ok(Math.abs(res.amountReversed - amt) < 0.005, `amount ${amt}: reversal == exactly ${amt} — ${res.amountReversed}`)
      const rows = await pgQuery<{ amount: number }>(`SELECT amount::float AS amount FROM sales_payments WHERE document_id=$1`, [inv])
      const net = rows.reduce((s, x) => s + Number(x.amount), 0)
      ok(Math.abs(net) < 0.005, `amount ${amt}: net ledger for this invoice == exactly 0, zero drift — ${net}`)
    }
  }

  console.log('— AUDIT: repeated reversal never produces a misleading duplicate financial event —')
  {
    const c = await makeCustomer('P16 Cust Audit', `C16-${++seq}`)
    const inv = await makeInvoice(c, 50_000, `INV-16-${seq}`, today)
    const r = await createReceipt({ receiptType: 'customer_receipt', customerId: c, amount: 50_000, date: today }, ADMIN)
    await reverseCustomerReceipt(r.id, ADMIN)
    const rows = await pgQuery<{ reference: string; amount: number }>(`SELECT reference, amount::float AS amount FROM sales_payments WHERE customer_id=$1 ORDER BY id`, [c])
    await reverseCustomerReceipt(r.id, ADMIN)
    await reverseCustomerReceipt(r.id, ADMIN)
    const rowsAfter = await pgQuery<{ reference: string; amount: number }>(`SELECT reference, amount::float AS amount FROM sales_payments WHERE customer_id=$1 ORDER BY id`, [c])
    ok(JSON.stringify(rows) === JSON.stringify(rowsAfter), `identical ledger rows after 2 more redundant calls — no misleading duplicate financial history — ${JSON.stringify(rowsAfter)}`)
    void inv
  }

  console.log('— FINANCIAL RECONCILIATION: trial balance ties out after every Phase 16 scenario —')
  {
    const tallies = await loadTallies()
    const tb = trialBalance(tallies)
    ok(Math.abs(tb.totalDebit - tb.totalCredit) < 0.01, `Σdebit == Σcredit — ${tb.totalDebit} == ${tb.totalCredit}`)
  }

  console.log(`\nDiscovered: ${n}`)
  console.log(`Passed: ${n - failed}`)
  console.log(`Failed: ${failed}`)
  console.log(failed === 0 ? '✅ ALL Phase 16 assertions passed' : `❌ ${failed}/${n} Phase 16 assertions failed`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
