/**
 * ERPFIX-2 — live-PostgreSQL proof (regression suite, scripts/ci-regressions.ts).
 *
 * BUG-ERP-03: every GL line in BASE currency (Rial), the foreign amount kept
 * on the line, realized FX on settlement, thresholds on base amounts, the
 * revaluation engine not double-counting, and the legacy-data restatement.
 * Every financial figure is read back through production functions
 * (loadTallies → trialBalance, previewRevaluation, submitDocument,
 * evaluateCredit, submitPayment). Hand SQL only PREPARES data (sales documents
 * and payments are inserted exactly as the sales routes write them).
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery, withTransaction } from '@/lib/db'
import { setRate } from '@/lib/erp/currencyData'
import { postSalesInvoiceToGl } from '@/lib/erp/salesData'
import { postSalesPaymentToGl, insertPostedEntry, accountIdByCode } from '@/lib/erp/glPosting'
import { saveDocument, submitDocument, confirmPurchaseInvoice, recordPayment } from '@/lib/erp/purchasingData'
import { evaluateCredit } from '@/lib/crm/customer360Data'
import { createPayment, submitPayment, processPayment, reversePayment } from '@/lib/treasury/paymentData'
import { previewRevaluation, bookRevaluation } from '@/lib/erp/revaluationData'
import { fxSurvey, remediateFx } from '@/lib/erp/fxRemediation'
import { documentBase, documentControlBase } from '@/lib/erp/money'
import { loadTallies } from '@/lib/erp/ledgerData'
import { trialBalance } from '@/lib/erp/ledger'
import { BusinessErrorException } from '@/lib/errors'

let pass = 0, fail = 0
function ok(cond: boolean, label: string, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`) }
}
const one = async <T,>(sql: string, p: unknown[] = []) => (await pgQuery<T>(sql, p))[0]
const today = new Date().toISOString().slice(0, 10)
const f = (n: number) => n.toLocaleString('en-US')
async function bal(code: string): Promise<number> {
  const r = trialBalance(await loadTallies()).rows.find(x => x.code === code)
  return r ? Math.round((r.debit - r.credit) * 100) / 100 : 0
}
/** Insert a sales invoice exactly as the sales route does (server totals, booked rate, base_total). */
async function salesInvoice(customerId: number, docNo: string, net: number, tax: number, currency: string, rate: number): Promise<number> {
  const total = Math.round((net + tax) * 100) / 100
  return (await one<{ id: number }>(
    `INSERT INTO sales_documents (doc_type, doc_no, customer_id, date, status, subtotal, discount_total, tax_total, total, currency, exchange_rate, base_total, updated_at)
     VALUES ('invoice',$1,$2,$3,'confirmed',$4,0,$5,$6,$7,$8,$9,to_char(now(),'YYYY-MM-DD HH24:MI:SS')) RETURNING id`,
    [docNo, customerId, today, net, tax, total, currency, rate, Math.round(total * rate * 100) / 100]))!.id
}
async function salesPayment(customerId: number, docId: number, amount: number, currency: string, rate: number): Promise<number> {
  return (await one<{ id: number }>(
    `INSERT INTO sales_payments (customer_id, document_id, date, amount, method, currency, exchange_rate) VALUES ($1,$2,$3,$4,'bank',$5,$6) RETURNING id`,
    [customerId, docId, today, amount, currency, rate]))!.id
}
async function entryOf(reference: string) {
  const e = (await one<{ id: number; currency: string; exchange_rate: string }>(`SELECT id, currency, exchange_rate FROM gl_journal_entries WHERE reference=$1 ORDER BY id DESC LIMIT 1`, [reference]))!
  const lines = await pgQuery<{ code: string; debit: string; credit: string; fx_amount: string | null; fx_currency: string | null }>(
    `SELECT a.code, l.debit, l.credit, l.fx_amount, l.fx_currency FROM gl_journal_lines l JOIN gl_accounts a ON a.id=l.account_id WHERE l.entry_id=$1 ORDER BY l.line_no`, [e.id])
  const dr = lines.reduce((s, l) => s + Number(l.debit), 0), cr = lines.reduce((s, l) => s + Number(l.credit), 0)
  return { ...e, lines, dr, cr }
}
async function codeOf(fn: () => Promise<unknown>): Promise<string> {
  try { await fn(); return 'ok' } catch (e) { return e instanceof BusinessErrorException ? e.built.code : `err:${e instanceof Error ? e.message : String(e)}` }
}

