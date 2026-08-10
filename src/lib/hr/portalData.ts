/**
 * Phase 28.4 — employee-portal data layer.
 *
 * 🔴 Every function here takes `employeeId` as its FIRST argument and that
 * value comes from the server session in every route (`requireHrPortal`) —
 * never from a client-supplied id. A resource that does not belong to the
 * calling employee is INDISTINGUISHABLE from a missing one: null/empty, which
 * the route turns into a 404, never a 403 (the 26.25a IDOR pattern — existence
 * itself is not leaked).
 *
 * Reuses the same tables and functions the admin side uses
 * (`payroll_slips`, `leaveData.ts`, `hr_missions`) — no parallel data layer.
 */
import { pgQuery } from '@/lib/db'
import {
  leaveBalances, leaveLedger, listLeaveRequests, createLeaveRequest, cancelLeave,
  attendanceOf, monthlyTimesheet, calendarContext, listHolidays, createMission,
} from './leaveData'
import { checkLeave } from './leave'
import { maskNationalId, isValidIban } from './employees'
import { requestAdvance } from './annualData'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

// ── identity / dashboard ────────────────────────────────────────────────────

export async function portalEmployee(employeeId: number) {
  const row = (await pgQuery<{ id: number; firstName: string; lastName: string; employeeCode: string; mobile: string | null; email: string | null; status: string }>(
    `SELECT id, first_name AS "firstName", last_name AS "lastName", employee_code AS "employeeCode",
            mobile, email, status FROM hr_employees WHERE id=$1`, [employeeId]))[0]
  return row ?? null
}

export async function portalDashboard(employeeId: number) {
  const balances = await leaveBalances(employeeId)
  const annual = balances.find(b => b.type.code === 'annual')
  const pendingRequests = Number((await pgQuery<{ n: string }>(
    `SELECT count(*)::text AS n FROM hr_leave_requests WHERE employee_id=$1 AND status='pending'`,
    [employeeId]))[0]?.n ?? 0)
  const lastSlip = (await pgQuery<{ jalaliYear: number; jalaliMonth: number; net: number }>(
    `SELECT p.jalali_year AS "jalaliYear", p.jalali_month AS "jalaliMonth", s.net::float AS net
     FROM payroll_slips s JOIN payroll_periods p ON p.id = s.period_id
     WHERE s.employee_id=$1 AND s.status IN ('approved','paid','correction')
     ORDER BY p.end_date DESC, s.id DESC LIMIT 1`, [employeeId]))[0]
  const pendingPortalRequests = Number((await pgQuery<{ n: string }>(
    `SELECT count(*)::text AS n FROM hr_portal_requests WHERE employee_id=$1 AND status='pending'`,
    [employeeId]))[0]?.n ?? 0)
  return {
    leaveBalance: annual?.balance ?? 0,
    pendingLeaveRequests: pendingRequests,
    lastSlip: lastSlip ?? null,
    pendingPortalRequests,
  }
}

// ── payslips (بند ۳) ────────────────────────────────────────────────────────

export interface MySlipRow {
  id: number; periodId: number; jalaliYear: number; jalaliMonth: number
  gross: number; net: number; tax: number; status: string
}

/**
 * 🔴 Only slips from a period that is at least APPROVED — a period still
 * "open"/"calculated" is not final, and showing it would let an employee see
 * (and worry about) a draft figure that might still change before approval.
 */
export async function myPayslips(employeeId: number): Promise<MySlipRow[]> {
  return await pgQuery<MySlipRow>(
    `SELECT s.id, s.period_id AS "periodId", p.jalali_year AS "jalaliYear", p.jalali_month AS "jalaliMonth",
            s.gross::float AS gross, s.net::float AS net, s.tax::float AS tax, s.status
     FROM payroll_slips s JOIN payroll_periods p ON p.id = s.period_id
     WHERE s.employee_id=$1 AND s.status IN ('approved','paid','correction')
       AND p.status IN ('approved','paid','locked')
     ORDER BY p.end_date DESC, s.id DESC`, [employeeId])
}

/**
 * 🔴 One payslip — returns null unless it belongs to the requesting employee
 * AND its period is finalised. The route turns null into a 404: a foreign
 * slip id and a locked-but-not-yet-approved slip look identical from outside.
 */
