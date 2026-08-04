/**
 * Phase 28.2 — leave, attendance, overtime and missions API.
 *
 * Two things are deliberately server-side and not negotiable from the client:
 *
 *  · **the number of days a request consumes** — computed from the calendar,
 *    never read from the body, or a request could claim fewer days than it takes
 *  · **when the balance moves** — only on approval, and only through
 *    `postLeaveTransaction`, so the ledger stays the single explanation of the
 *    balance
 *
 * Row scope is inherited from `hr.employees`: leave data is personnel data, and
 * a manager who cannot see an employee must not see their absences either.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, guardJson, requirePermission, requireOp, notFound } from '@/lib/api/respond'
import { runOnce } from '@/lib/api/idempotency'
import { logAction } from '@/lib/admin/audit'
import { OVERTIME_KINDS, leaveRefusalMessage, type LeaveCheck } from '@/lib/hr/leave'
import {
  listLeaveTypes, listHolidays, addHoliday, deleteHoliday,
  leaveLedger, leaveBalances, accrueMonthly, postLeaveTransaction,
  listLeaveRequests, createLeaveRequest, approveLeave, rejectLeave, cancelLeave,
  recordAttendance, attendanceOf, addOvertime, approveOvertime,
  monthlyTimesheet, listMissions, createMission, leaveOverview,
} from '@/lib/hr/leaveData'
import { pgQuery } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const isFa = (req: NextRequest) => (req.headers.get('accept-language') ?? '').startsWith('fa')

const requestSchema = z.object({
  action: z.literal('request'),
  employeeId: z.number().int().positive(),
  leaveTypeId: z.number().int().positive(),
  startDate: z.string().trim().min(4).max(24),
  endDate: z.string().trim().min(4).max(24),
  halfDay: z.boolean().optional(),
  reason: z.string().trim().max(500).optional().nullable(),
})

const decideSchema = z.object({
  action: z.enum(['approve', 'reject', 'cancel']),
  id: z.number().int().positive(),
})

const attendanceSchema = z.object({
  action: z.literal('attendance'),
  employeeId: z.number().int().positive(),
  date: z.string().trim().min(4).max(24),
  checkIn: z.string().trim().max(8).optional().nullable(),
  checkOut: z.string().trim().max(8).optional().nullable(),
  note: z.string().trim().max(300).optional().nullable(),
})

const overtimeSchema = z.object({
  action: z.literal('overtime'),
  employeeId: z.number().int().positive(),
  date: z.string().trim().min(4).max(24),
  hours: z.number().min(0).max(24),
  kind: z.enum(OVERTIME_KINDS),
  note: z.string().trim().max(300).optional().nullable(),
})

const missionSchema = z.object({
  action: z.literal('mission'),
  employeeId: z.number().int().positive(),
  startDate: z.string().trim().min(4).max(24),
  endDate: z.string().trim().min(4).max(24),
  destination: z.string().trim().min(1).max(200),
  purpose: z.string().trim().max(500).optional().nullable(),
  estimatedCost: z.number().min(0).max(1_000_000_000_000).optional(),
})

const holidaySchema = z.object({
  action: z.literal('holiday'),
  date: z.string().trim().min(4).max(24),
  titleFa: z.string().trim().min(1).max(160),
  titleEn: z.string().trim().max(160).optional().nullable(),
  kind: z.enum(['public', 'religious', 'company']).optional(),
})

const adjustSchema = z.object({
  action: z.literal('adjust'),
  employeeId: z.number().int().positive(),
  leaveTypeId: z.number().int().positive(),
  days: z.number().min(-365).max(365),
  note: z.string().trim().max(300).optional().nullable(),
})

const accrueSchema = z.object({
  action: z.literal('accrue'),
  period: z.string().trim().regex(/^\d{4}-\d{2}$/),
})

const approveOtSchema = z.object({
  action: z.literal('approveOvertime'),
  id: z.number().int().positive(),
})

/** Leave data follows the personnel row scope — same rule, one definition. */
async function scopeFor(userId: string) {
  const { rowScopeSql } = await import('@/lib/rbac/data')
  return await rowScopeSql(userId, 'hr.employees', 'e.user_id', 1)
}

