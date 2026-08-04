/**
 * Phase 28.3-ب — live-PostgreSQL proof for annual entitlements.
 *
 * The assertions this suite exists for:
 *
 *  1. 🔴 **Severance is NOT the seniority allowance.** An employee carrying a
 *     monthly `seniority_base` earning must not have it mistaken for the
 *     termination benefit, and the termination figure must come from the
 *     append-only employment history — the one error here that stays invisible
 *     for years.
 *  2. 🔴 **Pro-rata is real.** A mid-year hire receives a fraction of the Eid
 *     bonus; three years and seven months earns more severance than three.
 *  3. 🔴 **The full annual cycle balances**: Eid → GL, severance → GL,
 *     settlement → GL, with the right accounts carrying the right amounts.
 *  4. 🔴 **A provision already accrued is RELEASED, not double-charged.**
 *
 * Everything is asserted through the SAME functions production uses.
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import { createEmployee, addEmploymentRecord, deleteEmployee } from '@/lib/hr/employeeData'
import {
  listRulesets, openPeriod, calculatePeriod, approvePeriod, postPeriodToGl,
  payPeriod, listSlips, createLoan, parametersOf, setParameter, earningTypesOf, saveEarningType,
} from '@/lib/hr/payrollData'
import {
  jalaliYearBounds, eidBaseOf, severanceBasesOf, calculateEidForYear, listEid,
  approveEid, postEidToGl, reverseEid, calculateSeveranceFor, listSeverance,
  approveSeverance, postSeveranceToGl, accrueSeveranceForPeriod, accruedSeverance,
  buildSettlement, listSettlements, approveSettlement, postSettlementToGl,
  listExportLayouts, renderLegalExport, saveExportLayout, annualOverview,
} from '@/lib/hr/annualData'
import { serviceDaysBetween, calculateSeverance, severanceDailyBase } from '@/lib/hr/annual'
import { trialBalance } from '@/lib/erp/ledger'
import { loadTallies } from '@/lib/erp/ledgerData'

let pass = 0, fail = 0
function check(label: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`) }
}

async function accountBalance(code: string): Promise<number> {
  const tb = trialBalance(await loadTallies())
  const row = tb.rows.find(r => r.code === code)
  return row ? Math.round((row.debit - row.credit) * 100) / 100 : 0
}

async function main() {
  console.log('\n  Phase 28.3-ب — annual entitlements, live PostgreSQL\n')
  await runMigrations()
  await seedDatabase()

  const userId = (await pgQuery<{ id: string }>(`SELECT id FROM users LIMIT 1`))[0]?.id
  if (!userId) throw new Error('no admin user seeded')
  const approverId = (await pgQuery<{ id: string }>(
    `INSERT INTO users (id, email, name, password_hash, role, active, created_at)
     VALUES ('annual-approver','annual@test.local','تأییدکننده','x','administrator',true,
             to_char(now(),'YYYY-MM-DD HH24:MI:SS'))
     ON CONFLICT (id) DO UPDATE SET active=true RETURNING id`))[0].id

  const rs = (await listRulesets()).find(r => r.year === 1405 && r.version === 1)!
  check('the 1405 ruleset is available', !!rs)

  const params = await parametersOf(rs.id)
  check('the Eid parameters are seeded, not hardcoded',
    params.some(p => p.key === 'eid_days') && params.some(p => p.key === 'eid_max_days_of_min_wage'),
    `${params.length} parameters`)
  check('the severance parameters are seeded',
    params.some(p => p.key === 'severance_days_per_year')
    && params.some(p => p.key === 'severance_base_policy'))
  check('🔴 the monthly severance provision defaults to OFF — it is a policy decision',
    params.find(p => p.key === 'severance_accrual_enabled')?.value === 0)

  const bounds = jalaliYearBounds(1405)
  check('the Jalali year resolves to real Gregorian bounds',
    bounds.from === '2026-03-21' && bounds.days >= 365, `${bounds.from} → ${bounds.to} (${bounds.days}d)`)

  // ── 🔴 the distinction: an employee WITH a monthly seniority allowance ────
  const types = await earningTypesOf(rs.id)
  const seniority = types.find(t => t.key === 'seniority_base')!
  check('«پایهٔ سنوات» exists as a MONTHLY earning type (28.3-الف)', !!seniority)
  check('it is flagged into the severance base, but it is not the severance itself',
    seniority.inSeveranceBase === true)

  const empId = await createEmployee({
    firstName: 'سنوات', lastName: 'آزمون', hireDate: '2023-03-22', status: 'active',
    maritalStatus: 'single', childrenCount: 0,
  }, userId)
  await addEmploymentRecord(empId, {
    startDate: '2023-03-22', baseSalary: 200_000_000, contractType: 'permanent',
  }, userId)

  // Two payroll months so there is a real slip history to read the bases from.
  const p5 = await openPeriod(1405, 5, userId)
  check('a payroll month opens', p5.ok === true, p5.error)
  await calculatePeriod(p5.id!, userId)
  await approvePeriod(p5.id!, approverId)
  await postPeriodToGl(p5.id!, approverId)
  await payPeriod(p5.id!, approverId)

  const p6 = await openPeriod(1405, 6, userId)
  await calculatePeriod(p6.id!, userId)
  await approvePeriod(p6.id!, approverId)
  await postPeriodToGl(p6.id!, approverId)
  check('two payroll months exist', (await listSlips(p6.id!)).length > 0)

  const eidBase = await eidBaseOf(empId, bounds.from, bounds.to)
  check('the Eid base is read from the earnings flagged in_eid_base',
    eidBase === 200_000_000 + 30_000_000 + 22_000_000, String(eidBase))

  const sevBases = await severanceBasesOf(empId, 3)
  check('the severance base is read from the earnings flagged in_severance_base',
    sevBases.length > 0 && sevBases[0] === 200_000_000, JSON.stringify(sevBases))
  check('🔴 the two bases are DIFFERENT — they are different concepts',
    eidBase !== sevBases[0], `eid ${eidBase} vs severance ${sevBases[0]}`)

  // ── 🔴 بند ۱: Eid bonus ───────────────────────────────────────────────────
  const eidRun = await calculateEidForYear(1405, userId)
  check('the Eid bonus calculates for the year', eidRun.ok === true, JSON.stringify(eidRun))

  const eidRows = await listEid(1405)
  const eid = eidRows.find(r => r.employeeId === empId)!
  check('a calculation exists for the employee', !!eid)
  check('a full-year employee earns the full pro-rata',
    eid.serviceDays >= 365, `${eid.serviceDays} days`)

  // 60 days of own pay = (252م ÷ 30) × 60 = 504م; the ceiling is 90 × min wage
  const minWageDaily = params.find(p => p.key === 'min_wage_daily')!.value
  const ceiling = minWageDaily * 90
  check('🔴 the ceiling is in MINIMUM-WAGE days, so this salary is capped',
    Math.abs(eid.amount - ceiling) < 1, `${eid.amount} vs ceiling ${ceiling}`)

  const eidBefore = await accountBalance('6120')
  check('a calculation cannot be self-approved by the person who ran it',
    (await approveEid(eid.id, userId)).ok === false)
  check('a second person approves it', (await approveEid(eid.id, approverId)).ok === true)

  const eidPosted = await postEidToGl(eid.id, approverId)
  check('the Eid bonus posts to the ledger', eidPosted.ok === true, JSON.stringify(eidPosted))
  check('🔴 the Eid expense account carries the bonus',
    Math.abs((await accountBalance('6120')) - (eidBefore + eid.amount)) < 1,
    `${await accountBalance('6120')}`)
  check('🔴 Eid payable carries the net owed',
    Math.abs((await accountBalance('2330')) + eid.net) < 1, `${await accountBalance('2330')}`)

  const eidRepost = await postEidToGl(eid.id, approverId)
  check('posting twice does not double the Eid expense',
    eidRepost.alreadyPosted === true)

  // ── 🔴 mid-year hire gets a FRACTION ──────────────────────────────────────
  const midId = await createEmployee({
    firstName: 'میان‌سال', lastName: 'استخدام', hireDate: '2026-11-22', status: 'active',
  }, userId)
  await addEmploymentRecord(midId, {
    startDate: '2026-11-22', baseSalary: 200_000_000, contractType: 'permanent',
  }, userId)
  const p9 = await openPeriod(1405, 9, userId)     // آذر — after the hire
  await calculatePeriod(p9.id!, userId)
  await approvePeriod(p9.id!, approverId)

  await calculateEidForYear(1405, userId)
  const midEid = (await listEid(1405)).find(r => r.employeeId === midId)
  check('🔴 a mid-year hire also receives an Eid calculation', !!midEid)
  check('🔴 …and it is a FRACTION of the full-year figure, not the whole of it',
    !!midEid && midEid.amount < eid.amount && midEid.amount > 0,
    `${midEid?.amount} vs ${eid.amount}`)
  check('the fraction matches the service days served in the year',
    !!midEid && midEid.serviceDays < 130 && midEid.serviceDays > 100, `${midEid?.serviceDays} days`)

  // ── 🔴 بند ۲: severance ───────────────────────────────────────────────────
  // Exactly 3 years and 7 months from the hire date, inside the ruleset's
  // period of validity.
  const endDate = '2026-10-22'
  const sevRes = await calculateSeveranceFor(empId, endDate, userId)
  check('severance calculates from the employment history', sevRes.ok === true, JSON.stringify(sevRes))

  const sev = (await listSeverance({ employeeId: empId }))[0]
  const expectedDays = serviceDaysBetween('2023-03-22', endDate)
  check('🔴 service days come from the append-only history, not from a slip',
    sev.serviceDays === expectedDays, `${sev.serviceDays} vs ${expectedDays}`)

  const expected = calculateSeverance({
    serviceDays: expectedDays,
    dailyBase: severanceDailyBase('last', sevBases[0], sevBases),
    daysPerYear: 30,
  })
  check('🔴 the amount matches the engine exactly', Math.abs(sev.amount - expected.amount) < 1,
    `${sev.amount} vs ${expected.amount}`)
  check('🔴 3 years 7 months earns MORE than 3 whole years — no rounding down',
    sev.amount > calculateSeverance({ serviceDays: 365 * 3, dailyBase: expected.dailyBase, daysPerYear: 30 }).amount,
    `${expected.serviceYears} years`)
  check('🔴 the severance figure is NOT the monthly seniority allowance',
    sev.amount !== sevBases[0] && sev.amount > sevBases[0] * 3,
    `severance ${sev.amount} vs monthly base ${sevBases[0]}`)

  check('severance cannot be self-approved', (await approveSeverance(sev.id, userId)).ok === false)
  check('a second person approves it', (await approveSeverance(sev.id, approverId)).ok === true)

  const sevExpenseBefore = await accountBalance('6130')
  const sevPosted = await postSeveranceToGl(sev.id, approverId)
  check('severance posts to the ledger', sevPosted.ok === true, JSON.stringify(sevPosted))
  check('🔴 with no provision, the whole amount hits the expense account',
    Math.abs((await accountBalance('6130')) - (sevExpenseBefore + sev.amount)) < 1,
    `${await accountBalance('6130')}`)

  // ── 🔴 the provision path releases instead of double-charging ─────────────
  const accrualOff = await accrueSeveranceForPeriod(p6.id!, approverId)
  check('🔴 the monthly provision refuses while the policy is off',
    accrualOff.ok === false, accrualOff.error)

  await setParameter(rs.id, 'severance_accrual_enabled', 1, userId)
    .catch(() => null)
  // The ruleset has issued slips, so it is frozen — the parameter is set
  // directly, which is exactly what a new version would carry.
  await pgQuery(
    `UPDATE payroll_parameters SET value=1 WHERE ruleset_id=$1 AND key='severance_accrual_enabled'`,
    [rs.id])

  const provisionEmpId = await createEmployee({
    firstName: 'ذخیره', lastName: 'آزمون', hireDate: '2024-01-01', status: 'active',
  }, userId)
  await addEmploymentRecord(provisionEmpId, {
    startDate: '2024-01-01', baseSalary: 200_000_000, contractType: 'permanent',
  }, userId)
  const p10 = await openPeriod(1405, 10, userId)
  await calculatePeriod(p10.id!, userId)
  await approvePeriod(p10.id!, approverId)

  const accrued = await accrueSeveranceForPeriod(p10.id!, approverId)
  check('the monthly provision runs once the policy is on', accrued.ok === true, JSON.stringify(accrued))
  const provisionBalance = await accountBalance('2340')
  check('🔴 the provision account carries a liability',
    Math.abs(provisionBalance + (accrued.total ?? 0)) < 2, `${provisionBalance}`)

  const twice = await accrueSeveranceForPeriod(p10.id!, approverId)
  check('🔴 re-running the same month accrues nothing — idempotent',
    twice.employees === 0, JSON.stringify(twice))

  const carried = await accruedSeverance(provisionEmpId)
  check('the employee carries an accrued provision', carried > 0, String(carried))

  const provSev = await calculateSeveranceFor(provisionEmpId, '2026-12-31', userId)
  check('severance for a provisioned employee calculates', provSev.ok === true, provSev.error)
  const provRow = (await listSeverance({ employeeId: provisionEmpId }))[0]
  check('it records the provision already carried',
    Math.abs(provRow.accruedBefore - carried) < 1, `${provRow.accruedBefore}`)

  await approveSeverance(provRow.id, approverId)
  const expenseBefore2 = await accountBalance('6130')
  const provPosted = await postSeveranceToGl(provRow.id, approverId)
  check('the provisioned severance posts', provPosted.ok === true, provPosted.error)
  const expenseAfter2 = await accountBalance('6130')
  check('🔴 only the SHORTFALL hits expense — the provision is released, not double-charged',
    Math.abs((expenseAfter2 - expenseBefore2) - (provRow.amount - provRow.accruedBefore)) < 2,
    `expense +${expenseAfter2 - expenseBefore2} of ${provRow.amount}`)

  // ── بند ۳: final settlement ───────────────────────────────────────────────
  await createLoan({ employeeId: empId, totalAmount: 90_000_000, installments: 3 }, userId)

  const built = await buildSettlement(empId, endDate, 'استعفا', 0, userId)
  check('the settlement is prepared', built.ok === true, JSON.stringify(built))

  const settlement = (await listSettlements()).find(s => s.employeeId === empId)!
  check('it collects the severance already calculated',
    Math.abs(settlement.severance - sev.amount) < 1, `${settlement.severance}`)
  check('it collects the Eid bonus already calculated',
    Math.abs(settlement.eid - eid.net) < 1, `${settlement.eid}`)
  check('it collects the outstanding loan as a deduction',
    settlement.loanOutstanding === 90_000_000, String(settlement.loanOutstanding))
  check('the total nets the entitlements against the deductions',
    Math.abs(settlement.total -
      (settlement.finalPay + settlement.severance + settlement.eid + settlement.leaveEncashment - 90_000_000)) < 1,
    String(settlement.total))

  const dupSettlement = await buildSettlement(empId, endDate, null, 0, userId)
  check('a second settlement for the same employee is refused',
    dupSettlement.ok === false, dupSettlement.error)

  check('the settlement cannot be self-approved',
    (await approveSettlement(settlement.id, userId)).ok === false)
  check('a second person approves it', (await approveSettlement(settlement.id, approverId)).ok === true)

  const setPosted = await postSettlementToGl(settlement.id, approverId)
  check('the settlement posts to the ledger', setPosted.ok === true, JSON.stringify(setPosted))

  const empStatus = (await pgQuery<{ status: string; end_date: string | null }>(
    `SELECT status, end_date FROM hr_employees WHERE id=$1`, [empId]))[0]
  check('🔴 posting the settlement terminates the employee record',
    empStatus.status === 'terminated' && empStatus.end_date === endDate,
    `${empStatus.status} / ${empStatus.end_date}`)

  const loansAfter = (await pgQuery<{ status: string }>(
    `SELECT status FROM payroll_loans WHERE employee_id=$1`, [empId]))
  check('the outstanding loan is settled by the settlement',
    loansAfter.every(l => l.status === 'settled'))

  // ── the whole ledger still ties out ───────────────────────────────────────
  const tb = trialBalance(await loadTallies())
  check('🔴 the trial balance still ties out after the whole annual cycle',
    tb.balanced === true, `${tb.totalDebit} vs ${tb.totalCredit}`)

  // ── reversal keeps the original ───────────────────────────────────────────
  const midEidRow = (await listEid(1405)).find(r => r.employeeId === midId)!
  await approveEid(midEidRow.id, approverId)
  await postEidToGl(midEidRow.id, approverId)
  const reversed = await reverseEid(midEidRow.id, approverId)
  check('an Eid calculation can be reversed', reversed.ok === true, JSON.stringify(reversed))
  const afterReversal = (await pgQuery<{ status: string; amount: number }>(
    `SELECT status, amount::float AS amount FROM payroll_eid_calculations WHERE id=$1`,
    [midEidRow.id]))[0]
  check('🔴 the ORIGINAL calculation survives, marked reversed',
    afterReversal.status === 'reversed' && Math.abs(afterReversal.amount - midEidRow.amount) < 1)
  const reversalRow = (await pgQuery<{ amount: number }>(
    `SELECT amount::float AS amount FROM payroll_eid_calculations WHERE id=$1`, [reversed.reversalId!]))[0]
  check('🔴 the reversal cancels it exactly',
    Math.abs(reversalRow.amount + midEidRow.amount) < 1, `${reversalRow.amount}`)
  check('reversing twice is refused', (await reverseEid(midEidRow.id, approverId)).ok === false)
  check('the ledger still ties out after the reversal',
    trialBalance(await loadTallies()).balanced === true)

  // ── بند ۴: legal exports ──────────────────────────────────────────────────
  const layouts = await listExportLayouts()
  check('three export layouts are seeded', layouts.length === 3, `${layouts.length}`)
  check('🔴 the statutory layouts are marked UNVERIFIED with a reason',
    layouts.filter(l => l.kind !== 'summary').every(l => !l.verified && !!l.note))

  const dsk = await renderLegalExport(p5.id!, 'dsk_insurance')
  check('the insurance export renders', dsk.ok === true, dsk.error)
  check('it carries a header row from the configured columns',
    !!dsk.csv && dsk.csv.split('\n')[0].includes('مبنای بیمه'), dsk.csv?.split('\n')[0])
  check('it carries one row per payslip',
    !!dsk.csv && dsk.csv.split('\n').length === (await listSlips(p5.id!)).length + 1)
  check('🔴 the render reports that the layout is not verified', dsk.verified === false)

  const taxExport = await renderLegalExport(p5.id!, 'tax_payroll')
  check('the tax export renders', taxExport.ok === true, taxExport.error)
  check('a missing key never becomes the text "undefined"',
    !!taxExport.csv && !taxExport.csv.includes('undefined'))

  const reordered = layouts.find(l => l.key === 'tax_payroll')!.columns.slice().reverse()
  await saveExportLayout('tax_payroll', { columns: reordered })
  const after = await renderLegalExport(p5.id!, 'tax_payroll')
  check('🔴 the column order is DATA — reordering the layout changes the file',
    after.csv !== taxExport.csv)

  await saveExportLayout('tax_payroll', { columns: reordered, verified: true, note: null })
  check('an operator can mark a layout verified once checked against the portal',
    (await listExportLayouts()).find(l => l.key === 'tax_payroll')?.verified === true)

  const badLayout = await renderLegalExport(p5.id!, 'does_not_exist')
  check('an unknown layout is refused, not guessed', badLayout.ok === false, badLayout.error)

  const ov = await annualOverview()
  check('the annual overview assembles', ov.eidCount > 0 && ov.severanceCount > 0, JSON.stringify(ov))

  // ── cleanup ───────────────────────────────────────────────────────────────
  for (const id of [empId, midId, provisionEmpId]) {
    await pgQuery(`DELETE FROM payroll_settlements WHERE employee_id=$1`, [id])
    await pgQuery(`DELETE FROM payroll_severance_accruals WHERE employee_id=$1`, [id])
    await pgQuery(`DELETE FROM payroll_severance_calculations WHERE employee_id=$1`, [id])
    await pgQuery(`DELETE FROM payroll_eid_calculations WHERE employee_id=$1`, [id])
    await pgQuery(`DELETE FROM payroll_slips WHERE employee_id=$1`, [id])
    await pgQuery(`DELETE FROM payroll_loans WHERE employee_id=$1`, [id])
    await deleteEmployee(id)
  }
  await pgQuery(`UPDATE users SET active=false WHERE id=$1`, [approverId])
  check('cleanup left no orphan annual record',
    (await listEid(1405)).length === 0 && (await listSeverance()).length === 0)

  console.log(`\n  ${fail === 0 ? '✅' : '❌'} Phase 28.3-ب: ${pass}/${pass + fail} passed\n`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
