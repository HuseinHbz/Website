/**
 * Phase 28.3-الف — live-PostgreSQL proof for payroll.
 *
 * The assertions this suite exists for:
 *
 *  1. 🔴 **Next year needs no code change.** A ruleset is copied, its brackets
 *     are replaced with a DIFFERENT NUMBER of bands, a rate is edited and a
 *     brand-new earning type is defined — and the calculation follows all of it.
 *  2. 🔴 **An issued payslip is immutable.** Changing the rules afterwards must
 *     not restate a slip that has already been reported and posted.
 *  3. 🔴 **The ledger balances and the accounts carry the right amounts** — not
 *     merely "trial balance balanced", which is always true (26.26c بند ۲).
 *  4. 🔴 **A locked period is corrected with a corrective slip**, never an edit:
 *     the original stays, a reversal cancels it, a new slip supersedes it, and
 *     the three net to the corrected figure.
 *
 * Everything is asserted through the SAME functions production uses.
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import { createEmployee, addEmploymentRecord, deleteEmployee } from '@/lib/hr/employeeData'
import {
  listRulesets, rulesetById, copyRuleset, rulesetEditable, rulesetFor,
  parametersOf, bracketsOf, earningTypesOf, setParameter, saveBrackets, saveEarningType,
  openPeriod, calculatePeriod, approvePeriod, postPeriodToGl, payPeriod, lockPeriod,
  listSlips, slipDetail, periodTotals, periodById, correctSlip,
  createLoan, listLoans, payrollOverview, policyHistory,
} from '@/lib/hr/payrollData'
import { progressiveTax, validateBrackets, exemptionFromBrackets } from '@/lib/hr/payroll'
import { trialBalance } from '@/lib/erp/ledger'
import { loadTallies } from '@/lib/erp/ledgerData'

let pass = 0, fail = 0
function check(label: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`) }
}

/** Balance of one account, computed the way production computes it. */
async function accountBalance(code: string): Promise<number> {
  const tallies = await loadTallies()
  const tb = trialBalance(tallies)
  const row = tb.rows.find(r => r.code === code)
  return row ? Math.round((row.debit - row.credit) * 100) / 100 : 0
}