/** Is this employee visible to the caller? Out of scope answers 404, not 403. */
async function employeeVisible(userId: string, employeeId: number): Promise<boolean> {
  const row = (await pgQuery<{ user_id: string | null }>(
    `SELECT user_id FROM hr_employees WHERE id=$1`, [employeeId]))[0]
  if (!row) return false
  const { rowInScope } = await import('@/lib/rbac/data')
  return await rowInScope(userId, 'hr.employees', row.user_id)
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission('hr.leave', 'read')
    if ('error' in auth) return auth.error
    const sp = req.nextUrl.searchParams
    const view = sp.get('view') ?? 'requests'
    const employeeId = sp.get('employeeId') ? Number(sp.get('employeeId')) : undefined

    if (employeeId && !(await employeeVisible(auth.user.id, employeeId))) return notFound()

    if (view === 'types') return NextResponse.json({ types: await listLeaveTypes() })
    if (view === 'holidays') return NextResponse.json({ holidays: await listHolidays(sp.get('year') ?? undefined) })
    if (view === 'balances') {
      if (!employeeId) return badRequest('employeeId required')
      return NextResponse.json({
        balances: await leaveBalances(employeeId),
        ledger: await leaveLedger(employeeId),
      })
    }
    if (view === 'attendance') {
      if (!employeeId) return badRequest('employeeId required')
      const from = sp.get('from') ?? ''
      const to = sp.get('to') ?? ''
      if (!from || !to) return badRequest('from and to required')
      return NextResponse.json({
        attendance: await attendanceOf(employeeId, from, to),
        timesheet: await monthlyTimesheet(employeeId, from, to),
      })
    }
    if (view === 'missions') return NextResponse.json({ missions: await listMissions(employeeId) })

    const sc = await scopeFor(auth.user.id)
    return NextResponse.json({
      requests: await listLeaveRequests({
        employeeId, status: sp.get('status') ?? undefined,
        scopeClause: sc.clause, scopeParams: sc.params,
      }),
      types: await listLeaveTypes(),
      overview: await leaveOverview(),
    })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission('hr.leave', 'write', 'edit')
    if ('error' in auth) return auth.error
    const raw = await req.clone().json().catch(() => ({})) as { action?: string; employeeId?: number }
    const fa = isFa(req)

    if (typeof raw.employeeId === 'number' && !(await employeeVisible(auth.user.id, raw.employeeId))) {
      return notFound()
    }

    switch (raw.action) {
      case 'request': {
        const parsed = await readJson(req, requestSchema)
        if ('error' in parsed) return parsed.error
        const d = parsed.data
        const r = await runOnce(auth.user.id, 'hr/leave/request', d, () => createLeaveRequest(d, auth.user.id))
        if (!r.ok) {
          // Say WHY in the reader's language — "Failed" would send the employee
          // back to a form they cannot fix.
          return badRequest(leaveRefusalMessage(
            (r.reason ?? 'invalid_range') as NonNullable<LeaveCheck['reason']>, fa))
        }
        await logAction(auth.user, 'CREATE', 'hr_leave_requests', r.id!, null,
          { employeeId: d.employeeId, startDate: d.startDate, endDate: d.endDate, days: r.days })
        return NextResponse.json(r, { status: 201 })
      }

      case 'approve':
      case 'reject':
      case 'cancel': {
        const parsed = await readJson(req, decideSchema)
        if ('error' in parsed) return parsed.error
        const { id, action } = parsed.data
        const owner = (await pgQuery<{ employee_id: number }>(
          `SELECT employee_id FROM hr_leave_requests WHERE id=$1`, [id]))[0]
        if (!owner) return notFound()
        if (!(await employeeVisible(auth.user.id, owner.employee_id))) return notFound()
        // Deciding on a leave request is its own authority — `write` on the
        // module is not enough to approve or refuse someone's absence.
        if (action !== 'cancel') {
          const denied = await requireOp(auth.user, 'hr.leave:approve', 'edit')
          if (denied) return denied
        }

        const r = action === 'approve' ? await approveLeave(id, auth.user.id)
          : action === 'reject' ? await rejectLeave(id, auth.user.id)
            : await cancelLeave(id, auth.user.id)
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, 'UPDATE', 'hr_leave_requests', id, null, { action })
        return NextResponse.json(r)
      }

      case 'attendance': {
        const parsed = await readJson(req, attendanceSchema)
        if ('error' in parsed) return parsed.error
        const d = parsed.data
        const id = await recordAttendance(d, auth.user.id)
        await logAction(auth.user, 'UPDATE', 'hr_attendance', id, null, { employeeId: d.employeeId, date: d.date })
        return NextResponse.json({ id }, { status: 201 })
      }

      case 'overtime': {
        const parsed = await readJson(req, overtimeSchema)
        if ('error' in parsed) return parsed.error
        const d = parsed.data
        const id = await runOnce(auth.user.id, 'hr/leave/overtime', d, () => addOvertime(d, auth.user.id))
        await logAction(auth.user, 'CREATE', 'hr_overtime', id, null,
          { employeeId: d.employeeId, date: d.date, hours: d.hours, kind: d.kind })
        return NextResponse.json({ id }, { status: 201 })
      }

      case 'approveOvertime': {
        const parsed = await readJson(req, approveOtSchema)
        if ('error' in parsed) return parsed.error
        await approveOvertime(parsed.data.id)
        await logAction(auth.user, 'UPDATE', 'hr_overtime', parsed.data.id, null, { approved: true })
        return NextResponse.json({ ok: true })
      }

      case 'mission': {
        const parsed = await readJson(req, missionSchema)
        if ('error' in parsed) return parsed.error
        const d = parsed.data
        const id = await runOnce(auth.user.id, 'hr/leave/mission', d, () => createMission(d, auth.user.id))
        await logAction(auth.user, 'CREATE', 'hr_missions', id, null, d)
        return NextResponse.json({ id }, { status: 201 })
      }

      case 'holiday': {
        const parsed = await readJson(req, holidaySchema)
        if ('error' in parsed) return parsed.error
        const d = parsed.data
        const id = await runOnce(auth.user.id, 'hr/leave/holiday', d, () => addHoliday(d))
        await logAction(auth.user, 'CREATE', 'hr_holidays', id, null, d)
        return NextResponse.json({ id }, { status: 201 })
      }

      // A manual balance correction is an ADJUSTMENT ROW, never an edit of the
      // ledger — the reason for every day stays visible.
      case 'adjust': {
        const parsed = await readJson(req, adjustSchema)
        if ('error' in parsed) return parsed.error
        const d = parsed.data
        const denied = await requireOp(auth.user, 'hr.leave:adjust', 'manage_settings')
        if (denied) return denied
        const id = await postLeaveTransaction(d.employeeId, d.leaveTypeId, 'adjust', d.days, {
          note: d.note ?? undefined, userId: auth.user.id,
        })
        await logAction(auth.user, 'CREATE', 'hr_leave_transactions', id, null,
          { employeeId: d.employeeId, days: d.days, note: d.note })
        return NextResponse.json({ id }, { status: 201 })
      }

      case 'accrue': {
        const parsed = await readJson(req, accrueSchema)
        if ('error' in parsed) return parsed.error
        const r = await accrueMonthly(parsed.data.period, auth.user.id)
        await logAction(auth.user, 'CREATE', 'hr_leave_transactions', 0, null,
          { accrualPeriod: parsed.data.period, ...r })
        return NextResponse.json(r)
      }

      default:
        return badRequest('Unknown action')
    }
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission('hr.leave', 'write', 'delete')
    if ('error' in auth) return auth.error
    const body = await guardJson(req).catch(() => ({})) as { id?: number; kind?: string }
    if (!body.id || typeof body.id !== 'number') return badRequest('id required')
    if (body.kind !== 'holiday') return badRequest('Only holidays can be deleted; leave is cancelled, not erased')
    await deleteHoliday(body.id)
    await logAction(auth.user, 'DELETE', 'hr_holidays', body.id)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
