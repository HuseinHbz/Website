/**
 * Phase 26.23 live-PG E2E — Lead → activity → convert → invoice → auto GL →
 * payment GL → void → reversal → trial balance still balanced. Plus the
 * journal hardening (numbering, draft edit, delete guard, maker/checker).
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import { postSalesInvoiceToGl } from '@/lib/erp/salesData'
import { postSalesPaymentToGl, postPurchasePaymentToGl, reverseEntry, postEntryById, loadGlMap, applyGlMap } from '@/lib/erp/glPosting'
import { recordPayment as recordPurchasePayment, createVendor, saveDocument as savePurchaseDoc, postPurchaseInvoiceToGl } from '@/lib/erp/purchasingData'
import { loadTallies } from '@/lib/erp/ledgerData'
import { trialBalance } from '@/lib/erp/ledger'
import { scanLedgerIntegrity } from '@/lib/erp/accountingValidationData'
import { createApprovalRequest, actOnRequest } from '@/lib/erp/approvalData'
import { nextNumber } from '@/lib/numbering/integrate'
import type { AdminUser } from '@/lib/admin/auth'

let n = 0, failed = 0
const ok = (c: boolean, l: string) => { n++; if (c) console.log(`  ✅ ${n}. ${l}`); else { failed++; console.error(`  ❌ ${n}. ${l}`) } }
const one = async <T>(sql: string, p: unknown[] = []) => (await pgQuery<T>(sql, p))[0]
const num = (v: unknown) => Number(v ?? 0)
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

async function main() {
  await runMigrations()
  await seedDatabase()
  const ADMIN = (await one<{ id: string }>(`SELECT id FROM users ORDER BY created_at LIMIT 1`)).id

  console.log('— بند ۵: lead → activity → convert —')
  const lead = await one<{ id: number }>(
    `INSERT INTO crm_leads (name,email,phone,company,source,status,score,value,owner_id)
     VALUES ('Sara Tehrani','sara@acme.ir','09121234567','Acme Iran','website','qualified',80,500000000,$1) RETURNING id`, [ADMIN])
  await pgQuery(`INSERT INTO crm_activities (lead_id,kind,body,created_by) VALUES ($1,'call','Intro call — interested in ERP',$2)`, [lead.id, ADMIN])
  const acts = await pgQuery(`SELECT id FROM crm_activities WHERE lead_id=$1`, [lead.id])
  ok(acts.length === 1, 'activity logged on the lead (timeline)')
  // Convert (mirrors the convert route logic): dup-detect then create.
  const dupCheck = await one(`SELECT id FROM sales_customers WHERE active=1 AND email='sara@acme.ir' LIMIT 1`)
  ok(!dupCheck, 'no duplicate customer exists before conversion')
  const cust = await one<{ id: number }>(
    `INSERT INTO sales_customers (code,name,kind,email,phone,updated_at) VALUES ('C-9001','Acme Iran','company','sara@acme.ir','09121234567',${NOW}) RETURNING id`)
  await pgQuery(`UPDATE crm_leads SET converted_customer_id=$2, status='won' WHERE id=$1`, [lead.id, cust.id])
  const conv = await one<{ converted_customer_id: number }>(`SELECT converted_customer_id FROM crm_leads WHERE id=$1`, [lead.id])
  ok(conv.converted_customer_id === cust.id, 'lead converted → customer linked (converted_customer_id)')

  console.log('— بند ۱: invoice → auto GL (mapped) → payment GL —')
  const inv = await one<{ id: number }>(
    `INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,tax_total,total,updated_at)
     VALUES ('invoice','INV-E2E-1',$1,to_char(now(),'YYYY-MM-DD'),'confirmed',10000000,900000,10900000,${NOW}) RETURNING id`, [cust.id])
  const post = await postSalesInvoiceToGl(inv.id, ADMIN)
  ok(post.entryId > 0 && !post.alreadyPosted, 'confirmed invoice posted to the GL (gl_entry_id set)')
  ok((await postSalesInvoiceToGl(inv.id, ADMIN)).alreadyPosted, 'second post is idempotent (gl_entry_id guard)')
  const map = await loadGlMap()
  ok(map.ar === '1100' && map.revenue === '4000' && map.vat === '2100', 'GL map loads seeded defaults from erp_settings')
  const pay = await one<{ id: number }>(
    `INSERT INTO sales_payments (customer_id,document_id,date,amount,method,currency,exchange_rate)
     VALUES ($1,$2,to_char(now(),'YYYY-MM-DD'),10900000,'bank','IRR',1) RETURNING id`, [cust.id, inv.id])
  const payPost = await postSalesPaymentToGl(pay.id, ADMIN)
  ok(payPost.entryId > 0, 'customer receipt posted: Dr Bank / Cr AR')
  ok((await postSalesPaymentToGl(pay.id, ADMIN)).alreadyPosted, 'payment posting is idempotent')
  const payLines = await pgQuery<{ code: string; debit: number; credit: number }>(
    `SELECT a.code, l.debit::float AS debit, l.credit::float AS credit FROM gl_journal_lines l
     JOIN gl_accounts a ON a.id=l.account_id WHERE l.entry_id=$1 ORDER BY l.line_no`, [payPost.entryId])
  ok(payLines[0].code === '1010' && payLines[0].debit === 10900000 && payLines[1].code === '1100' && payLines[1].credit === 10900000, 'receipt entry hits the mapped Bank/AR accounts')

  console.log('— بند ۱.۲: purchase invoice + payment GL —')
  const v = await createVendor({ code: 'V-9001', name: 'Parts Co', kind: 'company' } as never, ADMIN)
  const pinv = await savePurchaseDoc({ docType: 'invoice', vendorId: v, date: new Date().toISOString().slice(0, 10), lines: [{ description: 'parts', qty: 10, unitPrice: 500000, discountPct: 0, taxPct: 9 }] }, ADMIN)
  await pgQuery(`UPDATE purchase_documents SET status='confirmed' WHERE id=$1`, [pinv])
  await postPurchaseInvoiceToGl(pinv, ADMIN)
  await recordPurchasePayment(pinv, v, 5450000, 'bank', new Date().toISOString().slice(0, 10), undefined, ADMIN)
  const ppay = await one<{ id: number; gl_entry_id: number | null }>(`SELECT id, gl_entry_id FROM purchase_payments WHERE document_id=$1`, [pinv])
  ok(!!ppay.gl_entry_id, 'purchase payment auto-posted: Dr AP / Cr Bank')
  ok((await postPurchasePaymentToGl(ppay.id, ADMIN)).alreadyPosted, 'purchase payment posting idempotent')

  console.log('— بند ۲: void → reversal + delete guard —')
  const glBefore = await one<{ dr: number; cr: number }>(
    `SELECT COALESCE(SUM(l.debit),0)::float AS dr, COALESCE(SUM(l.credit),0)::float AS cr
     FROM gl_journal_lines l JOIN gl_journal_entries e ON e.id=l.entry_id WHERE e.status='posted'`)
  const rev = await reverseEntry(post.entryId, ADMIN)
  ok(rev.reversalId > 0 && !rev.alreadyReversed, 'voiding the invoice entry booked a reversal')
  ok((await reverseEntry(post.entryId, ADMIN)).alreadyReversed, 'reversing again returns the same reversal (idempotent)')
  const link = await one<{ status: string; reversed_by: number }>(`SELECT status, reversed_by FROM gl_journal_entries WHERE id=$1`, [post.entryId])
  const revRow = await one<{ reversal_of: number; status: string }>(`SELECT reversal_of, status FROM gl_journal_entries WHERE id=$1`, [rev.reversalId])
  // 26.26b BUG-020 (CC-003): a reversed entry now STAYS 'posted' (its reversal
  // nets it to zero); "reversed" is carried by reversed_by, not status='void'.
  ok(link.status === 'posted' && link.reversed_by === rev.reversalId && revRow.reversal_of === post.entryId && revRow.status === 'posted', 'two-way linkage reversal_of ⇄ reversed_by (original stays posted, net zero)')
  // AR net effect of invoice+reversal = 0.
  const arNet = await one<{ t: number }>(
    `SELECT COALESCE(SUM(l.debit-l.credit),0)::float AS t FROM gl_journal_lines l
     JOIN gl_journal_entries e ON e.id=l.entry_id JOIN gl_accounts a ON a.id=l.account_id
     WHERE a.code='1100' AND e.id IN ($1,$2) AND e.status IN ('posted','void')`, [post.entryId, rev.reversalId])
  ok(Math.abs(num(arNet.t)) < 0.001, 'invoice + reversal net to zero on AR')
  // Delete guard: a voided entry may never be physically deleted (route logic mirrored).
  const st = await one<{ status: string }>(`SELECT status FROM gl_journal_entries WHERE id=$1`, [post.entryId])
  ok(st.status !== 'draft', 'voided entry is not draft → the route rejects DELETE (only drafts deletable)')

  console.log('— بند ۳: numbering + draft edit + templates —')
  const je1 = await nextNumber('journal', { legacyPrefix: 'JE' })
  const je2 = await nextNumber('journal', { legacyPrefix: 'JE' })
  ok(/^JE-\d{4}-\d{5}$/.test(je1) && /^JE-\d{4}-\d{5}$/.test(je2), `JE numbers from the Numbering Engine (${je1}, ${je2})`)
  ok(Number(je2.slice(-5)) === Number(je1.slice(-5)) + 1, 'sequential, gapless counter')
  await pgQuery(`INSERT INTO gl_entry_templates (name, memo, lines, created_by) VALUES ('Monthly rent','Rent accrual','[{"accountId":1,"debit":100,"credit":0},{"accountId":2,"debit":0,"credit":100}]',$1)`, [ADMIN])
  const tpl = await one<{ lines: string }>(`SELECT lines FROM gl_entry_templates WHERE name='Monthly rent'`)
  ok(JSON.parse(tpl.lines).length === 2, 'entry template stored and loadable')

  console.log('— بند ۴: maker/checker —')
  await pgQuery(`UPDATE erp_settings SET value='on' WHERE key='gl_posting_approval'`)
  await pgQuery(`UPDATE erp_settings SET value='1000000' WHERE key='gl_posting_approval_threshold'`)
  // Draft entry above threshold, created by ADMIN.
  const bank = await one<{ id: number }>(`SELECT id FROM gl_accounts WHERE code='1010'`)
  const eq = await one<{ id: number }>(`SELECT id FROM gl_accounts WHERE code='4000'`)
  const draft = await one<{ id: number }>(
    `INSERT INTO gl_journal_entries (entry_no,date,memo,status,total,created_by) VALUES ($1,to_char(now(),'YYYY-MM-DD'),'big entry','draft',5000000,$2) RETURNING id`,
    [await nextNumber('journal', { legacyPrefix: 'JE' }), ADMIN])
  await pgQuery(`INSERT INTO gl_journal_lines (entry_id,account_id,debit,credit,line_no) VALUES ($1,$2,5000000,0,0),($1,$3,0,5000000,1)`, [draft.id, bank.id, eq.id])
  const req = await createApprovalRequest({ docType: 'journal_entry', refType: 'gl_journal_entries', refId: draft.id, title: 'Post big entry', amount: 5000000 } as never, ADMIN)
  ok(!req.autoApproved && req.levels >= 1, 'over-threshold post created an approval request (seeded matrix rule)')
  const maker: AdminUser = { id: ADMIN, name: 'Maker', email: 'a@a', role: 'super_admin' } as AdminUser
  let sodBlocked = false
  try { await actOnRequest(req.id, maker, 'approved', 'self-approve', '127.0.0.1') } catch { sodBlocked = true }
  ok(sodBlocked, 'maker cannot approve their own entry (separation of duties → rejected)')
  const checkerId = 'checker-1'
  await pgQuery(`INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES ($1,'Checker','chk@x.io','h','administrator',${NOW})`, [checkerId])
  const checker: AdminUser = { id: checkerId, name: 'Checker', email: 'chk@x.io', role: 'administrator' } as AdminUser
  const decision = await actOnRequest(req.id, checker, 'approved', 'looks right', '127.0.0.1')
  const posted = await one<{ status: string }>(`SELECT status FROM gl_journal_entries WHERE id=$1`, [draft.id])
  ok(decision.status === 'approved' && posted.status === 'posted', 'checker approval posts the entry (advanceDocument hook)')
  await pgQuery(`UPDATE erp_settings SET value='off' WHERE key='gl_posting_approval'`)
  // postEntryById guard: posting a posted entry again fails cleanly.
  ok(!(await postEntryById(draft.id)).ok, 'postEntryById refuses a non-draft entry')

  console.log('— بند ۶.۲: books still reconcile —')
  const tb = trialBalance(await loadTallies())
  ok(tb.balanced, `trial balance balanced after the full cycle (Dr ${tb.totalDebit.toLocaleString()})`)
  const integ = await scanLedgerIntegrity({ status: 'posted' })
  ok(integ.withIssues === 0 && integ.score === 100, `ledger integrity 100 (${integ.entriesChecked} posted entries incl. reversal + payments)`)
  const glAfter = await one<{ dr: number; cr: number }>(
    `SELECT COALESCE(SUM(l.debit),0)::float AS dr, COALESCE(SUM(l.credit),0)::float AS cr
     FROM gl_journal_lines l JOIN gl_journal_entries e ON e.id=l.entry_id WHERE e.status='posted'`)
  ok(Math.abs(num(glAfter.dr) - num(glAfter.cr)) < 0.001 && num(glAfter.dr) > num(glBefore.dr), 'posted ledger grew and stays Dr = Cr')

  console.log(failed === 0 ? `\n✅ ALL ${n} PASSED` : `\n❌ ${failed}/${n} FAILED`)
  process.exit(failed ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
