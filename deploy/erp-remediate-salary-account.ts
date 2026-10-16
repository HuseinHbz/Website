/**
 * ERPFIX-1 BUG-ERP-10 — remediate payroll entries posted to 6100 (Rent
 * Expense) back to 6000 (Salaries Expense), per the maintainer's decision.
 *
 * SAFETY:
 *   • DRY-RUN by default — lists every affected posted entry, changes
 *     NOTHING.
 *   • `--apply` posts, for each open-period affected entry, a REAL
 *     reversing correction entry through the shared `insertPostedEntry`
 *     (Dr 6000 / Cr 6100 for the payroll share) — the original posted
 *     entry is NEVER edited or voided (BUG-020 discipline).
 *   • An entry whose date falls in a CLOSED or LOCKED period is reported,
 *     never corrected automatically — that needs a manual year-end
 *     adjustment the accountant signs off on.
 *   • Only entries whose reference starts with 'payroll:' are touched —
 *     a manually-posted real rent entry on 6100 is never moved.
 *
 * Usage:
 *   DATABASE_URL=… npx tsx deploy/erp-remediate-salary-account.ts            # preview
 *   DATABASE_URL=… npx tsx deploy/erp-remediate-salary-account.ts --apply    # correct
 */
import { pgQuery, withTransaction } from '@/lib/db'
import { insertPostedEntry } from '@/lib/erp/glPosting'
import { assertPostable } from '@/lib/erp/accountingData'

const APPLY = process.argv.includes('--apply')

async function main() {
  const rent6100 = (await pgQuery<{ id: number }>(`SELECT id FROM gl_accounts WHERE code='6100' LIMIT 1`))[0]
  const salary6000 = (await pgQuery<{ id: number }>(`SELECT id FROM gl_accounts WHERE code='6000' LIMIT 1`))[0]
  if (!rent6100 || !salary6000) { console.error('6100 or 6000 account missing — run migrations first.'); process.exit(1) }

  const rows = await pgQuery<{ entry_id: number; entry_no: string; date: string; debit: number; credit: number }>(
    `SELECT l.entry_id, e.entry_no, e.date, l.debit::float AS debit, l.credit::float AS credit
     FROM gl_journal_lines l JOIN gl_journal_entries e ON e.id = l.entry_id
     WHERE l.account_id = $1 AND e.status = 'posted' AND e.reference LIKE 'payroll:%'
     ORDER BY e.date`, [rent6100.id])

  console.log(`Found ${rows.length} payroll-referenced posted line(s) on account 6100.\n`)
  if (rows.length === 0) { console.log('Nothing to remediate.'); process.exit(0) }

  let corrected = 0, blockedClosed = 0
  for (const r of rows) {
    const amount = r.debit - r.credit // payroll always debits this account
    const gate = await assertPostable(r.date)
    const status = gate.ok ? 'open period — can correct' : `blocked: ${gate.error}`
    console.log(`  · Entry #${r.entry_id} (${r.entry_no}, ${r.date}): ${amount.toLocaleString()} on 6100 — ${status}`)
    if (!gate.ok) { blockedClosed++; continue }
    if (APPLY) {
      await withTransaction(query => insertPostedEntry(
        query, r.date, `ERPFIX-1 correction: payroll posted to Rent Expense (6100) instead of Salaries Expense (6000), entry #${r.entry_id}`,
        `erpfix1-coa-correction:${r.entry_id}`, Math.abs(amount), undefined,
        [{ accountId: salary6000.id, debit: Math.max(amount, 0), credit: Math.max(-amount, 0) },
         { accountId: rent6100.id, debit: Math.max(-amount, 0), credit: Math.max(amount, 0) }]))
      corrected++
    }
  }

  console.log(`\n${APPLY ? 'Applied' : 'Would apply'}: ${corrected} correction(s). Blocked by closed/locked period: ${blockedClosed}.`)
  if (!APPLY) console.log('Dry run only — nothing was written. Re-run with --apply to post the corrections above.')
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