export async function myPayslipDetail(employeeId: number, slipId: number) {
  const slip = (await pgQuery<{ id: number; employeeId: number; periodId: number; rulesetYear: number; rulesetVersion: number; gross: number; insuranceBase: number; employeeInsurance: number; taxableIncome: number; tax: number; deductions: number; net: number; status: string; jalaliYear: number; jalaliMonth: number; periodStatus: string }>(
    `SELECT s.id, s.employee_id AS "employeeId", s.period_id AS "periodId",
            r.year AS "rulesetYear", r.version AS "rulesetVersion",
            s.gross::float AS gross, s.insurance_base::float AS "insuranceBase",
            s.employee_insurance::float AS "employeeInsurance",
            s.taxable_income::float AS "taxableIncome", s.tax::float AS tax,
            s.deductions::float AS deductions, s.net::float AS net, s.status,
            p.jalali_year AS "jalaliYear", p.jalali_month AS "jalaliMonth", p.status AS "periodStatus"
     FROM payroll_slips s
     JOIN payroll_periods p ON p.id = s.period_id
     JOIN payroll_rulesets r ON r.id = s.ruleset_id
     WHERE s.id=$1`, [slipId]))[0]
  if (!slip) return null
  if (slip.employeeId !== employeeId) return null
  if (slip.status === 'reversed' || !['approved', 'paid', 'correction'].includes(slip.status)) return null
  if (!['approved', 'paid', 'locked'].includes(slip.periodStatus)) return null

  const lines = await pgQuery<{ lineType: string; key: string; labelFa: string; labelEn: string; amount: number }>(
    `SELECT line_type AS "lineType", key, label_fa AS "labelFa", label_en AS "labelEn", amount::float AS amount
     FROM payroll_slip_lines WHERE slip_id=$1 AND line_type IN ('earning','deduction')
     ORDER BY sort_order, id`, [slipId])
  return { ...slip, lines }
}

/** Yearly personal summary: gross/tax/insurance totals for the employee's own use. */
export async function myAnnualSummary(employeeId: number, jalaliYear: number) {
  const row = (await pgQuery<{ gross: string; tax: string; ei: string; net: string; count: string }>(
    `SELECT COALESCE(SUM(s.gross),0)::text AS gross, COALESCE(SUM(s.tax),0)::text AS tax,
            COALESCE(SUM(s.employee_insurance),0)::text AS ei, COALESCE(SUM(s.net),0)::text AS net,
            count(*)::text AS count
     FROM payroll_slips s JOIN payroll_periods p ON p.id = s.period_id
     WHERE s.employee_id=$1 AND p.jalali_year=$2
       AND s.status IN ('approved','paid','correction') AND p.status IN ('approved','paid','locked')`,
    [employeeId, jalaliYear]))[0]
  return {
    jalaliYear,
    gross: Math.round(Number(row?.gross ?? 0)),
    tax: Math.round(Number(row?.tax ?? 0)),
    employeeInsurance: Math.round(Number(row?.ei ?? 0)),
    net: Math.round(Number(row?.net ?? 0)),
    slipCount: Number(row?.count ?? 0),
  }
}

// ── leave & attendance (بند ۴) ──────────────────────────────────────────────

export async function myLeaveOverview(employeeId: number) {
  return { balances: await leaveBalances(employeeId), ledger: await leaveLedger(employeeId) }
}

export async function myLeaveRequests(employeeId: number) {
  return await listLeaveRequests({ employeeId })
}

/**
 * Submit a leave request for the SESSION'S employee — `employeeId` never
 * comes from the request body, so it cannot be forged into another employee's
 * name. Reuses the exact 28.2 engine (server-side day calculation, balance
 * check, approval-matrix routing) — no parallel logic.
 */
export async function myLeaveRequest(
  employeeId: number, d: { leaveTypeId: number; startDate: string; endDate: string; halfDay?: boolean; reason?: string | null },
) {
  return await createLeaveRequest({ employeeId, ...d }, null)
}

/**
 * 🔴 An employee may CANCEL their own pending/approved request but can never
 * approve/reject it — that authority stays with the manager's admin session.
 * `cancelLeave` itself only flips draft/pending/approved states; it never
 * grants approval.
 */
export async function myLeaveCancel(employeeId: number, requestId: number) {
  const owner = (await pgQuery<{ employee_id: number; status: string }>(
    `SELECT employee_id, status FROM hr_leave_requests WHERE id=$1`, [requestId]))[0]
  if (!owner || owner.employee_id !== employeeId) return { ok: false, error: 'Not found' }
  if (owner.status === 'pending') {
    await pgQuery(`UPDATE hr_leave_requests SET status='cancelled', updated_at=${NOW} WHERE id=$1`, [requestId])
    return { ok: true }
  }
  if (owner.status === 'approved') return await cancelLeave(requestId, null)
  return { ok: false, error: 'این درخواست در وضعیتی نیست که بتوان لغوش کرد' }
}

export async function myAttendance(employeeId: number, from: string, to: string) {
  return {
    attendance: await attendanceOf(employeeId, from, to),
    timesheet: await monthlyTimesheet(employeeId, from, to),
  }
}

export async function myCalendar(from?: string, to?: string) {
  return { ...(await calendarContext(from, to)), holidays: await listHolidays() }
}

// ── administrative requests (بند ۵) ─────────────────────────────────────────

export interface PortalRequestRow {
  id: number; kind: string; payload: string; status: string; note: string | null; createdAt: string
}

export async function myPortalRequests(employeeId: number): Promise<PortalRequestRow[]> {
  return await pgQuery<PortalRequestRow>(
    `SELECT id, kind, payload, status, note, created_at AS "createdAt"
     FROM hr_portal_requests WHERE employee_id=$1 ORDER BY id DESC`, [employeeId])
}

