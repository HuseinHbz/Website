/**
 * Phase 28.2 — leave/attendance server layer.
 *
 * Reuses rather than rebuilds: the 26.12 approval engine handles the manager
 * sign-off (`leave_request` was already one of its document types), and the
 * calendar comes from editable tables rather than a hardcoded holiday list.
 *
 * The invariant protected here: leave days move ONLY through
 * `postLeaveTransaction`, so a cancelled leave can always be given back.
 */
import { pgQuery } from '@/lib/db'
import {
  parseWorkingDays, leaveBalance, leaveAccrued, leaveUsed, accrualForMonths,
  reversalForLeave, checkLeave, computeAttendance, overtimeValue,
  type CalendarContext, type LeaveTx, type LeaveTxKind, type OvertimeKind,
} from './leave'

const NOW = `to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`

export interface LeaveType {
  id: number; code: string; nameEn: string; nameFa: string
  paid: boolean; accrualPerMonth: number; maxDaysPerYear: number | null
  requiresDocument: boolean; deductsBalance: boolean
}

export async function listLeaveTypes(): Promise<LeaveType[]> {
  return await pgQuery<LeaveType>(
    `SELECT id, code, name_en AS "nameEn", name_fa AS "nameFa",
            paid::boolean AS paid, accrual_per_month::float AS "accrualPerMonth",
            max_days_per_year::float AS "maxDaysPerYear",
            requires_document::boolean AS "requiresDocument",
            deducts_balance::boolean AS "deductsBalance"
     FROM hr_leave_types WHERE active=1 ORDER BY id`)
}

/**
 * The working calendar — weekday pattern plus the holiday list.
 *
 * Both are read from the database because Iranian public holidays move every
 * year; a function that hardcoded them would be wrong next Nowruz and nobody
 * would notice until leave balances drifted.
 */
export async function calendarContext(from?: string, to?: string): Promise<CalendarContext> {
  const cal = (await pgQuery<{ working_days: string }>(
    `SELECT working_days FROM hr_work_calendar WHERE active=1 ORDER BY id LIMIT 1`))[0]
  const params: unknown[] = []
  let where = '1=1'
  if (from && to) { params.push(from, to); where = 'date BETWEEN $1 AND $2' }
  const holidays = await pgQuery<{ date: string }>(
    `SELECT date FROM hr_holidays WHERE ${where}`, params)
  return {
    workingDays: parseWorkingDays(cal?.working_days ?? '0,1,2,3,4'),
    holidays: new Set(holidays.map(h => h.date)),
  }
}

export async function listHolidays(year?: string) {
  const params: unknown[] = []
  let where = '1=1'
  if (year) { params.push(`${year}-%`); where = `date LIKE $1` }
  return await pgQuery<{ id: number; date: string; titleFa: string; titleEn: string | null; kind: string }>(
    `SELECT id, date, title_fa AS "titleFa", title_en AS "titleEn", kind
     FROM hr_holidays WHERE ${where} ORDER BY date`, params)
}

