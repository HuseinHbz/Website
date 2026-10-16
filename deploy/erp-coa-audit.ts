/**
 * ERPFIX-1 (BUG-ERP-10) — READ-ONLY chart-of-accounts audit. Changes nothing.
 *
 *  1. Codes the migrations seed twice with a different name/type (the 6100
 *     «Rent Expense» vs «Salaries» class), parsed from src/lib/db/migrate.ts.
 *  2. Live gl_accounts rows that disagree with src/lib/erp/coaContract.ts
 *     (an operator rename, or an install seeded by an older release).
 *  3. Everything posted on 6100, split by origin (payroll / settlement /
 *     treasury salary payment / rent+manual), plus the salary entries that
 *     erp-remediate-salary-account.ts would correct.
 *
 * Usage (from the repo root, as the app user):
 *   DATABASE_URL=… npx tsx deploy/erp-coa-audit.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pgQuery } from '@/lib/db'
import { parseGlAccountSeeds, seedConflicts } from '@/lib/erp/coaAudit'
import { COA_CONTRACT } from '@/lib/erp/coaContract'
import { rentAccountSurvey, salaryOnRentEntries, planRemediation } from '@/lib/erp/coaRemediation'
import { loadPayrollExpenseCode } from '@/lib/erp/glPosting'

async function main() {
  console.log('\n  ERPFIX-1 chart-of-accounts audit (read-only)\n')
  const conflicts = seedConflicts(parseGlAccountSeeds(readFileSync(join(process.cwd(), 'src/lib/db/migrate.ts'), 'utf8')))
  console.log(`  1) seed conflicts in migrate.ts: ${conflicts.length}`)
  for (const c of conflicts) console.log(`     ✗ ${c.code}: ${c.rows.map(r => `«${r.nameEn}» ${r.type}`).join(' vs ')}`)

  const live = await pgQuery<{ code: string; name_en: string; type: string }>(`SELECT code, name_en, type FROM gl_accounts WHERE code = ANY($1)`, [Object.keys(COA_CONTRACT)])
  const liveBy = new Map(live.map(l => [l.code, l]))
  const drift = Object.entries(COA_CONTRACT).filter(([code, c]) => {
    const l = liveBy.get(code)
    return !l || l.type !== c.type || l.name_en.toLowerCase() !== c.nameEn.toLowerCase()
  })
  console.log(`  2) live gl_accounts vs coaContract.ts: ${drift.length} mismatch(es)`)
  for (const [code, c] of drift) {
    const l = liveBy.get(code)
    console.log(`     ✗ ${code}: contract ${c.type} «${c.nameEn}» — live ${l ? `${l.type} «${l.name_en}»` : 'MISSING'}`)
  }

  const payroll = await loadPayrollExpenseCode()
  const survey = await rentAccountSurvey()
  console.log(`  3) account 6100 = ${survey.account ? `${survey.account.type} «${survey.account.nameEn}»` : 'missing'}; gl_map_payroll_expense = ${payroll}`)
  if (payroll === '6100' && survey.account && /rent/i.test(survey.account.nameEn)) console.log('     ✗ salaries are still mapped to 6100 «Rent Expense» — the ERPFIX-1 migration fixes this map on the next boot')
  for (const o of survey.byOrigin) console.log(`     · ${o.origin.padEnd(32)} ${String(o.entries).padStart(5)} entries   net ${o.net.toLocaleString('en-US')}`)

  const rows = await salaryOnRentEntries()
  const plan = planRemediation(rows)
  console.log(`\n  Salary entries on 6100 not yet remediated: ${rows.length}`)
  for (const g of plan) {
    console.log(`     period ${g.periodName ?? '(none)'} [${g.periodStatus ?? 'ungoverned'}] company ${g.companyId ?? 'default'}: ${g.entries.length} entr(ies), ${g.amount.toLocaleString('en-US')} → ${g.action === 'correct' ? 'would be corrected' : 'REPORT ONLY (period not open)'}`)
  }
  console.log('')
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