/**
 * Submit an administrative ask. Every kind routes through the SAME approval
 * engine (`hr_portal_request`) — no parallel workflow. 🔴 `info_correction`
 * NEVER touches `hr_employees` here or anywhere in this file: it is recorded
 * as a proposal, and applying it is a deliberate HR action in the existing
 * employee editor.
 */
export async function submitPortalRequest(
  employeeId: number, kind: 'certificate' | 'advance' | 'mission' | 'info_correction', payload: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string; id?: number }> {
  if (kind === 'info_correction') {
    const sensitive = ['nationalId', 'iban', 'bankAccount', 'insuranceNo']
    if (!Object.keys(payload).some(k => sensitive.includes(k)) && !payload.field) {
      return { ok: false, error: 'فیلد مورد نظر برای اصلاح مشخص نشده است' }
    }
    if (payload.iban && !isValidIban(String(payload.iban))) {
      return { ok: false, error: 'شبا: فرمت نامعتبر است' }
    }
  }

  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO hr_portal_requests (employee_id, kind, payload, status)
     VALUES ($1,$2,$3,'pending') RETURNING id`,
    [employeeId, kind, JSON.stringify(payload)]))[0]

  try {
    const { createApprovalRequest } = await import('@/lib/erp/approvalData')
    const titleFa: Record<string, string> = {
      certificate: 'گواهی اشتغال', advance: 'درخواست مساعده', mission: 'درخواست مأموریت',
      info_correction: 'درخواست اصلاح اطلاعات فردی',
    }
    const ap = await createApprovalRequest({
      docType: 'hr_portal_request', refType: 'hr_portal_requests', refId: row.id,
      title: titleFa[kind], amount: 0,
    }, null)
    await pgQuery(`UPDATE hr_portal_requests SET approval_request_id=$2 WHERE id=$1`, [row.id, ap.id])
    if (ap.autoApproved) await pgQuery(`UPDATE hr_portal_requests SET status='approved' WHERE id=$1`, [row.id])
  } catch { /* no matrix rule → stays pending for manual HR review */ }

  return { ok: true, id: row.id }
}

/** HR decides a portal request — approve/reject only, never auto-applied. */
export async function decidePortalRequest(id: number, status: 'approved' | 'rejected', note: string | null): Promise<{ ok: boolean; error?: string }> {
  const row = (await pgQuery<{ status: string }>(`SELECT status FROM hr_portal_requests WHERE id=$1`, [id]))[0]
  if (!row) return { ok: false, error: 'Not found' }
  if (row.status !== 'pending') return { ok: false, error: `وضعیت ${row.status} قابل تغییر نیست` }
  await pgQuery(`UPDATE hr_portal_requests SET status=$2, note=$3, updated_at=${NOW} WHERE id=$1`, [id, status, note])
  return { ok: true }
}

// ── profile (بند ۶) ──────────────────────────────────────────────────────

export async function myProfile(employeeId: number) {
  const row = (await pgQuery<{ id: number; firstName: string; lastName: string; employeeCode: string; nationalId: string | null; iban: string | null; mobile: string | null; email: string | null; address: string | null; maritalStatus: string | null; childrenCount: number; hireDate: string | null }>(
    `SELECT id, first_name AS "firstName", last_name AS "lastName", employee_code AS "employeeCode",
            national_id AS "nationalId", iban, mobile, email, address, marital_status AS "maritalStatus",
            COALESCE(children_count,0) AS "childrenCount", hire_date AS "hireDate"
     FROM hr_employees WHERE id=$1`, [employeeId]))[0]
  if (!row) return null
  // Own data — the employee sees their own IBAN/national id in full, masked
  // only where a UI wants a glance-safe display; this is not the 26.28 field
  // scope (that guards OTHER people's data from an unauthorized viewer).
  return { ...row, nationalIdMasked: maskNationalId(row.nationalId) }
}

/** Non-sensitive fields the employee may edit directly — never nationalId/iban. */
export async function updateMyProfile(
  employeeId: number, d: { mobile?: string; email?: string | null; address?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  if (d.mobile) {
    const clash = (await pgQuery<{ id: number }>(
      `SELECT id FROM hr_employees WHERE mobile=$1 AND id<>$2`, [d.mobile, employeeId]))[0]
    if (clash) return { ok: false, error: 'این شماره برای کارمند دیگری ثبت شده است' }
  }
  await pgQuery(
    `UPDATE hr_employees SET
       mobile=COALESCE($2,mobile), email=COALESCE($3,email), address=COALESCE($4,address), updated_at=${NOW}
     WHERE id=$1`,
    [employeeId, d.mobile ?? null, d.email ?? null, d.address ?? null])
  return { ok: true }
}

export async function myDependents(employeeId: number) {
  const { dependentsOf } = await import('./employeeData')
  return await dependentsOf(employeeId)
}

export async function myDocuments(employeeId: number) {
  const { documentsOf } = await import('./employeeData')
  return await documentsOf(employeeId)
}

// re-exported so route handlers can chain a portal "advance"/"mission" ask
// into the real modules without importing them separately — HR still reviews
// the hr_portal_requests entry first; this is only invoked from that decision.
export { requestAdvance, createMission, checkLeave }