export async function addHoliday(d: { date: string; titleFa: string; titleEn?: string | null; kind?: string }): Promise<number> {
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO hr_holidays (date, title_fa, title_en, kind) VALUES ($1,$2,$3,$4)
     ON CONFLICT (date, company_id) DO UPDATE SET title_fa=EXCLUDED.title_fa RETURNING id`,
    [d.date, d.titleFa, d.titleEn ?? null, d.kind ?? 'public']))[0]
  return row.id
}

export async function deleteHoliday(id: number) {
  await pgQuery(`DELETE FROM hr_holidays WHERE id=$1`, [id])
}

// ── the leave ledger ────────────────────────────────────────────────────────

export async function leaveLedger(employeeId: number, leaveTypeId?: number): Promise<(LeaveTx & { id: number; note: string | null; createdAt: string; refType: string | null; refId: number | null })[]> {
  const params: unknown[] = [employeeId]
  let where = 'employee_id=$1'
  if (leaveTypeId) { params.push(leaveTypeId); where += ` AND leave_type_id=$${params.length}` }
  return await pgQuery(
    `SELECT id, kind, days::float AS days, ref_type AS "refType", ref_id AS "refId",
            note, created_at AS "createdAt"
     FROM hr_leave_transactions WHERE ${where} ORDER BY id DESC`, params) as never
}

/**
 * THE only way leave days move.
 *
 * Appends a signed row. There is no balance column to update — the balance is
 * the sum, which is what makes a cancellation correct rather than approximate.
 */
export async function postLeaveTransaction(
  employeeId: number, leaveTypeId: number, kind: LeaveTxKind, days: number,
  opts: { refType?: string; refId?: number; note?: string; period?: string; userId?: string | null } = {},
): Promise<number> {
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO hr_leave_transactions
       (employee_id, leave_type_id, kind, days, ref_type, ref_id, period, note, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [employeeId, leaveTypeId, kind, days, opts.refType ?? null, opts.refId ?? null,
      opts.period ?? null, opts.note ?? null, opts.userId ?? null]))[0]
  return row.id
}

/** Balance per leave type for one employee — what the UI and the guard read. */
export async function leaveBalances(employeeId: number) {
  const types = await listLeaveTypes()
  const out = []
  for (const t of types) {
    const ledger = await leaveLedger(employeeId, t.id)
    out.push({
      type: t,
      balance: leaveBalance(ledger),
      accrued: leaveAccrued(ledger),
      used: leaveUsed(ledger),
    })
  }
  return out
}

/**
 * Accrue monthly entitlement.
 *
 * Idempotent per (employee, type, period): running it twice for the same month
 * grants the days once, so a retried cron cannot inflate everyone's balance.
 */
export async function accrueMonthly(period: string, userId?: string): Promise<{ employees: number; days: number }> {
  const types = (await listLeaveTypes()).filter(t => t.accrualPerMonth > 0)
  if (!types.length) return { employees: 0, days: 0 }
  const employees = await pgQuery<{ id: number }>(
    `SELECT id FROM hr_employees WHERE status='active'`)

  let touched = 0, total = 0
  for (const e of employees) {
    for (const t of types) {
      const already = (await pgQuery<{ id: number }>(
        `SELECT id FROM hr_leave_transactions
         WHERE employee_id=$1 AND leave_type_id=$2 AND kind='accrual' AND period=$3`,
        [e.id, t.id, period]))[0]
      if (already) continue
      const days = accrualForMonths(1, t.accrualPerMonth)
      await postLeaveTransaction(e.id, t.id, 'accrual', days,
        { period, note: `Monthly accrual ${period}`, userId })
      touched++; total += days
    }
  }
  return { employees: touched, days: Math.round(total * 100) / 100 }
}

// ── leave requests ──────────────────────────────────────────────────────────

export interface LeaveRequestRow {
  id: number; employeeId: number; employeeName: string; leaveTypeId: number
  leaveTypeNameFa: string; leaveTypeNameEn: string
  startDate: string; endDate: string; days: number
  status: string; reason: string | null; createdAt: string
}

export async function listLeaveRequests(opts: { employeeId?: number; status?: string; scopeClause?: string; scopeParams?: unknown[] } = {}) {
  const params: unknown[] = []
  let where = '1=1'
  if (opts.employeeId) { params.push(opts.employeeId); where += ` AND r.employee_id=$${params.length}` }
  if (opts.status) { params.push(opts.status); where += ` AND r.status=$${params.length}` }
  return await pgQuery<LeaveRequestRow>(
    `SELECT r.id, r.employee_id AS "employeeId", (e.first_name||' '||e.last_name) AS "employeeName",
            r.leave_type_id AS "leaveTypeId",
            t.name_fa AS "leaveTypeNameFa", t.name_en AS "leaveTypeNameEn",
            r.start_date AS "startDate", r.end_date AS "endDate", r.days::float AS days,
            r.status, r.reason, r.created_at AS "createdAt"
     FROM hr_leave_requests r
     JOIN hr_employees e ON e.id = r.employee_id
     JOIN hr_leave_types t ON t.id = r.leave_type_id
     WHERE ${where}${opts.scopeClause ?? ''}
     ORDER BY r.created_at DESC`, [...params, ...(opts.scopeParams ?? [])])
}

/**
 * Submit a leave request.
 *
 * The days are computed SERVER-SIDE from the calendar, never trusted from the
 * client — otherwise a request could claim fewer days than it consumes. The
 * balance is only debited on approval, so a pending request does not lock days
 * that may never be taken.
 */
export async function createLeaveRequest(
  d: { employeeId: number; leaveTypeId: number; startDate: string; endDate: string; halfDay?: boolean; reason?: string | null },
  userId: string | null,
): Promise<{ ok: boolean; reason?: string; id?: number; days?: number }> {
  const type = (await listLeaveTypes()).find(t => t.id === d.leaveTypeId)
  if (!type) return { ok: false, reason: 'invalid_range' }

  const ctx = await calendarContext(d.startDate, d.endDate)
  const balances = await leaveBalances(d.employeeId)
  const bal = balances.find(b => b.type.id === d.leaveTypeId)

  // The annual cap is measured by WHEN THE LEAVE FALLS, not when it was
  // recorded — a request entered in December for January belongs to January.
  const year = d.startDate.slice(0, 4)
  const usedThisYear = Number((await pgQuery<{ n: string }>(
    `SELECT COALESCE(SUM(days),0)::text AS n FROM hr_leave_requests
     WHERE employee_id=$1 AND leave_type_id=$2 AND status='approved' AND start_date LIKE $3`,
    [d.employeeId, d.leaveTypeId, `${year}-%`]))[0]?.n ?? 0)

  const check = checkLeave(d.startDate, d.endDate, ctx, {
    balance: bal?.balance ?? 0,
    deductsBalance: type.deductsBalance,
    halfDay: d.halfDay,
    maxDaysPerYear: type.maxDaysPerYear,
    usedThisYear,
  })
  if (!check.ok) return { ok: false, reason: check.reason, days: check.days }

  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO hr_leave_requests
       (employee_id, leave_type_id, start_date, end_date, days, half_day, reason, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8) RETURNING id`,
    [d.employeeId, d.leaveTypeId, d.startDate, d.endDate, check.days,
      d.halfDay ? 1 : 0, d.reason ?? null, userId]))[0]

  // Reuse the existing approval engine — `leave_request` is already one of its
  // document types, so there is no second approval mechanism here.
  try {
    const { createApprovalRequest } = await import('@/lib/erp/approvalData')
    const ap = await createApprovalRequest({
      docType: 'leave_request', refType: 'hr_leave_requests', refId: row.id,
      title: `Leave ${d.startDate} → ${d.endDate}`, amount: check.days,
    }, userId)
    await pgQuery(`UPDATE hr_leave_requests SET approval_request_id=$2 WHERE id=$1`, [row.id, ap.id])
    // A matrix with no rule for this type auto-approves; honour that.
    if (ap.autoApproved) await approveLeave(row.id, userId)
  } catch { /* no matrix rule configured → stays pending for manual decision */ }

  return { ok: true, id: row.id, days: check.days }
}

