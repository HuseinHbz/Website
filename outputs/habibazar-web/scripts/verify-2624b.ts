/**
 * Phase 26.24b live-PG verification — BUG-008 (purchase invoice auto-post to GL)
 * with the mandatory numeric AP proof (بند ۱.۳): the before/after AP balance
 * showing that without the auto-post AP went NEGATIVE, and with it AP settles to
 * exactly zero and non-negative, trial balance balanced. Plus void→reversal and
 * the delegation-cycle guard.
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import { saveDocument, recordPayment, confirmPurchaseInvoice, voidPurchaseInvoice, createVendor } from '@/lib/erp/purchasingData'
import { createDelegation } from '@/lib/erp/approvalData'
import { trialBalance } from '@/lib/erp/ledger'
import { loadTallies } from '@/lib/erp/ledgerData'

let n = 0, failed = 0
const ok = (c: boolean, l: string) => { n++; if (c) console.log(`  ✅ ${n}. ${l}`); else { failed++; console.error(`  ❌ ${n}. ${l}`) } }
const one = async <T>(sql: string, p: unknown[] = []) => (await pgQuery<T>(sql, p))[0]

/** Live AP (2000) balance = Σcredit − Σdebit over posted journal lines. */
async function apBalance(): Promise<number> {
  const r = await one<{ bal: number }>(
    `SELECT COALESCE(SUM(l.credit - l.debit),0)::float AS bal
     FROM gl_journal_lines l JOIN gl_journal_entries e ON e.id=l.entry_id
     JOIN gl_accounts a ON a.id=l.account_id
     WHERE a.code='2000' AND e.status='posted'`)
  return Number(r.bal)
}

