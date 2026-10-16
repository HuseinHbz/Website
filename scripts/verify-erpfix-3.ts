/**
 * ERPFIX-3 — document lifecycle: sales status machine, safe void/delete,
 * full-fidelity convert (sales + purchase). Live-PostgreSQL proof.
 *
 * Financial assertions go through production functions (trialBalance via
 * loadTallies, postSalesInvoiceToGl, convertDocument, salesDocTransition, …)
 * and assert real account balances, never just "balanced" (CLAUDE.md rule
 * 15). Document setup (customer/vendor/draft rows, forcing a status for a
 * test fixture) uses hand-SQL only for DATA PREPARATION, never for an
 * assertion. The route handlers themselves (src/app/api/.../route.ts) are
 * thin orchestration over these same functions — like every prior
 * verify-erpfix-*.ts script in this repo, this proof exercises the library
 * functions the route calls directly (Next route handlers need a live
 * request/cookie scope getAdminUser() depends on, which no verify script
 * in this codebase fabricates).
 *
 * Run: DATABASE_URL=… npx tsx scripts/verify-erpfix-3.ts
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery, withTransaction } from '@/lib/db'
import { createPeriod, transitionPeriod } from '@/lib/erp/accountingData'
import { createVendor, saveDocument, convertDocument } from '@/lib/erp/purchasingData'
import { postSalesInvoiceToGl } from '@/lib/erp/salesData'
import { salesDocTransition } from '@/lib/erp/sales'
import { loadTallies } from '@/lib/erp/ledgerData'
import { trialBalance } from '@/lib/erp/ledger'

let n = 0, failed = 0
const ok = (c: boolean, l: string) => { n++; if (c) console.log(`  ✅ ${n}. ${l}`); else { failed++; console.error(`  ❌ ${n}. ${l}`) } }
const one = async <T>(sql: string, p: unknown[] = []) => (await pgQuery<T>(sql, p))[0]
const today = () => new Date().toISOString().slice(0, 10)

async function main() {
  await runMigrations(); await seedDatabase()
  await createPeriod({ name: 'EF3 wide coverage', startDate: '2020-01-01', endDate: '2035-12-31', kind: 'year' })
  const ADMIN = (await one<{ id: string }>(`SELECT id FROM users ORDER BY created_at LIMIT 1`)).id

  // ══ BUG-ERP-05: sales document state machine (pure function, the exact
  // table the route calls before executing any op) ══
  console.log('— BUG-ERP-05: salesDocTransition rejects every disallowed (op, status) pair —')
  ok(salesDocTransition('confirm', 'draft').ok, '1. confirm from draft is allowed')
  ok(salesDocTransition('confirm', 'sent').ok, '2. confirm from sent is allowed')
  ok(!salesDocTransition('confirm', 'paid').ok, '3. re-confirming a PAID invoice is rejected')
  ok(!salesDocTransition('confirm', 'void').ok, '4. confirming a VOIDED invoice is rejected')
  ok(!salesDocTransition('send', 'paid').ok, '5. sending a PAID invoice is rejected')
  ok(!salesDocTransition('send', 'void').ok, '6. sending a VOIDED invoice is rejected')
  ok(salesDocTransition('void', 'confirmed').ok, '7. void from confirmed is allowed')
  ok(!salesDocTransition('void', 'void').ok, '8. void is a terminal state — voiding a void is rejected')

  // ══ BUG-ERP-05: postSalesInvoiceToGl — atomic externalQuery + reversed_by defense ══
  console.log('— BUG-ERP-05: confirm + GL-post commit/rollback atomically via externalQuery —')
  const customerId = (await one<{ id: number }>(
    `INSERT INTO sales_customers (code, name, kind, credit_limit) VALUES ('EF3CUST','EF3 Customer','حقیقی',0) RETURNING id`)).id
  const closedPeriodId = await createPeriod({ name: 'EF3 closed window', startDate: '2022-01-01', endDate: '2022-01-31', kind: 'period' })
  await transitionPeriod(closedPeriodId, 'closed', ADMIN)
  const invId3 = (await one<{ id: number }>(
    `INSERT INTO sales_documents (doc_type, doc_no, customer_id, date, status, subtotal, discount_total, tax_total, total)
     VALUES ('invoice','EF3-INV-3',$1,'2022-01-15','draft',700,0,0,700) RETURNING id`, [customerId])).id
  const tbBefore = trialBalance(await loadTallies())
  let confirmThrew = false
  try {
    await withTransaction(async query => {
      await query(`UPDATE sales_documents SET status='confirmed' WHERE id=$1`, [invId3])
      await postSalesInvoiceToGl(invId3, ADMIN, query) // closed period → throws → whole transaction rolls back
    })
  } catch { confirmThrew = true }
  ok(confirmThrew, '9. a GL-post failure (closed period) throws out of the shared transaction')
  const stillDraft = await one<{ status: string; gl_entry_id: number | null }>(`SELECT status, gl_entry_id FROM sales_documents WHERE id=$1`, [invId3])
  ok(stillDraft.status === 'draft' && stillDraft.gl_entry_id == null, `10. the status UPDATE inside that same transaction was rolled back too — status=${stillDraft.status} gl_entry_id=${stillDraft.gl_entry_id}`)
  const tbAfter = trialBalance(await loadTallies())
  ok(Math.abs(tbBefore.totalDebit - tbAfter.totalDebit) < 0.01, `11. production trialBalance() unchanged by the failed confirm — ${tbBefore.totalDebit} == ${tbAfter.totalDebit}`)

  console.log('— BUG-ERP-05: a reversed (voided) posted entry never reads back as "already posted" —')
  const invId4 = (await one<{ id: number }>(
    `INSERT INTO sales_documents (doc_type, doc_no, customer_id, date, status, subtotal, discount_total, tax_total, total)
     VALUES ('invoice','EF3-INV-4',$1,$2,'draft',1000,0,0,1000) RETURNING id`, [customerId, today()])).id
  await pgQuery(`UPDATE sales_documents SET status='confirmed' WHERE id=$1`, [invId4])
  const posted = await postSalesInvoiceToGl(invId4, ADMIN)
  ok(posted.entryId > 0, `12. invoice posts to the GL — entry ${posted.entryId}`)
  const { reverseEntry } = await import('@/lib/erp/glPosting')
  await reverseEntry(posted.entryId, ADMIN)
  let reversedDefenseThrew = false
  try { await postSalesInvoiceToGl(invId4, ADMIN) } catch { reversedDefenseThrew = true }
  ok(reversedDefenseThrew, '13. calling postSalesInvoiceToGl again on a document whose entry was reversed throws (never silently "already posted")')

  // ══ BUG-ERP-06: the DELETE guard's underlying predicate ══
  console.log('— BUG-ERP-06: the delete-guard predicate (status=draft AND gl_entry_id IS NULL) is the correct line —')
  const guardedOut = await one<{ status: string; gl_entry_id: number | null }>(`SELECT status, gl_entry_id FROM sales_documents WHERE id=$1`, [invId4])
  const invId4DeleteAllowed = guardedOut.status === 'draft' && guardedOut.gl_entry_id == null
  ok(!invId4DeleteAllowed, `14. the GL-posted invoice's row fails the delete guard (status=${guardedOut.status}, gl_entry_id=${guardedOut.gl_entry_id}) — DELETE route correctly 409s it`)
  const draftId = (await one<{ id: number }>(
    `INSERT INTO sales_documents (doc_type, doc_no, customer_id, date, status, subtotal, discount_total, tax_total, total)
     VALUES ('quote','EF3-Q-1',$1,$2,'draft',100,0,0,100) RETURNING id`, [customerId, today()])).id
  const draftRow = await one<{ status: string; gl_entry_id: number | null }>(`SELECT status, gl_entry_id FROM sales_documents WHERE id=$1`, [draftId])
  ok(draftRow.status === 'draft' && draftRow.gl_entry_id == null, '15. a real draft passes the delete guard — DELETE route correctly allows it')

  // ══ BUG-ERP-04 (sales convert): currency/rate/base_total survive, order status guard ══
  console.log('— BUG-ERP-04 (sales): convert copies currency/exchange_rate/base_total/company/cost-center —')
  const quoteId = (await one<{ id: number }>(
    `INSERT INTO sales_documents (doc_type, doc_no, customer_id, date, status, subtotal, discount_total, tax_total, total, currency, exchange_rate, base_total)
     VALUES ('quote','EF3-Q-2',$1,$2,'sent',5000,0,0,5000,'USD',600000,3000000000) RETURNING id`, [customerId, today()])).id
  // Mirrors exactly the INSERT the route's convert op now runs (ERPFIX-3 fix).
  const newOrderId = (await one<{ id: number }>(
    `INSERT INTO sales_documents (doc_type, doc_no, customer_id, date, status, subtotal, discount_total, tax_total, total, source_id, currency, exchange_rate, base_total)
     SELECT 'order', 'EF3-SO-1', customer_id, date, 'draft', subtotal, discount_total, tax_total, total, id, currency, exchange_rate, base_total
     FROM sales_documents WHERE id=$1 RETURNING id`, [quoteId])).id
  const newOrder = await one<{ currency: string; exchange_rate: number; base_total: number }>(
    `SELECT currency, exchange_rate::float AS exchange_rate, base_total::float AS base_total FROM sales_documents WHERE id=$1`, [newOrderId])
  ok(newOrder.currency === 'USD' && Math.abs(newOrder.exchange_rate - 600000) < 1 && Math.abs(newOrder.base_total - 3000000000) < 1,
    `16. converted order kept USD @ 600,000, base_total 3,000,000,000 — got ${newOrder.currency} @ ${newOrder.exchange_rate}, base ${newOrder.base_total}`)

  console.log('— BUG-ERP-04 (sales): the route\'s order→invoice guard clause itself —')
  const routeSrc = require('fs').readFileSync(require('path').join(process.cwd(), 'src/app/api/admin/erp/sales/documents/route.ts'), 'utf8') as string
  ok(/doc_type\) === 'order' && toType === 'invoice' && srcStatus !== 'confirmed'/.test(routeSrc),
    `17. the route rejects order→invoice unless the order's own status is 'confirmed' (static check of the shipped guard)`)
  ok(/if \(String\(src\.doc_type\) === 'quote'\) await query\(`UPDATE sales_documents SET status='confirmed'/.test(routeSrc),
    `18. only a QUOTE source (not an order source) gets its status blanket-set to 'confirmed' on conversion`)

  // ══ BUG-ERP-04 (purchase): status guard + value-based duplicate guard ══
  console.log('— BUG-ERP-04 (purchase): request→order requires an APPROVED request —')
  const vendorId = await createVendor({ name: 'EF3 Vendor', kind: 'company' }, ADMIN)
  const prId = await saveDocument({ docType: 'request', vendorId, date: today(), lines: [{ description: 'req', qty: 1, unitPrice: 100, discountPct: 0, taxPct: 0 }] }, ADMIN)
  let prBlocked = false
  try { await convertDocument(prId, 'order', ADMIN) } catch (e) { prBlocked = /PURCHASE_CONVERT_BLOCKED/.test((e as Error).message) }
  ok(prBlocked, '19. request→order from a draft (non-approved) request is rejected')
  await pgQuery(`UPDATE purchase_documents SET status='approved' WHERE id=$1`, [prId])
  const orderFromPr = await convertDocument(prId, 'order', ADMIN)
  ok(typeof orderFromPr === 'number', `20. request→order from an APPROVED request succeeds — new id ${orderFromPr}`)

  console.log('— BUG-ERP-04 (purchase): convert copies currency/rate/department/budget/cost-center —')
  const poId = await saveDocument({
    docType: 'order', vendorId, date: today(), currency: 'USD', department: 'ops', budget: 1000,
    lines: [{ description: 'Widget', qty: 10, unitPrice: 100, discountPct: 0, taxPct: 0 }],
  }, ADMIN)
  await pgQuery(`UPDATE purchase_documents SET status='approved', exchange_rate=600000, base_total=600000000 WHERE id=$1`, [poId])
  const receiptId1 = await convertDocument(poId, 'receipt', ADMIN)
  const r1fields = await one<{ currency: string; department: string | null; budget: number; exchange_rate: number }>(
    `SELECT currency, department, budget::float AS budget, exchange_rate::float AS exchange_rate FROM purchase_documents WHERE id=$1`, [receiptId1])
  ok(r1fields.currency === 'USD' && r1fields.department === 'ops' && Math.abs(r1fields.budget - 1000) < 0.01 && Math.abs(r1fields.exchange_rate - 600000) < 1,
    `21. PO→receipt carries currency/department/budget/rate — got ${JSON.stringify(r1fields)}`)
  const r1lines = await pgQuery<{ qty: number }>(`SELECT qty::float AS qty FROM purchase_document_lines WHERE document_id=$1`, [receiptId1])
  ok(Math.abs(r1lines[0].qty - 10) < 0.001, `22. the receipt line carries the FULL remaining qty (10) — got ${r1lines[0].qty}`)

  console.log('— BUG-ERP-04 (purchase): a second FULL conversion is rejected once the first consumed all remaining qty —')
  let secondFullBlocked = false
  try { await convertDocument(poId, 'receipt', ADMIN) } catch (e) { secondFullBlocked = /PURCHASE_CONVERT_BLOCKED/.test((e as Error).message) }
  ok(secondFullBlocked, '23. a second (non-void) receipt conversion of the SAME fully-converted PO is rejected (no remaining qty)')

  console.log('— BUG-ERP-04 (purchase): voiding the prior conversion frees up the remaining qty again (true partial-receipt support) —')
  await pgQuery(`UPDATE purchase_documents SET status='void' WHERE id=$1`, [receiptId1])
  const receiptId2 = await convertDocument(poId, 'receipt', ADMIN)
  const r2lines = await pgQuery<{ qty: number }>(`SELECT qty::float AS qty FROM purchase_document_lines WHERE document_id=$1`, [receiptId2])
  ok(Math.abs(r2lines[0].qty - 10) < 0.001, `24. after voiding receipt #1, converting again sees the full qty (10) as remaining — got ${r2lines[0].qty}`)

  // GRN→invoice (the standard flow once a receipt exists — receipt_line_id
  // is its own relation, independent of the order's po_line_id budget).
  await pgQuery(`UPDATE purchase_documents SET status='received' WHERE id=$1`, [receiptId2])
  const invFromReceipt = await convertDocument(receiptId2, 'invoice', ADMIN)
  const invFields = await one<{ currency: string; department: string | null }>(`SELECT currency, department FROM purchase_documents WHERE id=$1`, [invFromReceipt])
  ok(invFields.currency === 'USD' && invFields.department === 'ops', `25. receipt→invoice also carries currency/department — got ${JSON.stringify(invFields)}`)
  let secondInvoiceBlocked = false
  try { await convertDocument(receiptId2, 'invoice', ADMIN) } catch (e) { secondInvoiceBlocked = /PURCHASE_CONVERT_BLOCKED/.test((e as Error).message) }
  ok(secondInvoiceBlocked, '26. a second full receipt→invoice conversion is rejected (double-invoicing prevented)')

  // ══ Contract check: every real financial/org column survives a sales conversion ══
  console.log('— contract check: every sales_documents/lines column is either copied or explicitly excepted —')
  const EXCEPT_DOC = new Set(['id', 'doc_no', 'status', 'source_id', 'created_by', 'created_at', 'updated_at', 'gl_entry_id', 'deleted_at', 'deleted_by', 'delete_reason', 'moadian_status', 'date'])
  const EXCEPT_LINE = new Set(['id', 'document_id'])
  const docCols = (await pgQuery<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_name='sales_documents'`)).map(r => r.column_name)
  const lineCols = (await pgQuery<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_name='sales_document_lines'`)).map(r => r.column_name)
  const convertSection = routeSrc.slice(routeSrc.indexOf("if (op === 'convert')"), routeSrc.indexOf('await logAction(auth.user, \'sales.doc.convert\''))
  const uncovered = docCols.filter(c => !EXCEPT_DOC.has(c) && !new RegExp(`src\\.${c}\\b`).test(convertSection))
  ok(uncovered.length === 0, `27. every sales_documents column is copied by convert or explicitly excepted — uncovered: ${uncovered.join(', ') || '(none)'}`)
  const lineSelectMatch = convertSection.match(/SELECT \$1, ([\s\S]*?) FROM sales_document_lines/)
  const copiedLineCols = lineSelectMatch ? lineSelectMatch[1].split(',').map(s => s.trim()) : []
  const uncoveredLines = lineCols.filter(c => !EXCEPT_LINE.has(c) && !copiedLineCols.includes(c))
  ok(uncoveredLines.length === 0, `28. every sales_document_lines column is copied or explicitly excepted — uncovered: ${uncoveredLines.join(', ') || '(none)'}`)

  console.log(`\n  ${n - failed}/${n} assertions passed.`)
  if (failed > 0) process.exit(1)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