/** Approve a request and DEBIT the balance — the days move only now. */
export async function approveLeave(requestId: number, userId: string | null): Promise<{ ok: boolean; error?: string }> {
  const r = (await pgQuery<{ id: number; employee_id: number; leave_type_id: number; days: number; status: string }>(
    `SELECT id, employee_id, leave_type_id, days::float AS days, status
     FROM hr_leave_requests WHERE id=$1`, [requestId]))[0]
  if (!r) return { ok: false, error: 'Request not found' }
  if (r.status === 'approved') return { ok: true }   // idempotent
  if (r.status !== 'pending' && r.status !== 'draft') return { ok: false, error: `Cannot approve a ${r.status} request` }

  const type = (await listLeaveTypes()).find(t => t.id === r.leave_type_id)
  await pgQuery(
    `UPDATE hr_leave_requests SET status='approved', decided_by=$2, decided_at=${NOW}, updated_at=${NOW} WHERE id=$1`,
    [requestId, userId])
  if (type?.deductsBalance) {
    await postLeaveTransaction(r.employee_id, r.leave_type_id, 'use', -Math.abs(r.days),
      { refType: 'hr_leave_requests', refId: requestId, note: 'Leave approved', userId })
  }
  return { ok: true }
}

export async function rejectLeave(requestId: number, userId: string | null): Promise<{ ok: boolean; error?: string }> {
  const r = (await pgQuery<{ status: string }>(`SELECT status FROM hr_leave_requests WHERE id=$1`, [requestId]))[0]
  if (!r) return { ok: false, error: 'Request not found' }
  if (r.status === 'approved') return { ok: false, error: 'Cancel the approved leave instead of rejecting it' }
  await pgQuery(
    `UPDATE hr_leave_requests SET status='rejected', decided_by=$2, decided_at=${NOW}, updated_at=${NOW} WHERE id=$1`,
    [requestId, userId])
  return { ok: true }
}