async function main() {
  console.log('\n══ ERPFIX-2 — currency in the general ledger (live PostgreSQL) ══')
  await runMigrations(); await seedDatabase()
  const ADMIN = (await one<{ id: string }>(`SELECT id FROM users LIMIT 1`))!.id
  const adminUser = (await one<{ id: string; role: string; name: string; email: string }>(`SELECT id, role, name, email FROM users WHERE id=$1`, [ADMIN]))!
  const cols = await pgQuery<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_name='gl_journal_lines' AND column_name IN ('fx_amount','fx_currency')`)
  ok(cols.length === 2, 'gl_journal_lines carries fx_amount + fx_currency')
  await setRate('USD', today, 600000, ADMIN)
  await setRate('EUR', today, 700000.3, ADMIN)
  const cust = (await one<{ id: number }>(`INSERT INTO sales_customers (code,name,credit_limit) VALUES ('FX2-C','FX2 customer',50000000) RETURNING id`))!.id

  console.log('\n— sales invoice 100 USD @ 600,000 —')
  const inv1 = await salesInvoice(cust, 'FX2-INV-1', 100, 0, 'USD', 600000)
  await postSalesInvoiceToGl(inv1, ADMIN)
  const e1 = await entryOf(`SAL-${inv1}`)
  ok(await bal('1100') === 60_000_000, '🔴 AR 1100 = 60,000,000 (was 100)', f(await bal('1100')))
  ok(await bal('4000') === -60_000_000, 'revenue 4000 = −60,000,000 at base', f(await bal('4000')))
  const arLine = e1.lines.find(l => l.code === '1100')!
  ok(Number(arLine.fx_amount) === 100 && arLine.fx_currency === 'USD', 'the AR line keeps fx_amount = 100 USD')
  ok(e1.currency === 'USD' && Number(e1.exchange_rate) === 600000 && e1.dr === e1.cr, 'header USD @ 600,000; entry balanced', `${f(e1.dr)} = ${f(e1.cr)}`)
  const doc1 = await one<{ total: string; exchange_rate: string; base_total: string }>(`SELECT total, exchange_rate, base_total FROM sales_documents WHERE id=$1`, [inv1])
  ok(Number(doc1!.total) === 100 && Number(doc1!.exchange_rate) === 600000 && Number(doc1!.base_total) === 60_000_000, 'the document is untouched (total / rate / base_total)')

  console.log('\n— receipt 40 USD @ 650,000 (realized FX) —')
  await setRate('USD', today, 650000, ADMIN)
  const p1 = await salesPayment(cust, inv1, 40, 'USD', 650000)
  await postSalesPaymentToGl(p1, ADMIN)
  ok(await bal('1010') === 26_000_000, '🔴 bank 1010 = 26,000,000 (40 × 650,000)', f(await bal('1010')))
  ok(await bal('1100') === 36_000_000, '🔴 AR relieved at the BOOKED rate → 36,000,000 remains', f(await bal('1100')))
  ok(await bal('4900') === -2_000_000, '🔴 realized FX gain 2,000,000 on 4900', f(await bal('4900')))
  const ep1 = await entryOf(`SPAY-${p1}`)
  ok(ep1.currency === 'USD' && Number(ep1.exchange_rate) === 650000 && ep1.dr === ep1.cr, 'receipt entry header USD @ 650,000, balanced')

  console.log('\n— revaluation: no double counting —')
  const pv1 = await previewRevaluation()
  ok(pv1.deltaToBook === 3_000_000, 'unrealized on the open 60 USD = 60 × 50,000 = 3,000,000', f(pv1.deltaToBook))
  await bookRevaluation(ADMIN)
  ok((await bookRevaluation(ADMIN)).booked === false, 'a second revaluation run books nothing')
  const p2 = await salesPayment(cust, inv1, 20, 'USD', 650000)
  await postSalesPaymentToGl(p2, ADMIN)
  ok(await bal('1100') === 24_000_000 && await bal('4900') === -6_000_000, 'second receipt 20 USD: AR 24,000,000; realized now 3,000,000 (+3,000,000 unrealized)', `${f(await bal('1100'))} / ${f(await bal('4900'))}`)
  const pv2 = await previewRevaluation()
  ok(pv2.deltaToBook === -1_000_000, '🔴 revaluation releases only the settled part: 40 × 50,000 − 3,000,000 = −1,000,000', f(pv2.deltaToBook))
  await bookRevaluation(ADMIN)
  // The release is booked as a revaluation LOSS (Dr 6980 / Cr 1190), so the
  // net FX result is 4900 − 6980.
  const netFx = -(await bal('4900')) - (await bal('6980'))
  ok(netFx === 5_000_000 && await bal('1190') === 2_000_000, 'net FX = 3,000,000 realized + 2,000,000 unrealized = 5,000,000 (= 100 USD × 50,000)', `4900 ${f(await bal('4900'))} · 6980 ${f(await bal('6980'))} · 1190 ${f(await bal('1190'))}`)
  ok((await previewRevaluation()).deltaToBook === 0, 'nothing left to revalue')

  console.log('\n— odd rate, IRT, EUR: exactly balanced —')
  const inv2 = await salesInvoice(cust, 'FX2-INV-2', 33.33, 3.0, 'USD', 600001.7)
  await postSalesInvoiceToGl(inv2, ADMIN)
  const e2 = await entryOf(`SAL-${inv2}`)
  ok(e2.dr === e2.cr && e2.lines.every(l => Number.isInteger(Number(l.debit)) && Number.isInteger(Number(l.credit))), '🔴 rate 600,001.7: Dr = Cr to the Rial (no EPS), whole Rials', `${f(e2.dr)} = ${f(e2.cr)}`)
  ok(Number(e2.lines.find(l => l.code === '1100')!.debit) === documentControlBase(33.33, 3, 600001.7), 'AR absorbs the rounding residue')
  const inv3 = await salesInvoice(cust, 'FX2-INV-3', 1000, 90, 'IRT', 10)
  await postSalesInvoiceToGl(inv3, ADMIN)
  const e3 = await entryOf(`SAL-${inv3}`)
  ok(Number(e3.lines.find(l => l.code === '1100')!.debit) === 10_900 && e3.dr === e3.cr, 'IRT 1,090 @ 10 → AR 10,900', f(e3.dr))
  const inv4 = await salesInvoice(cust, 'FX2-INV-4', 250.5, 22.55, 'EUR', 700000.3)
  await postSalesInvoiceToGl(inv4, ADMIN)
  const e4 = await entryOf(`SAL-${inv4}`)
  ok(e4.dr === e4.cr && Number(e4.lines.find(l => l.code === '1100')!.fx_amount) === 273.05, 'EUR 273.05 @ 700,000.3 balanced, fx kept', f(e4.dr))

  console.log('\n— purchasing: base thresholds, AP at base, partial payment FX —')
  await setRate('USD', today, 600000, ADMIN)
  const vend = (await one<{ id: number }>(`INSERT INTO purchase_vendors (code,name) VALUES ('FX2-V','FX2 vendor') RETURNING id`))!.id
  const po = await saveDocument({ docType: 'invoice', vendorId: vend, date: today, currency: 'USD', lines: [{ description: 'server', qty: 1, unitPrice: 1000, discountPct: 0, taxPct: 0 }] }, ADMIN)
  await submitDocument(po)
  const irrPo = await saveDocument({ docType: 'invoice', vendorId: vend, date: today, currency: 'IRR', lines: [{ description: 'cable', qty: 1, unitPrice: 1000, discountPct: 0, taxPct: 0 }] }, ADMIN)
  await submitDocument(irrPo)
  const lv = await pgQuery<{ id: number; approval_levels: number }>(`SELECT id, approval_levels FROM purchase_documents WHERE id = ANY($1)`, [[po, irrPo]])
  ok(lv.find(r => r.id === po)!.approval_levels === 3 && lv.find(r => r.id === irrPo)!.approval_levels === 1, '🔴 1,000 USD (600M base) needs 3 approval levels; 1,000 IRR needs 1', JSON.stringify(lv))
  ok(await codeOf(() => saveDocument({ docType: 'invoice', vendorId: vend, date: today, currency: 'GBP', lines: [{ description: 'x', qty: 1, unitPrice: 10, discountPct: 0, taxPct: 0 }] }, ADMIN)) === 'ERP-FINANCE-NO-EXCHANGE-RATE', '🔴 a currency with no rate is refused (was silently rate 1)')
  const budgetDoc = await saveDocument({ docType: 'request', vendorId: vend, date: today, currency: 'USD', department: 'FX2-IT', budget: 50_000_000, lines: [{ description: 'laptop', qty: 1, unitPrice: 100, discountPct: 0, taxPct: 0 }] }, ADMIN)
  const b = await submitDocument(budgetDoc)
  ok(b.ok === false && b.budget?.remainingAfter === -10_000_000, '🔴 budget compares the base amount: 100 USD = 60,000,000 > 50,000,000', b.error)
  await confirmPurchaseInvoice(po, ADMIN)
  ok(await bal('2000') === -600_000_000, '🔴 AP 2000 credited 600,000,000 at base (was 1,000; the IRR invoice is not confirmed)', f(await bal('2000')))
  await setRate('USD', today, 620000, ADMIN)
  const bank0 = await bal('1010'), loss0 = await bal('6980')
  const pay = await recordPayment(po, vend, 400, 'bank', today, undefined, ADMIN)
  ok(pay.ok === true, 'partial payment 400 USD (currency defaults to the invoice currency, rate of the payment day)')
  ok(await bal('1010') - bank0 === -248_000_000, '🔴 bank −248,000,000 (400 × 620,000)', f(await bal('1010') - bank0))
  ok(await bal('2000') === -360_000_000, '🔴 AP relieved at the booked rate: 240,000,000 → 360,000,000 left on the USD invoice', f(await bal('2000')))
  ok(await bal('6980') - loss0 === 8_000_000, '🔴 realized FX loss 8,000,000 on 6980', f(await bal('6980') - loss0))
  const mis = await recordPayment(po, vend, 10, 'bank', today, undefined, ADMIN, 'EUR')
  ok(mis.ok === false && mis.code === 'ERP-FINANCE-PAYMENT-CURRENCY-MISMATCH', '🔴 a EUR payment on a USD invoice is refused without a conversion rate', mis.error)
  const bank1 = await bal('1010')
  const conv = await recordPayment(po, vend, 10, 'bank', today, undefined, ADMIN, 'EUR', { conversionRate: 1.1 })
  const convRow = await one<{ amount: string; currency: string }>(`SELECT amount, currency FROM purchase_payments WHERE id=$1`, [conv.paymentId])
  ok(conv.ok === true && Number(convRow!.amount) === 11 && convRow!.currency === 'USD', 'with conversionRate 1.1 the 10 EUR is stored as 11 USD against the invoice')
  ok(await bal('1010') - bank1 === -7_000_003, 'bank leg still 10 EUR × 700,000.3 = 7,000,003', f(await bal('1010') - bank1))

  console.log('\n— credit guard on the base amount —')
  const c2 = (await one<{ id: number }>(`INSERT INTO sales_customers (code,name,credit_limit) VALUES ('FX2-C2','FX2 limited',50000000) RETURNING id`))!.id
  const usd100 = documentBase({ total: 100, exchangeRate: 600000, baseTotal: 60_000_000 })
  const cr1 = await evaluateCredit(c2, usd100)
  ok(cr1.exceeded === true && cr1.projected === 60_000_000, '🔴 a 100 USD invoice (60,000,000) exceeds a 50,000,000 Rial limit', JSON.stringify(cr1))
  ok((await evaluateCredit(c2, 1000)).exceeded === false, 'a 1,000 IRR invoice does not')

  console.log('\n— Treasury: approval on base amount, base GL, booked-rate true-up —')
  const tp = await createPayment({ paymentType: 'supplier_payment', party: 'FX2 vendor', partyRef: `vendor:${vend}`, amount: 300, currency: 'USD', date: today }, ADMIN)
  const sp = await submitPayment(tp.id, ADMIN)
  const req = await one<{ amount: string }>(`SELECT amount FROM approval_requests WHERE id=$1`, [sp.approvalRequestId])
  ok(Number(req!.amount) === 186_000_000 && sp.levels === 2, '🔴 approval request on 300 × 620,000 = 186,000,000 → 2 levels (100M–1B tier)', `${req!.amount} / ${sp.levels}`)
  await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1`, [tp.id])
  const bank2 = await bal('1010'), ap2 = await bal('2000'), loss2 = await bal('6980')
  const pr = await processPayment(tp.id, adminUser as never)
  ok(pr.apAllocations.length === 1 && pr.apAllocations[0].invoiceId === po, 'the USD payment allocates to the USD invoice only', JSON.stringify(pr.apAllocations))
  ok(await bal('1010') - bank2 === -186_000_000, 'bank −186,000,000 at the payment rate', f(await bal('1010') - bank2))
  const booked = 600_000_000 * (411 + 300) / 1000 - 600_000_000 * 411 / 1000
  ok(await bal('2000') - ap2 === booked, '🔴 AP relieved at the BOOKED rate (180,000,000), not 186,000,000', f(await bal('2000') - ap2))
  ok(await bal('6980') - loss2 === 6_000_000, '🔴 FX loss 6,000,000 via the true-up entry', f(await bal('6980') - loss2))
  ok(!!(await one(`SELECT 1 FROM gl_journal_entries WHERE reference=$1 AND status='posted'`, [`TRZPAY-FX-${tp.id}`])), 'true-up entry TRZPAY-FX-<id> booked')
  await reversePayment(tp.id, ADMIN)
  ok(await bal('1010') === bank2 && await bal('2000') === ap2 && await bal('6980') === loss2, 'reversing the payment also reverses the FX true-up (bank, AP, 6980 back)', `${f(await bal('1010'))} / ${f(await bal('2000'))} / ${f(await bal('6980'))}`)

  console.log('\n— legacy data: survey → dry-run → reversal + base re-post —')
  const legacyDoc = await salesInvoice(cust, 'FX2-LEGACY', 10, 0, 'USD', 600000)
  const [ar, rev, bank] = [await accountIdByCode('1100'), await accountIdByCode('4000'), await accountIdByCode('1010')]
  // Pre-fix shapes, booked through the core exactly as the old posters wrote them:
  // the invoice with raw USD lines under a USD header, the receipt with raw USD
  // lines under an IRR / rate-1 header.
  const legacyE = await withTransaction(q => insertPostedEntry(q, today, 'Sales invoice FX2-LEGACY', `SAL-${legacyDoc}`, ADMIN,
    [{ accountId: ar, debit: 10, credit: 0 }, { accountId: rev, debit: 0, credit: 10 }], { currency: 'USD', exchangeRate: 600000 }))
  await pgQuery(`UPDATE sales_documents SET gl_entry_id=$2 WHERE id=$1`, [legacyDoc, legacyE.id])
  const lp = await salesPayment(cust, legacyDoc, 4, 'USD', 650000)
  const legacyP = await withTransaction(q => insertPostedEntry(q, today, 'Customer receipt', `SPAY-${lp}`, ADMIN,
    [{ accountId: bank, debit: 4, credit: 0 }, { accountId: ar, debit: 0, credit: 4 }]))
  await pgQuery(`UPDATE sales_payments SET gl_entry_id=$2 WHERE id=$1`, [lp, legacyP.id])
  const survey = await fxSurvey()
  ok(survey.legacyEntries.length === 2 && survey.legacyEntries.every(e => e.action === 'restate'), 'survey finds both legacy shapes (USD header AND IRR-header receipt)', survey.legacyEntries.map(e => `${e.entryNo}:${e.kind}`).join(', '))
  ok(survey.distortion.find(d => d.code === '1100')!.rawNet === 6, 'survey reports the raw distortion on AR', JSON.stringify(survey.distortion.find(d => d.code === '1100')))
  ok(survey.invalidDocs.length === 0, 'no document with base_total = 0 or rate ≤ 0 (stop condition)')
  const revalBefore = (await previewRevaluation()).deltaToBook
  const arBefore = await bal('1100'), bankBefore = await bal('1010'), gainBefore = await bal('4900')
  const dry = await remediateFx({ apply: false })
  ok(dry.entries.length === 2 && dry.restated.length === 0 && await bal('1100') === arBefore, 'dry-run lists both and writes nothing')
  const ap = await remediateFx({ apply: true, userId: ADMIN })
  ok(ap.restated.length === 2, 'apply restates both', JSON.stringify(ap.restated))
  ok(await bal('1100') - arBefore === 6_000_000 - 2_400_000 - 6, '🔴 the legacy invoice now carries AR 3,600,000 at base (6,000,000 − 4 USD at booked)', f(await bal('1100') - arBefore))
  ok(await bal('1010') - bankBefore === 2_600_000 - 4, 'bank: 4 USD × 650,000 instead of 4', f(await bal('1010') - bankBefore))
  ok(await bal('4900') - gainBefore === -200_000, 'realized gain 200,000 reconstructed', f(await bal('4900') - gainBefore))
  const orig = await one<{ status: string; reversed_by: number | null }>(`SELECT status, reversed_by FROM gl_journal_entries WHERE id=$1`, [legacyE.id])
  const relinked = await one<{ gl_entry_id: number }>(`SELECT gl_entry_id FROM sales_documents WHERE id=$1`, [legacyDoc])
  ok(orig?.status === 'posted' && orig.reversed_by != null && relinked!.gl_entry_id === ap.restated.find(r => r.entryId === legacyE.id)!.newEntryId, 'original stays posted + reversed; the document now points at the restated entry')
  ok((await remediateFx({ apply: true, userId: ADMIN })).restated.length === 0 && (await fxSurvey()).legacyEntries.length === 0, 'a second apply restates nothing (idempotent)')
  ok((await previewRevaluation()).deltaToBook === revalBefore, '🔴 revaluation unaffected by the restatement (no double counting)', `${f(revalBefore)} → ${f((await previewRevaluation()).deltaToBook)}`)

  console.log('\n— books —')
  const tb = trialBalance(await loadTallies())
  ok(tb.balanced, 'trial balance balanced', `${f(tb.totalDebit)} = ${f(tb.totalCredit)}`)
  const nonBase = await one<{ n: number }>(`SELECT COUNT(*)::int AS n FROM gl_journal_lines l JOIN gl_journal_entries e ON e.id=l.entry_id
     WHERE e.status='posted' AND e.currency <> 'IRR' AND l.fx_amount IS NULL AND l.memo NOT LIKE 'Realized%' AND l.memo NOT LIKE '%booked rate%' AND e.id NOT IN (SELECT source_entry_id FROM gl_remediation_links) AND e.reversal_of IS NULL AND e.reference NOT LIKE 'fx-reval%'`)
  ok(nonBase!.n === 0, 'every converted foreign line carries its fx_amount (FX difference lines excepted)', String(nonBase!.n))

  console.log(`\n  ${pass}/${pass + fail} assertions passed.`)
  process.exit(fail ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