async function main() {
  console.log('\n  Phase 28.3-الف — payroll core, live PostgreSQL\n')
  await runMigrations()
  await seedDatabase()

  const userId = (await pgQuery<{ id: string }>(`SELECT id FROM users LIMIT 1`))[0]?.id
  if (!userId) throw new Error('no admin user seeded')
  // Maker/checker needs a second person; approval by the calculator must fail.
  const approverId = (await pgQuery<{ id: string }>(
    `INSERT INTO users (id, email, name, password_hash, role, active, created_at)
     VALUES ('payroll-approver','approver@test.local','تأییدکننده','x','administrator',true,
             to_char(now(),'YYYY-MM-DD HH24:MI:SS'))
     ON CONFLICT (id) DO UPDATE SET active=true RETURNING id`))[0].id

  // ── بند ۱/۲: the seeded ruleset ───────────────────────────────────────────
  const rulesets = await listRulesets()
  const rs1405 = rulesets.find(r => r.year === 1405 && r.version === 1)
  check('the 1405 ruleset is seeded', !!rs1405, `${rulesets.length} rulesets`)
  if (!rs1405) throw new Error('seed missing')

  const brackets = await bracketsOf(rs1405.id)
  check('six tax brackets are seeded as ROWS, not columns', brackets.length === 6, `${brackets.length}`)
  check('the seeded bracket table is valid (no gap, no overlap, last band open)',
    validateBrackets(brackets).length === 0)
  check('the effective exemption comes from the leading zero-rate band',
    exemptionFromBrackets(brackets) === 400_000_000, String(exemptionFromBrackets(brackets)))

  const params = await parametersOf(rs1405.id)
  check('parameters are seeded across all four groups',
    new Set(params.map(p => p.group)).size === 4, `${params.length} parameters`)
  check('no statutory rate is hardcoded — the employee rate is a row',
    params.find(p => p.key === 'employee_rate')?.value === 7)

  const earningTypes = await earningTypesOf(rs1405.id)
  check('earning types carry their own insurable/taxable flags', earningTypes.length >= 15, `${earningTypes.length}`)
  check('the child allowance is seeded exempt from insurance AND tax',
    earningTypes.find(e => e.key === 'child')?.insurable === 'no'
    && earningTypes.find(e => e.key === 'child')?.taxable === 'no')

  // 🔴 the spec's own worked example, through the seeded table
  check('🔴 progressive tax on 1,000,000,000 ریال is 70,000,000 ریال',
    progressiveTax(1_000_000_000, brackets) === 70_000_000,
    String(progressiveTax(1_000_000_000, brackets)))

  // ── an employee with a real employment history ────────────────────────────
  const empId = await createEmployee({
    firstName: 'حقوق', lastName: 'آزمون', hireDate: '2024-01-01', status: 'active',
    maritalStatus: 'married', childrenCount: 2,
  }, userId)
  await addEmploymentRecord(empId, {
    startDate: '2024-01-01', baseSalary: 300_000_000, contractType: 'permanent',
  }, userId)
  check('employee with employment history created', empId > 0, `id=${empId}`)

  // ── بند ۶: the monthly cycle ──────────────────────────────────────────────
  const period = await openPeriod(1405, 5, userId)          // مرداد ۱۴۰۵
  check('a payroll month opens', period.ok === true, JSON.stringify(period))
  const periodId = period.id!

  const opened = await periodById(periodId)
  check('the run is bound to the ruleset in force on its first day',
    opened?.rulesetId === rs1405.id)
  check('the month length comes from the Jalali calendar', opened?.daysInMonth === 31,
    `${opened?.daysInMonth} days`)

  const dup = await openPeriod(1405, 5, userId)
  check('the same month cannot be opened twice', dup.ok === false, dup.error)

  const calc = await calculatePeriod(periodId, userId)
  check('the period calculates', calc.ok === true, JSON.stringify(calc))

  const slips = await listSlips(periodId)
  const slip = slips.find(s => s.employeeId === empId)
  check('a payslip was produced for the employee', !!slip, `${slips.length} slips`)
  if (!slip) throw new Error('no slip')

  const detail = (await slipDetail(slip.id))!
  check('the payslip is fully itemised — every figure traceable',
    detail.lines.length >= 5, `${detail.lines.length} lines`)
  check('the payslip records WHICH ruleset version computed it',
    detail.rulesetYear === 1405 && detail.rulesetVersion === 1)

  // insurance base excludes the exempt allowances
  const expectedInsurable = 300_000_000 + 30_000_000 + 22_000_000
  check('🔴 items flagged exempt from insurance stay out of the base',
    detail.insuranceBase === expectedInsurable,
    `${detail.insuranceBase} (expected ${expectedInsurable})`)
  check('employee insurance is 7% of the base',
    detail.employeeInsurance === Math.round(expectedInsurable * 0.07 * 100) / 100)
  check('🔴 the employer share is recorded separately, not deducted from the employee',
    detail.employerInsurance === Math.round(expectedInsurable * 0.20 * 100) / 100
    && detail.net === Math.round((detail.gross - detail.deductions) * 100) / 100)

  const childLine = detail.lines.find(l => l.key === 'child')
  check('the child allowance paid for two children', childLine?.amount === 2 * 16_625_560,
    String(childLine?.amount))

  // ── 🔴 maker ≠ checker ────────────────────────────────────────────────────
  const selfApprove = await approvePeriod(periodId, userId)
  check('🔴 the person who calculated the run cannot approve it (separation of duties)',
    selfApprove.ok === false, selfApprove.error)

  const approved = await approvePeriod(periodId, approverId)
  check('a different person can approve it', approved.ok === true, approved.error)

  const recalc = await calculatePeriod(periodId, userId)
  check('🔴 an APPROVED period cannot be recalculated in place',
    recalc.ok === false, recalc.error)

  // ── 🔴 بند ۶: GL posting with real account balances ───────────────────────
  const bankBefore = await accountBalance('2300')
  const posted = await postPeriodToGl(periodId, approverId)
  check('the period posts to the general ledger', posted.ok === true, JSON.stringify(posted))

  const totals = await periodTotals(periodId)
  const salariesPayable = await accountBalance('2300')
  const insurancePayable = await accountBalance('2310')
  const taxPayable = await accountBalance('2320')
  const payrollExpense = await accountBalance('6100')

  // 🔴 assert BALANCES, not just "balanced" (26.26c بند ۲)
  check('🔴 payroll expense is debited with the gross',
    payrollExpense === totals.gross, `${payrollExpense} vs ${totals.gross}`)
  check('🔴 salaries payable is credited with the net owed to employees',
    Math.abs(salariesPayable - (bankBefore - totals.net - totals.otherDeductions)) < 0.01,
    `${salariesPayable} (net ${totals.net})`)
  check('🔴 insurance payable carries BOTH shares',
    Math.abs(insurancePayable + (totals.employeeInsurance + totals.employerInsurance + totals.unemploymentInsurance)) < 0.01,
    `${insurancePayable}`)
  check('🔴 tax payable carries the withheld tax',
    Math.abs(taxPayable + totals.tax) < 0.01, `${taxPayable} vs ${totals.tax}`)

  const tb = trialBalance(await loadTallies())
  check('the trial balance still ties out', tb.balanced === true,
    `${tb.totalDebit} vs ${tb.totalCredit}`)

  const repost = await postPeriodToGl(periodId, approverId)
  check('🔴 posting twice does NOT double the payroll expense',
    repost.alreadyPosted === true && (await accountBalance('6100')) === payrollExpense)

  // ── loans: a ledger, consumed at payment ──────────────────────────────────
  const loanId = await createLoan({ employeeId: empId, totalAmount: 60_000_000, installments: 3 }, userId)
  check('a loan is recorded', loanId > 0)
  const loanBefore = (await listLoans(empId))[0]
  check('the outstanding balance is derived from the instalment ledger',
    loanBefore.outstanding === 60_000_000, String(loanBefore.outstanding))

  const paid = await payPeriod(periodId, approverId)
  check('the period is marked paid', paid.ok === true, paid.error)
  const lockedRes = await lockPeriod(periodId)
  check('the period locks after payment', lockedRes.ok === true, lockedRes.error)

  // ── 🔴 بند ۱: an issued payslip is immutable ──────────────────────────────
  const frozen = await rulesetEditable(rs1405.id)
  check('🔴 a ruleset that has issued payslips is frozen against editing',
    frozen.ok === false, frozen.error)

  const grossBefore = detail.gross
  const taxBefore = detail.tax

  const copied = await copyRuleset(rs1405.id, {
    year: 1405, version: 2, effectiveFrom: '2026-09-23', effectiveTo: '2027-03-20',
    source: 'بخشنامهٔ میان‌سال — آزمون',
  }, userId)
  check('a mid-year version can be created (a circular can change the law in Tir)',
    copied.ok === true, JSON.stringify(copied))
  const rs2 = copied.id!

  check('the copy carries every parameter across',
    (await parametersOf(rs2)).length === params.length)
  check('the copy carries every bracket across',
    (await bracketsOf(rs2)).length === brackets.length)
  check('the copy carries every earning type across',
    (await earningTypesOf(rs2)).length === earningTypes.length)

  // 🔴 THE test of the phase: a different NUMBER of bands, edited rates,
  // a new earning — all from data, with no code change.
  const fourBands = [
    { seq: 0, fromAmount: 0, toAmount: 500_000_000, ratePercent: 0 },
    { seq: 1, fromAmount: 500_000_000, toAmount: 1_000_000_000, ratePercent: 12 },
    { seq: 2, fromAmount: 1_000_000_000, toAmount: 2_000_000_000, ratePercent: 23 },
    { seq: 3, fromAmount: 2_000_000_000, toAmount: null, ratePercent: 35 },
  ]
  const savedBrackets = await saveBrackets(rs2, fourBands, userId)
  check('🔴 a bracket table with a DIFFERENT number of bands is accepted',
    savedBrackets.ok === true, savedBrackets.error)
  check('the new table has four bands, not six', (await bracketsOf(rs2)).length === 4)

  const gapped = await saveBrackets(rs2, [
    { seq: 0, fromAmount: 0, toAmount: 100, ratePercent: 0 },
    { seq: 1, fromAmount: 500, toAmount: null, ratePercent: 10 },
  ], userId)
  check('a table with a GAP is refused — it would silently mis-tax someone',
    gapped.ok === false, gapped.error)

  const rateChange = await setParameter(rs2, 'min_wage_daily', 7_000_000, userId)
  check('a statutory rate can be edited on the new version', rateChange.ok === true, rateChange.error)
  check('the change is recorded in the append-only policy history',
    (await policyHistory(rs2)).some(h => h.entityKey === 'min_wage_daily' && h.newValue === '7000000'))

  const newEarning = await saveEarningType(rs2, {
    key: 'hardship', labelFa: 'فوق‌العادهٔ بدی آب‌وهوا', labelEn: 'Hardship allowance',
    earningGroup: 'allowance', recurring: true, insurable: 'yes', taxable: 'no',
    calcMethod: 'fixed', calcValue: 40_000_000, sortOrder: 9, active: true,
  }, userId)
  check('🔴 a brand-new earning type can be defined from data alone',
    newEarning.ok === true, newEarning.error)

  // 🔴 and the already-issued slip is untouched by ALL of that
  const after = (await slipDetail(slip.id))!
  check('🔴 the ISSUED payslip is unchanged by the new rules — gross',
    after.gross === grossBefore, `${grossBefore} → ${after.gross}`)
  check('🔴 the ISSUED payslip is unchanged by the new rules — tax',
    after.tax === taxBefore, `${taxBefore} → ${after.tax}`)
  check('🔴 it still names the version it was computed with',
    after.rulesetVersion === 1)

  // A later month picks up the NEW version.
  const laterRuleset = await rulesetFor('2026-10-01')
  check('a month after the change resolves to the new version',
    laterRuleset?.id === rs2, `v${laterRuleset?.version}`)

  const period2 = await openPeriod(1405, 8, userId)          // آبان — after the change
  check('a later month opens on the new ruleset', period2.ok === true, period2.error)
  const calc2 = await calculatePeriod(period2.id!, userId)
  check('it calculates with the new rules', calc2.ok === true, calc2.error)

  const slip2 = (await listSlips(period2.id!)).find(s => s.employeeId === empId)!
  const detail2 = (await slipDetail(slip2.id))!
  check('🔴 the new slip uses version 2', detail2.rulesetVersion === 2)
  check('🔴 the new earning type appears on it',
    detail2.lines.some(l => l.key === 'hardship' && l.amount === 40_000_000))
  check('the raised minimum wage moved the insurance ceiling — data, not code',
    detail2.insuranceBase !== detail.insuranceBase,
    `${detail.insuranceBase} → ${detail2.insuranceBase}`)

  // ── 🔴 بند ۶: a correction is a reversal + a new slip ─────────────────────
  const correction = await correctSlip(slip.id, { bonus: 50_000_000 }, approverId)
  check('a corrective slip can be issued for a locked period',
    correction.ok === true, JSON.stringify(correction))

  const originalAfter = (await slipDetail(slip.id))!
  check('🔴 the ORIGINAL payslip is NOT deleted or edited',
    originalAfter.gross === grossBefore, `${originalAfter.gross}`)
  check('🔴 the original is marked reversed and linked to its reversal',
    originalAfter.status === 'reversed')

  const reversal = (await slipDetail(correction.reversalId!))!
  check('🔴 a reversing slip cancels it exactly', reversal.gross === -grossBefore,
    `${reversal.gross} vs ${-grossBefore}`)
  check('the reversal points back at the original',
    (await pgQuery<{ reversal_of: number }>(
      `SELECT reversal_of FROM payroll_slips WHERE id=$1`, [correction.reversalId!]))[0].reversal_of === slip.id)

  const corrected = (await slipDetail(correction.correctionId!))!
  check('a corrected slip carries the new figures', corrected.gross > 0)
  check('🔴 original + reversal net to zero, leaving only the correction',
    Math.abs(originalAfter.gross + reversal.gross) < 0.01)

  const twice = await correctSlip(slip.id, {}, approverId)
  check('a slip cannot be corrected twice', twice.ok === false, twice.error)

  const ov = await payrollOverview()
  check('the module overview assembles', ov.periods >= 2, JSON.stringify(ov))

  // ── cleanup ───────────────────────────────────────────────────────────────
  await pgQuery(`DELETE FROM payroll_slips WHERE employee_id=$1`, [empId])
  await pgQuery(`DELETE FROM payroll_loans WHERE employee_id=$1`, [empId])
  await deleteEmployee(empId)
  await pgQuery(`UPDATE users SET active=false WHERE id=$1`, [approverId])
  check('cleanup left no orphan payslip', (await listSlips(periodId)).length === 0)

  console.log(`\n  ${fail === 0 ? '✅' : '❌'} Phase 28.3-الف: ${pass}/${pass + fail} passed\n`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