/**
 * Cancel an APPROVED leave — the days come back as a reversal.
 *
 * The original `use` row stays, exactly like a reversing GL entry: both sides
 * remain visible and net to zero, so the ledger still explains the balance.
 * Idempotent — cancelling twice does not credit the days twice.
 */
export async function cancelLeave(requestId: number, userId: string | null): Promise<{ ok: boolean; error?: string; returned?: number }> {
  const r = (await pgQuery<{ id: number; employee_id: number; leave_type_id: number; days: number; status: string }>(
    `SELECT id, employee_id, leave_type_id, days::float AS days, status
     FROM hr_leave_requests WHERE id=$1`, [requestId]))[0]
  if (!r) return { ok: false, error: 'Request not found' }
  if (r.status === 'cancelled') return { ok: true, returned: 0 }
  if (r.status !== 'approved') {
    await pgQuery(`UPDATE hr_leave_requests SET status='cancelled', updated_at=${NOW} WHERE id=$1`, [requestId])
    return { ok: true, returned: 0 }
  }

  const already = (await pgQuery<{ id: number }>(
    `SELECT id FROM hr_leave_transactions
     WHERE kind='reversal' AND ref_type='hr_leave_requests' AND ref_id=$1`, [requestId]))[0]
  if (already) return { ok: true, returned: 0 }

  const used = (await pgQuery<{ days: number }>(
    `SELECT days::float AS days FROM hr_leave_transactions
     WHERE kind='use' AND ref_type='hr_leave_requests' AND ref_id=$1`, [requestId]))[0]

  let returned = 0
  if (used) {
    returned = reversalForLeave(used.days)
    await postLeaveTransaction(r.employee_id, r.leave_type_id, 'reversal', returned,
      { refType: 'hr_leave_requests', refId: requestId, note: 'Leave cancelled', userId })
  }
  await pgQuery(`UPDATE hr_leave_requests SET status='cancelled', updated_at=${NOW} WHERE id=$1`, [requestId])
  return { ok: true, returned }
}

// ── attendance & overtime ───────────────────────────────────────────────────