async function main() {
  await runMigrations()
  await seedDatabase()
  const ADMIN = (await one<{ id: string }>(`SELECT id FROM users ORDER BY created_at LIMIT 1`)).id
  const today = new Date().toISOString().slice(0, 10)

  console.log('— بند ۱: BUG-008 — purchase invoice auto-post to GL —')
  const vendorId = await createVendor({ name: 'تأمین‌کننده آزمون', kind: 'company' }, ADMIN)

  // Scenario A (the OLD bug): pay a purchase invoice that was NEVER posted → AP
  // is debited by the payment but was never credited by the invoice → NEGATIVE.
  const apBefore = await apBalance()
  const badInv = await saveDocument({ docType: 'invoice', vendorId, date: today, currency: 'IRR',
    lines: [{ description: 'کالای الف', qty: 1, unitPrice: 10_000_000, discountPct: 0, taxPct: 9 }] }, ADMIN)
  await recordPayment(badInv, vendorId, 10_900_000, 'bank', today, 'PMT-BAD', ADMIN)
  const apAfterUnposted = await apBalance()
  ok(apAfterUnposted < apBefore, `WITHOUT invoice posting: paying drives AP negative — AP ${apBefore} → ${apAfterUnposted} (Δ ${apAfterUnposted - apBefore})`)

  // Scenario B (the FIX): confirm auto-posts the invoice (Cr AP), then pay (Dr AP)
  // → AP nets back to a NON-NEGATIVE settled position.
  const apPreB = await apBalance()
  const inv = await saveDocument({ docType: 'invoice', vendorId, date: today, currency: 'IRR',
    lines: [{ description: 'کالای ب', qty: 2, unitPrice: 5_000_000, discountPct: 0, taxPct: 9 }] }, ADMIN)
  const conf = await confirmPurchaseInvoice(inv, ADMIN)
  ok(conf.entryId != null && conf.status === 'confirmed', `confirm auto-posts invoice → GL entry #${conf.entryId}`)
  const invRow = await one<{ gl_entry_id: number | null }>(`SELECT gl_entry_id FROM purchase_documents WHERE id=$1`, [inv])
  ok(invRow.gl_entry_id === conf.entryId, 'purchase_documents.gl_entry_id is stamped (idempotency guard)')
  const apAfterPost = await apBalance()
  ok(apAfterPost === apPreB + 10_900_000, `posting CREDITS AP by the gross total — AP ${apPreB} → ${apAfterPost} (+10,900,000)`)
  // Idempotent re-confirm books nothing new.
  const conf2 = await confirmPurchaseInvoice(inv, ADMIN)
  ok(conf2.entryId === conf.entryId && (await apBalance()) === apAfterPost, 'auto-post is idempotent (re-confirm books nothing)')
  // Now pay it in full → this invoice's AP delta nets to zero.
  await recordPayment(inv, vendorId, 10_900_000, 'bank', today, 'PMT-OK', ADMIN)
  const apSettled = await apBalance()
  ok(apSettled - apPreB === 0, `after full payment this invoice's AP delta is exactly 0 — AP ${apAfterPost} → ${apSettled} (Δ vs pre ${apSettled - apPreB})`)

  // Definitive proof: self-heal scenario A by posting its (previously unposted)
  // invoice → global AP returns to EXACTLY ZERO and non-negative.
  await confirmPurchaseInvoice(badInv, ADMIN)
  const apGlobal = await apBalance()
  ok(apGlobal === 0, `after posting the stranded invoice, GLOBAL AP = ${apGlobal} (zero and non-negative) ✔`)

  console.log('— بند ۱: void → balanced reversal (two-way link) —')
  const inv2 = await saveDocument({ docType: 'invoice', vendorId, date: today, currency: 'IRR',
    lines: [{ description: 'کالای ج', qty: 1, unitPrice: 3_000_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
  const c3 = await confirmPurchaseInvoice(inv2, ADMIN)
  const v = await voidPurchaseInvoice(inv2, ADMIN)
  ok(v.status === 'void' && v.reversalId != null, `void posts a reversal entry #${v.reversalId}`)
  const link = await one<{ reversal_of: number | null; reversed_by: number | null }>(
    `SELECT reversal_of FROM gl_journal_entries WHERE id=$1`, [v.reversalId])
  ok(link.reversal_of === c3.entryId, 'reversal is two-way linked (reversal_of = original)')
  const origLink = await one<{ reversed_by: number | null }>(`SELECT reversed_by FROM gl_journal_entries WHERE id=$1`, [c3.entryId])
  ok(Number(origLink.reversed_by) === v.reversalId, 'original entry links back (reversed_by = reversal)')

  console.log('— بند ۳: delegation cycle guard —')
  const u2 = await one<{ id: string }>(`INSERT INTO users (id,email,name,password_hash,role,created_at) VALUES ('u-b','b@x.io','B','x','editor',to_char(now(),'YYYY-MM-DD HH24:MI:SS')) RETURNING id`).catch(() => ({ id: 'u-b' }))
  let selfRejected = false
  try { await createDelegation({ fromUserId: ADMIN, toUserId: ADMIN, startDate: today, endDate: today }, ADMIN) } catch { selfRejected = true }
  ok(selfRejected, 'self-delegation (A→A) rejected at creation')
  await createDelegation({ fromUserId: ADMIN, toUserId: u2.id, startDate: today, endDate: '2030-01-01' }, ADMIN)
  let cycleRejected = false
  try { await createDelegation({ fromUserId: u2.id, toUserId: ADMIN, startDate: today, endDate: '2030-01-01' }, ADMIN) } catch { cycleRejected = true }
  ok(cycleRejected, 'cyclic delegation (A→B then B→A) rejected at creation')

  console.log('— بند ۶.۲: books balanced after the cycle —')
  const tb = trialBalance(await loadTallies())
  ok(tb.balanced, 'trial balance balanced')

  console.log(failed === 0 ? `\n✅ ALL ${n} PASSED` : `\n❌ ${failed}/${n} FAILED`)
  process.exit(failed ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
