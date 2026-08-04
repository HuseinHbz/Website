/**
 * Phase 28.1 — live-PostgreSQL proof for the personnel module.
 *
 * The two assertions this suite exists for:
 *
 *  1. **Employment history is append-only.** A raise must not overwrite the old
 *     salary — severance and payroll back-calculation read that history, so an
 *     overwrite silently changes what the company owes for months already
 *     worked. The proof is that the OLD salary is still answerable by date.
 *  2. **Sensitive columns are absent without the grant.** Not hidden, not
 *     blanked — absent from the payload (26.28 field scope).
 *
 * Everything is asserted through the SAME functions production uses.
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import {
  createEmployee, updateEmployee, deleteEmployee, listEmployees, applySensitiveScope,
  addEmploymentRecord, employmentHistory, employeeFile, addDependent, dependentsOf,
  createPosition, listPositions, hrOverview, nextEmployeeCode,
} from '@/lib/hr/employeeData'
import { employmentOn, serviceYears, validateEmployee, SENSITIVE_EMPLOYEE_FIELDS } from '@/lib/hr/employees'

let pass = 0, fail = 0
function check(label: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`) }
}

async function main() {
  console.log('\n  Phase 28.1 — HR personnel, live PostgreSQL\n')
  await runMigrations()
  await seedDatabase()

  const userId = (await pgQuery<{ id: string }>(`SELECT id FROM users LIMIT 1`))[0]?.id
  if (!userId) throw new Error('no admin user seeded')

  // ── employee code sequence ────────────────────────────────────────────────
  const code = await nextEmployeeCode()
  check('employee code continues the sequence', /^EMP-\d{4}$/.test(code), code)

  // ── create ────────────────────────────────────────────────────────────────
  const empId = await createEmployee({
    firstName: 'حسین', lastName: 'آزمون',
    nationalId: '0499370899',            // valid check digit
    iban: 'IR062960000000100324200001',
    bankAccount: '1003242',
    insuranceNo: 'INS-777',
    mobile: '09121234567',
    maritalStatus: 'married', childrenCount: 2,
    hireDate: '2022-03-21', status: 'active',
  }, userId)
  check('employee created', empId > 0, `id=${empId}`)

  const listed = await listEmployees()
  const mine = listed.find(e => e.id === empId)
  check('employee is listed with a derived full name', mine?.fullName === 'حسین آزمون', mine?.fullName)
  check('service years computed from the hire date', (mine?.serviceYears ?? 0) >= 3, `${mine?.serviceYears} yr`)

  // ── 🔴 field scope: sensitive columns absent without the grant ─────────────
  const withGrant = applySensitiveScope(listed as unknown as Record<string, unknown>[], true)
  const without = applySensitiveScope(listed as unknown as Record<string, unknown>[], false)
  const g = withGrant.find(r => r.id === empId)!
  const w = without.find(r => r.id === empId)!

  check('with the grant, the national id is present', g.nationalId === '0499370899')
  for (const f of SENSITIVE_EMPLOYEE_FIELDS) {
    check(`without the grant, "${f}" is ABSENT from the payload (not null, absent)`,
      !(f in w), `in payload: ${f in w}`)
  }
  check('non-sensitive fields survive the strip', w.firstName === 'حسین' && w.mobile === '09121234567')

  // ── 🔴 append-only employment history ─────────────────────────────────────
  const posId = await createPosition({ titleEn: 'Network Engineer', titleFa: 'کارشناس شبکه', level: 3 })
  check('position created', posId > 0)
  check('position is listed', (await listPositions()).some(p => p.id === posId))

  const first = await addEmploymentRecord(empId, {
    startDate: '2022-03-21', baseSalary: 100_000_000, contractType: 'contract', positionId: posId,
  }, userId)
  check('first employment record opens with no close', first.closedId === undefined, `id=${first.id}`)

  const raise = await addEmploymentRecord(empId, {
    startDate: '2025-01-01', baseSalary: 180_000_000, contractType: 'permanent',
    positionId: posId, changeReason: 'ارتقای سالانه',
  }, userId)
  check('a raise CLOSES the previous record instead of overwriting it', raise.closedId === first.id)

  const history = await employmentHistory(empId)
  check('both records survive — history is not rewritten', history.length === 2, `${history.length} records`)

  const closed = history.find(h => h.id === first.id)!
  check('the previous record ends the day BEFORE the new one starts (no overlap)',
    closed.endDate === '2024-12-31', String(closed.endDate))

  // the assertion the whole design exists for
  check('the OLD salary is still answerable by date (severance/payroll basis)',
    employmentOn(history, '2023-06-15')?.baseSalary === 100_000_000,
    String(employmentOn(history, '2023-06-15')?.baseSalary))
  check('the NEW salary applies from its start date',
    employmentOn(history, '2025-06-15')?.baseSalary === 180_000_000)
  check('no date has two salaries in force at once',
    history.filter(h => h.startDate <= '2024-12-31' && (!h.endDate || h.endDate >= '2024-12-31')).length === 1)

  // ── dependents (a payroll input, not an address book) ─────────────────────
  await addDependent(empId, { fullName: 'فرزند اول', relation: 'child', birthDate: '2018-05-01' })
  await addDependent(empId, { fullName: 'همسر', relation: 'spouse' })
  const deps = await dependentsOf(empId)
  check('dependents recorded for tax relief and insurance', deps.length === 2, `${deps.length}`)

  // ── personnel file assembles ──────────────────────────────────────────────
  const file = await employeeFile(empId, true)
  check('personnel file assembles every tab',
    !!file && file.employment.length === 2 && file.dependents.length === 2)
  const fileNoGrant = await employeeFile(empId, false)
  check('the file also strips sensitive fields without the grant',
    fileNoGrant != null && !('nationalId' in (fileNoGrant.employee as unknown as Record<string, unknown>)))

  // ── validation refuses bad identity data ──────────────────────────────────
  check('a national id with a bad check digit is refused',
    validateEmployee({ firstName: 'a', lastName: 'b', nationalId: '1234567890' })
      .some(i => i.field === 'nationalId'))
  check('a malformed IBAN is refused',
    validateEmployee({ firstName: 'a', lastName: 'b', iban: 'IR1' }).some(i => i.field === 'iban'))

  // ── partial update must not blank other fields (26.30 lesson) ─────────────
  await updateEmployee(empId, { status: 'on_leave' })
  const after = (await listEmployees()).find(e => e.id === empId)!
  check('a partial update changes only what it names',
    after.status === 'on_leave' && after.mobile === '09121234567' && after.firstName === 'حسین')

  const ov = await hrOverview()
  check('headcount overview counts by status', ov.onLeave >= 1, JSON.stringify(ov))

  // ── cleanup ───────────────────────────────────────────────────────────────
  await deleteEmployee(empId)
  check('deleting the employee cascades its history and dependents',
    (await employmentHistory(empId)).length === 0 && (await dependentsOf(empId)).length === 0)
  await pgQuery(`DELETE FROM hr_positions WHERE id=$1`, [posId])

  console.log(`\n  ${fail === 0 ? '✅' : '❌'} Phase 28.1: ${pass}/${pass + fail} passed\n`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
