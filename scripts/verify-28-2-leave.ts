/**
 * Phase 28.2 — live-PostgreSQL proof for leave, attendance and missions.
 *
 * The four assertions this suite exists for:
 *
 *  1. **Working days are computed from the editable calendar.** A holiday
 *     inside a range must reduce the days consumed — otherwise employees pay
 *     balance for days the country was closed.
 *  2. **Accrual is idempotent per month.** A retried job must not inflate
 *     everyone's balance.
 *  3. **Approval is when the balance moves.** A pending request must not lock
 *     days that may never be taken.
 *  4. 🔴 **Cancelling an approved leave posts a REVERSAL.** The original `use`
 *     row stays and a compensating row returns the days, exactly like a
 *     reversing GL entry (26.26b BUG-020) — the balance comes back AND the
 *     history still explains itself.
 *
 * Everything is asserted through the SAME functions production uses.
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import { createEmployee, deleteEmployee } from '@/lib/hr/employeeData'
import {
  listLeaveTypes, calendarContext, addHoliday, deleteHoliday, listHolidays,
  leaveBalances, leaveLedger, accrueMonthly, postLeaveTransaction,
  createLeaveRequest, approveLeave, rejectLeave, cancelLeave, listLeaveRequests,
  recordAttendance, addOvertime, approveOvertime, monthlyTimesheet,
  createMission, listMissions, leaveOverview,
} from '@/lib/hr/leaveData'
import { workingDaysBetween, iranianWeekday, overtimeValue, OVERTIME_MULTIPLIERS } from '@/lib/hr/leave'

let pass = 0, fail = 0
function check(label: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`) }
}

async function main() {
  console.log('\n  Phase 28.2 — HR leave & attendance, live PostgreSQL\n')
  await runMigrations()
  await seedDatabase()

  const userId = (await pgQuery<{ id: string }>(`SELECT id FROM users LIMIT 1`))[0]?.id
  if (!userId) throw new Error('no admin user seeded')

  // ── leave types are seeded data, not code ─────────────────────────────────
  const types = await listLeaveTypes()
  check('leave types are seeded and readable', types.length >= 4, `${types.length} types`)
  const annual = types.find(t => t.code === 'annual')!
  const sick = types.find(t => t.code === 'sick')!
  check('annual leave accrues 2.5 days per month (قانون کار) and is configurable',
    annual.accrualPerMonth === 2.5, String(annual.accrualPerMonth))
  check('sick leave does not consume the annual balance', sick.deductsBalance === false)

  const empId = await createEmployee({
    firstName: 'مرخصی', lastName: 'آزمون',
    hireDate: '2025-01-01', status: 'active',
  }, userId)
  check('test employee created', empId > 0, `id=${empId}`)

  // ── 🔴 the calendar is EDITABLE data ──────────────────────────────────────
  // 2026-08-01 is a Saturday — the start of the Iranian week.
  check('Saturday indexes as day 0 of the Iranian week', iranianWeekday('2026-08-01') === 0)
  check('Friday indexes as day 6 — the weekly rest day', iranianWeekday('2026-08-07') === 6)

  const ctxBefore = await calendarContext('2026-08-01', '2026-08-05')
  const daysBefore = workingDaysBetween('2026-08-01', '2026-08-05', ctxBefore)
  check('a Sat–Wed week is five working days before any holiday', daysBefore === 5, String(daysBefore))

  const holId = await addHoliday({ date: '2026-08-03', titleFa: 'تعطیلی آزمایشی', kind: 'public' })
  check('a holiday can be added at runtime (they move every year)', holId > 0)
  check('the holiday is listed for its year',
    (await listHolidays('2026')).some(h => h.id === holId))

  const ctxAfter = await calendarContext('2026-08-01', '2026-08-05')
  const daysAfter = workingDaysBetween('2026-08-01', '2026-08-05', ctxAfter)
  check('adding a holiday REDUCES the working days in that range — no hardcoded list',
    daysAfter === 4, `${daysBefore} → ${daysAfter}`)

  // ── 🔴 accrual is idempotent per month ────────────────────────────────────
  const a1 = await accrueMonthly('2026-07', userId)
  const balAfter1 = (await leaveBalances(empId)).find(b => b.type.id === annual.id)!.balance
  const a2 = await accrueMonthly('2026-07', userId)
  const balAfter2 = (await leaveBalances(empId)).find(b => b.type.id === annual.id)!.balance
  check('the first accrual run grants days', a1.employees > 0 && balAfter1 >= 2.5, `${balAfter1} days`)
  check('re-running the SAME month grants nothing — a retried job cannot inflate balances',
    a2.employees === 0 && balAfter2 === balAfter1, `${balAfter1} → ${balAfter2}`)

  // Top the balance up so the request below is comfortably affordable.
  await postLeaveTransaction(empId, annual.id, 'adjust', 20,
    { note: 'test opening balance', userId })
  const opening = (await leaveBalances(empId)).find(b => b.type.id === annual.id)!.balance
  check('a manual correction is an ADJUSTMENT ROW, not an edited balance',
    opening === balAfter1 + 20, String(opening))

  // ── 🔴 approval is when the balance moves ─────────────────────────────────
  const req = await createLeaveRequest({
    employeeId: empId, leaveTypeId: annual.id,
    startDate: '2026-08-01', endDate: '2026-08-05', reason: 'سفر',
  }, userId)
  check('the request is accepted', req.ok === true, JSON.stringify(req))
  check('🔴 days are computed SERVER-SIDE from the calendar — the holiday is excluded',
    req.days === 4, `${req.days} days`)

  const status0 = (await pgQuery<{ status: string }>(
    `SELECT status FROM hr_leave_requests WHERE id=$1`, [req.id!]))[0]?.status
  const balPending = (await leaveBalances(empId)).find(b => b.type.id === annual.id)!.balance
  if (status0 === 'pending') {
    check('a PENDING request does not lock days that may never be taken',
      balPending === opening, `${opening} → ${balPending}`)
  } else {
    check('the approval matrix auto-approved the request (no rule configured)', status0 === 'approved', status0)
  }

  await approveLeave(req.id!, userId)
  const balApproved = (await leaveBalances(empId)).find(b => b.type.id === annual.id)!.balance
  check('🔴 approval DEBITS exactly the working days requested',
    balApproved === opening - 4, `${opening} → ${balApproved}`)

  check('approving twice is idempotent — the days are not debited again',
    (await approveLeave(req.id!, userId)).ok === true
    && (await leaveBalances(empId)).find(b => b.type.id === annual.id)!.balance === balApproved)

  // ── 🔴 cancellation posts a REVERSAL (the reason balance is a ledger) ─────
  const cancelled = await cancelLeave(req.id!, userId)
  check('cancelling an approved leave succeeds', cancelled.ok === true, JSON.stringify(cancelled))
  check('it reports the days it returned', cancelled.returned === 4, String(cancelled.returned))

  const balCancelled = (await leaveBalances(empId)).find(b => b.type.id === annual.id)!.balance
  check('🔴 the balance is back to what it was before the leave',
    balCancelled === opening, `${balApproved} → ${balCancelled} (expected ${opening})`)

  const ledger = await leaveLedger(empId, annual.id)
  const uses = ledger.filter(t => t.kind === 'use')
  const reversals = ledger.filter(t => t.kind === 'reversal')
  check('🔴 the ORIGINAL use row survives — history is not rewritten', uses.length === 1, `${uses.length} use rows`)
  check('🔴 a compensating reversal row was posted', reversals.length === 1 && reversals[0].days === 4,
    `${reversals.length} rows, ${reversals[0]?.days} days`)
  check('the two rows net to zero — exactly like a reversing GL entry',
    uses[0].days + reversals[0].days === 0, `${uses[0].days} + ${reversals[0].days}`)

  const cancelTwice = await cancelLeave(req.id!, userId)
  const balTwice = (await leaveBalances(empId)).find(b => b.type.id === annual.id)!.balance
  check('🔴 cancelling twice does NOT credit the days twice (idempotent)',
    balTwice === balCancelled, `${balCancelled} → ${balTwice}${cancelTwice.ok ? '' : ' (refused)'}`)

  // ── refusals are explicit, never a silent truncation ──────────────────────
  const tooMuch = await createLeaveRequest({
    employeeId: empId, leaveTypeId: annual.id,
    startDate: '2026-09-01', endDate: '2027-06-30',
  }, userId)
  check('a request beyond the balance is REFUSED, not silently shortened',
    tooMuch.ok === false && tooMuch.reason === 'insufficient_balance', JSON.stringify(tooMuch))

  const allHoliday = await createLeaveRequest({
    employeeId: empId, leaveTypeId: annual.id,
    startDate: '2026-08-06', endDate: '2026-08-07',   // Thu + Fri
  }, userId)
  check('a request landing entirely on rest days is refused with a reason',
    allHoliday.ok === false && allHoliday.reason === 'no_working_days', JSON.stringify(allHoliday))

  const sickReq = await createLeaveRequest({
    employeeId: empId, leaveTypeId: sick.id,
    startDate: '2026-08-10', endDate: '2026-08-11',
  }, userId)
  check('sick leave is accepted regardless of the annual balance', sickReq.ok === true)
  await approveLeave(sickReq.id!, userId)
  const annualUnchanged = (await leaveBalances(empId)).find(b => b.type.id === annual.id)!.balance
  check('approving sick leave does NOT touch the annual balance',
    annualUnchanged === balCancelled, `${balCancelled} → ${annualUnchanged}`)

  // ── rejection ─────────────────────────────────────────────────────────────
  const rej = await createLeaveRequest({
    employeeId: empId, leaveTypeId: annual.id,
    startDate: '2026-08-12', endDate: '2026-08-12',
  }, userId)
  await rejectLeave(rej.id!, userId)
  const balRejected = (await leaveBalances(empId)).find(b => b.type.id === annual.id)!.balance
  check('a rejected request never touches the balance', balRejected === annualUnchanged,
    `${annualUnchanged} → ${balRejected}`)
  check('the rejected request is visible with its status',
    (await listLeaveRequests({ employeeId: empId, status: 'rejected' })).some(r => r.id === rej.id))

  // ── attendance & overtime ─────────────────────────────────────────────────
  await recordAttendance({ employeeId: empId, date: '2026-08-01', checkIn: '08:45', checkOut: '17:00' }, userId)
  await recordAttendance({ employeeId: empId, date: '2026-08-02', checkIn: '08:00', checkOut: '16:30' }, userId)
  const att = await pgQuery<{ late_minutes: number; early_leave_minutes: number; worked_minutes: number }>(
    `SELECT late_minutes, early_leave_minutes, worked_minutes FROM hr_attendance
     WHERE employee_id=$1 ORDER BY date`, [empId])
  check('lateness beyond the grace period is recorded', att[0].late_minutes === 30, `${att[0].late_minutes} min`)
  check('an early departure is recorded', att[1].early_leave_minutes === 30, `${att[1].early_leave_minutes} min`)

  await recordAttendance({ employeeId: empId, date: '2026-08-01', checkIn: '08:00', checkOut: '17:00' }, userId)
  const reAtt = await pgQuery<{ n: string; late: number }>(
    `SELECT count(*)::text AS n, max(late_minutes) AS late FROM hr_attendance
     WHERE employee_id=$1 AND date='2026-08-01'`, [empId])
  check('re-recording the same day CORRECTS it rather than duplicating it',
    reAtt[0].n === '1' && reAtt[0].late === 0, `${reAtt[0].n} row, late=${reAtt[0].late}`)

  const otId = await addOvertime({ employeeId: empId, date: '2026-08-01', hours: 10, kind: 'normal' }, userId)
  check('overtime is recorded unapproved by default',
    (await pgQuery<{ approved: number }>(`SELECT approved FROM hr_overtime WHERE id=$1`, [otId]))[0].approved === 0)
  await approveOvertime(otId)
  check('ordinary overtime is valued at 1.4× (قانون کار مادهٔ ۵۹)',
    OVERTIME_MULTIPLIERS.normal === 1.4 && overtimeValue(10, 100_000, 'normal') === 1_400_000)

  const ts = await monthlyTimesheet(empId, '2026-08-01', '2026-08-31')
  check('the timesheet counts expected working days from the calendar',
    ts.expectedWorkingDays > 0 && ts.expectedWorkingDays < 31, `${ts.expectedWorkingDays} days`)
  check('the timesheet excludes the added holiday from expected working days',
    ts.expectedWorkingDays === workingDaysBetween('2026-08-01', '2026-08-31', await calendarContext('2026-08-01', '2026-08-31')))
  check('approved overtime reaches the timesheet (a payroll input for 28.3)',
    ts.overtimeHours === 10, `${ts.overtimeHours} h`)
  check('approved leave days reach the timesheet', ts.leaveDays >= 2, `${ts.leaveDays} days`)

  // ── missions ──────────────────────────────────────────────────────────────
  const misId = await createMission({
    employeeId: empId, startDate: '2026-08-17', endDate: '2026-08-19',
    destination: 'اصفهان', purpose: 'نصب تجهیزات', estimatedCost: 50_000_000,
  }, userId)
  check('a mission is recorded', (await listMissions(empId)).some(m => m.id === misId))

  const ov = await leaveOverview()
  check('the module overview assembles', typeof ov.pendingRequests === 'number', JSON.stringify(ov))

  // ── cleanup ───────────────────────────────────────────────────────────────
  await deleteHoliday(holId)
  await deleteEmployee(empId)
  check('deleting the employee cascades their leave ledger and attendance',
    (await leaveLedger(empId)).length === 0
    && (await pgQuery(`SELECT id FROM hr_attendance WHERE employee_id=$1`, [empId])).length === 0)

  console.log(`\n  ${fail === 0 ? '✅' : '❌'} Phase 28.2: ${pass}/${pass + fail} passed\n`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