export async function recordAttendance(
  d: { employeeId: number; date: string; checkIn?: string | null; checkOut?: string | null; source?: string; note?: string | null },
  userId: string,
): Promise<number> {
  const shift = { start: '08:00', end: '17:00', graceMinutes: 15 }
  const a = computeAttendance(d.checkIn ?? null, d.checkOut ?? null, shift)
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO hr_attendance
       (employee_id, date, check_in, check_out, source, late_minutes, early_leave_minutes, worked_minutes, note, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (employee_id, date) DO UPDATE SET
       check_in=EXCLUDED.check_in, check_out=EXCLUDED.check_out, source=EXCLUDED.source,
       late_minutes=EXCLUDED.late_minutes, early_leave_minutes=EXCLUDED.early_leave_minutes,
       worked_minutes=EXCLUDED.worked_minutes, note=EXCLUDED.note
     RETURNING id`,
    [d.employeeId, d.date, d.checkIn ?? null, d.checkOut ?? null, d.source ?? 'manual',
      a.lateMinutes, a.earlyLeaveMinutes, a.workedMinutes, d.note ?? null, userId]))[0]
  return row.id
}

export async function attendanceOf(employeeId: number, from: string, to: string) {
  return await pgQuery<{ id: number; date: string; checkIn: string | null; checkOut: string | null; workedMinutes: number; lateMinutes: number; earlyLeaveMinutes: number; source: string }>(
    `SELECT id, date, check_in AS "checkIn", check_out AS "checkOut",
            worked_minutes AS "workedMinutes", late_minutes AS "lateMinutes",
            early_leave_minutes AS "earlyLeaveMinutes", source
     FROM hr_attendance WHERE employee_id=$1 AND date BETWEEN $2 AND $3 ORDER BY date`,
    [employeeId, from, to])
}

export async function addOvertime(
  d: { employeeId: number; date: string; hours: number; kind: OvertimeKind; note?: string | null },
  userId: string,
): Promise<number> {
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO hr_overtime (employee_id, date, hours, kind, note, created_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [d.employeeId, d.date, d.hours, d.kind, d.note ?? null, userId]))[0]
  return row.id
}

export async function approveOvertime(id: number) {
  await pgQuery(`UPDATE hr_overtime SET approved=1 WHERE id=$1`, [id])
}

/** Approved overtime for a period — a direct payroll input (28.3 reads this). */
export async function overtimeFor(employeeId: number, from: string, to: string, hourly = 0) {
  const rows = await pgQuery<{ id: number; date: string; hours: number; kind: OvertimeKind; approved: number }>(
    `SELECT id, date, hours::float AS hours, kind, approved
     FROM hr_overtime WHERE employee_id=$1 AND date BETWEEN $2 AND $3 ORDER BY date`,
    [employeeId, from, to])
  return rows.map(r => ({ ...r, value: r.approved ? overtimeValue(r.hours, hourly, r.kind) : 0 }))
}

/** Monthly timesheet: worked days, absences, lateness and approved overtime. */
export async function monthlyTimesheet(employeeId: number, from: string, to: string) {
  const ctx = await calendarContext(from, to)
  const { datesBetween, isWorkingDay } = await import('./leave')
  const expected = datesBetween(from, to).filter(d => isWorkingDay(d, ctx)).length
  const att = await attendanceOf(employeeId, from, to)
  const ot = await overtimeFor(employeeId, from, to)
  const leaveDaysTaken = Number((await pgQuery<{ n: string }>(
    `SELECT COALESCE(SUM(days),0)::text AS n FROM hr_leave_requests
     WHERE employee_id=$1 AND status='approved' AND start_date <= $3 AND end_date >= $2`,
    [employeeId, from, to]))[0]?.n ?? 0)

  return {
    expectedWorkingDays: expected,
    presentDays: att.filter(a => a.workedMinutes > 0).length,
    leaveDays: leaveDaysTaken,
    totalLateMinutes: att.reduce((s, a) => s + a.lateMinutes, 0),
    workedHours: Math.round(att.reduce((s, a) => s + a.workedMinutes, 0) / 6) / 10,
    overtimeHours: ot.filter(o => o.approved).reduce((s, o) => s + o.hours, 0),
    attendance: att,
    overtime: ot,
  }
}

// ── missions ────────────────────────────────────────────────────────────────

export async function listMissions(employeeId?: number) {
  const params: unknown[] = []
  let where = '1=1'
  if (employeeId) { params.push(employeeId); where += ` AND m.employee_id=$1` }
  return await pgQuery<{ id: number; employeeId: number; employeeName: string; startDate: string; endDate: string; destination: string; estimatedCost: number; status: string }>(
    `SELECT m.id, m.employee_id AS "employeeId", (e.first_name||' '||e.last_name) AS "employeeName",
            m.start_date AS "startDate", m.end_date AS "endDate", m.destination,
            m.estimated_cost::float AS "estimatedCost", m.status
     FROM hr_missions m JOIN hr_employees e ON e.id=m.employee_id
     WHERE ${where} ORDER BY m.start_date DESC`, params)
}

export async function createMission(
  d: { employeeId: number; startDate: string; endDate: string; destination: string; purpose?: string | null; estimatedCost?: number },
  userId: string,
): Promise<number> {
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO hr_missions (employee_id, start_date, end_date, destination, purpose, estimated_cost, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,'pending',$7) RETURNING id`,
    [d.employeeId, d.startDate, d.endDate, d.destination, d.purpose ?? null, d.estimatedCost ?? 0, userId]))[0]
  return row.id
}

/** Module overview for the header. */
export async function leaveOverview() {
  const pending = Number((await pgQuery<{ n: string }>(
    `SELECT count(*)::text AS n FROM hr_leave_requests WHERE status='pending'`))[0]?.n ?? 0)
  const onLeaveToday = Number((await pgQuery<{ n: string }>(
    `SELECT count(*)::text AS n FROM hr_leave_requests
     WHERE status='approved' AND to_char(now(),'YYYY-MM-DD') BETWEEN start_date AND end_date`))[0]?.n ?? 0)
  const pendingOt = Number((await pgQuery<{ n: string }>(
    `SELECT count(*)::text AS n FROM hr_overtime WHERE approved=0`))[0]?.n ?? 0)
  const holidays = Number((await pgQuery<{ n: string }>(
    `SELECT count(*)::text AS n FROM hr_holidays WHERE date >= to_char(now(),'YYYY-MM-DD')`))[0]?.n ?? 0)
  return { pendingRequests: pending, onLeaveToday, pendingOvertime: pendingOt, upcomingHolidays: holidays }
}
