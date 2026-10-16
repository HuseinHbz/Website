/**
 * ERPFIX-1 (BUG-ERP-10) — reclassify salaries that were posted to 6100
 * «Rent Expense» before the fix onto the payroll-expense account
 * (erp_settings.gl_map_payroll_expense, default 6000 «Salaries Expense»).
 *
 * SAFETY:
 *   • DRY-RUN by default — lists every affected entry and the plan; writes nothing.
 *   • Real writes need BOTH `--apply` AND `--confirm`, and must only be run
 *     after the ACCOUNTANT has reviewed the dry-run output.
 *   • A posted entry is NEVER edited or voided: one NEW corrective entry
 *     (Dr salaries / Cr 6100) per OPEN fiscal period, through the single GL
 *     entry point (period gate, balance check, Numbering Engine).
 *   • Entries in a closed/locked period are REPORTED only.
 *   • Idempotent — every corrected source entry is linked in
 *     gl_remediation_links; a second run finds nothing to do.
 *   • Proof uses the production loadTallies/trialBalance.
 *
 * Usage (from the repo root, as the app user):
 *   DATABASE_URL=… npx tsx deploy/erp-remediate-salary-account.ts                     # dry-run
 *   DATABASE_URL=… npx tsx deploy/erp-remediate-salary-account.ts --apply --confirm
 */
import { remediateSalaryOnRent } from '@/lib/erp/coaRemediation'
import { loadTallies } from '@/lib/erp/ledgerData'
import { trialBalance } from '@/lib/erp/ledger'
import { logAction } from '@/lib/admin/audit'

const APPLY = process.argv.includes('--apply') && process.argv.includes('--confirm')

async function balances(codes: string[]) {
  const tb = trialBalance(await loadTallies())
  return Object.fromEntries(codes.map(c => {
    const r = tb.rows.find(x => x.code === c)
    return [c, r ? Math.round((r.debit - r.credit) * 100) / 100 : 0]
  }))
}

async function main() {
  console.log(`\n  ERPFIX-1 salary-on-rent remediation — ${APPLY ? 'APPLY' : 'DRY-RUN (pass --apply --confirm to write)'}\n`)
  if (process.argv.includes('--apply') && !process.argv.includes('--confirm')) console.log('  --apply without --confirm → staying in dry-run.\n')
  const dry = await remediateSalaryOnRent({ apply: false })
  const before = await balances([dry.payrollCode, '6100'])
  console.log(`  payroll-expense account: ${dry.payrollCode}`)
  for (const g of dry.groups) {
    console.log(`  · period ${g.periodName ?? '(none)'} [${g.periodStatus ?? 'ungoverned'}] company ${g.companyId ?? 'default'} — ${g.action === 'correct' ? 'CORRECT' : 'REPORT ONLY'} ${g.amount.toLocaleString('en-US')}`)
    for (const e of g.entries) console.log(`      ${e.entryNo}  ${e.date}  ${e.source.padEnd(16)} ${e.reference ?? ''}  ${e.amount.toLocaleString('en-US')}`)
  }
  if (!dry.groups.length) console.log('  nothing to do.')
  console.log(`\n  balances BEFORE: ${JSON.stringify(before)}`)
  if (!APPLY) { console.log(''); process.exit(0) }

  const r = await remediateSalaryOnRent({ apply: true })
  await logAction(null, 'erpfix1.salary_remediation', 'gl_journal_entries', '', { posted: r.posted })
  const after = await balances([r.payrollCode, '6100'])
  const tb = trialBalance(await loadTallies())
  for (const p of r.posted) console.log(`  ✔ ${p.entryNo} (#${p.entryId}) reclassified ${p.amount.toLocaleString('en-US')} from ${p.sources.length} source entr(ies)`)
  console.log(`  balances AFTER:  ${JSON.stringify(after)}`)
  console.log(`  trial balance balanced: ${tb.balanced}\n`)
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
