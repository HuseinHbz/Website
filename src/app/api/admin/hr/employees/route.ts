/**
 * Phase 28.1 — HR employees API.
 *
 * R8: this is the most sensitive data in the system. Three protections apply
 * together and none of them is a UI concern:
 *
 *  · row scope — a manager sees their team, an employee themselves, HR all;
 *    enforced in the WHERE, and an out-of-scope record answers 404 not 403
 *  · field scope — national id and bank details are ABSENT from the payload
 *    without `hr.employees:sensitive_view`
 *  · audit — reading a personnel file is itself recorded
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, guardJson, requirePermission, notFound } from '@/lib/api/respond'
import { runOnce } from '@/lib/api/idempotency'
import { logAction } from '@/lib/admin/audit'
import { sensitiveFieldVisible } from '@/lib/rbac/data'
import { CONTRACT_TYPES, EMPLOYEE_STATUSES, validateEmployee, normalizeMobile } from '@/lib/hr/employees'
import {
  listEmployees, createEmployee, updateEmployee, deleteEmployee, applySensitiveScope,
  employeeFile, employmentHistory, addEmploymentRecord, addDependent,
  listPositions, createPosition, hrOverview,
} from '@/lib/hr/employeeData'
import { pgQuery } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const employeeSchema = z.object({
  employeeCode: z.string().trim().max(32).optional(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  nationalId: z.string().trim().max(12).optional().nullable(),
  iban: z.string().trim().max(34).optional().nullable(),
  bankAccount: z.string().trim().max(34).optional().nullable(),
  insuranceNo: z.string().trim().max(32).optional().nullable(),
  birthDate: z.string().trim().max(24).optional().nullable(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional().nullable(),
  childrenCount: z.number().int().min(0).max(30).optional(),
  mobile: z.string().trim().max(24).optional().nullable(),
  email: z.string().trim().max(200).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  status: z.enum(EMPLOYEE_STATUSES).optional(),
  hireDate: z.string().trim().max(24).optional().nullable(),
  endDate: z.string().trim().max(24).optional().nullable(),
  departmentId: z.number().int().positive().optional().nullable(),
  userId: z.string().max(64).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
})

const updateSchema = employeeSchema.partial().extend({ id: z.number().int().positive() })

const employmentSchema = z.object({
  action: z.literal('employment'),
  employeeId: z.number().int().positive(),
  startDate: z.string().trim().min(4).max(24),
  baseSalary: z.number().min(0).max(1_000_000_000_000),
  contractType: z.enum(CONTRACT_TYPES),
  positionId: z.number().int().positive().optional().nullable(),
  managerId: z.number().int().positive().optional().nullable(),
  workLocation: z.string().trim().max(120).optional().nullable(),
  changeReason: z.string().trim().max(200).optional().nullable(),
})

const dependentSchema = z.object({
  action: z.literal('dependent'),
  employeeId: z.number().int().positive(),
  fullName: z.string().trim().min(1).max(120),
  relation: z.enum(['spouse', 'child', 'parent', 'other']),
  nationalId: z.string().trim().max(12).optional().nullable(),
  birthDate: z.string().trim().max(24).optional().nullable(),
})

const positionSchema = z.object({
  action: z.literal('position'),
  titleEn: z.string().trim().min(1).max(120),
  titleFa: z.string().trim().min(1).max(120),
  departmentId: z.number().int().positive().optional().nullable(),
  level: z.number().int().min(1).max(20).optional(),
})

const isFa = (req: NextRequest) => (req.headers.get('accept-language') ?? '').startsWith('fa')

/** Turn engine issues into a 400 that NAMES the field (26.29). */
function issues400(list: ReturnType<typeof validateEmployee>, fa: boolean) {
  const first = list[0]
  return badRequest(`${first.field}: ${fa ? first.fa : first.en}`)
}

async function scopeFor(userId: string) {
  const { rowScopeSql } = await import('@/lib/rbac/data')
  // An employee's own record is matched through the linked login.
  return await rowScopeSql(userId, 'hr.employees', 'e.user_id', 1)
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission('hr.employees', 'read')
    if ('error' in auth) return auth.error
    const sp = req.nextUrl.searchParams
    const canSeeSensitive = await sensitiveFieldVisible(auth.user.id, 'hr.employees:sensitive_view')
    const sc = await scopeFor(auth.user.id)

    if (sp.get('view') === 'positions') {
      return NextResponse.json({ positions: await listPositions() })
    }

    if (sp.get('id')) {
      const id = Number(sp.get('id'))
      // Scope first: an out-of-scope file must be indistinguishable from a
      // missing one, so existence is not leaked (26.25a pattern).
      const visible = await listEmployees({ scopeClause: sc.clause, scopeParams: sc.params })
      if (!visible.some(e => e.id === id)) return notFound()

      const file = await employeeFile(id, canSeeSensitive)
      if (!file) return notFound()
      // Opening a personnel file is itself worth recording.
      await logAction(auth.user, 'VIEW', 'hr_employees', id, null, { sensitive: canSeeSensitive })
      return NextResponse.json(file)
    }

    if (sp.get('employment')) {
      return NextResponse.json({ history: await employmentHistory(Number(sp.get('employment'))) })
    }

    const rows = await listEmployees({
      scopeClause: sc.clause, scopeParams: sc.params,
      status: sp.get('status') ?? undefined,
      search: sp.get('q') ?? undefined,
    })
    return NextResponse.json({
      employees: applySensitiveScope(rows as unknown as Record<string, unknown>[], canSeeSensitive),
      overview: await hrOverview(),
      canSeeSensitive,
    })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission('hr.employees', 'write', 'edit')
    if ('error' in auth) return auth.error
    const raw = await req.clone().json().catch(() => ({})) as { action?: string }
    const fa = isFa(req)

    if (raw.action === 'employment') {
      const parsed = await readJson(req, employmentSchema)
      if ('error' in parsed) return parsed.error
      const d = parsed.data
      const r = await runOnce(auth.user.id, 'hr/employment', d,
        () => addEmploymentRecord(d.employeeId, d, auth.user.id))
      // Salary is deliberately NOT written into the audit payload (privacy).
      await logAction(auth.user, 'CREATE', 'hr_employment', r.id, null,
        { employeeId: d.employeeId, startDate: d.startDate, contractType: d.contractType, changeReason: d.changeReason })
      return NextResponse.json(r, { status: 201 })
    }

    if (raw.action === 'dependent') {
      const parsed = await readJson(req, dependentSchema)
      if ('error' in parsed) return parsed.error
      const d = parsed.data
      const id = await runOnce(auth.user.id, 'hr/dependent', d, () => addDependent(d.employeeId, d))
      await logAction(auth.user, 'CREATE', 'hr_dependents', id, null, { employeeId: d.employeeId, relation: d.relation })
      return NextResponse.json({ id }, { status: 201 })
    }

    if (raw.action === 'position') {
      const parsed = await readJson(req, positionSchema)
      if ('error' in parsed) return parsed.error
      const d = parsed.data
      const id = await runOnce(auth.user.id, 'hr/position', d, () => createPosition(d))
      await logAction(auth.user, 'CREATE', 'hr_positions', id, null, d)
      return NextResponse.json({ id }, { status: 201 })
    }

    const parsed = await readJson(req, employeeSchema)
    if ('error' in parsed) return parsed.error
    const d = { ...parsed.data, mobile: parsed.data.mobile ? normalizeMobile(parsed.data.mobile) : null }
    const issues = validateEmployee(d)
    if (issues.length) return issues400(issues, fa)

    const id = await runOnce(auth.user.id, 'hr/employees', d, () => createEmployee(d, auth.user.id))
    // Never log the national id or bank details.
    await logAction(auth.user, 'CREATE', 'hr_employees', id, null,
      { employeeCode: d.employeeCode, firstName: d.firstName, lastName: d.lastName, status: d.status })
    return NextResponse.json({ id }, { status: 201 })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission('hr.employees', 'write', 'edit')
    if ('error' in auth) return auth.error
    const parsed = await readJson(req, updateSchema)
    if ('error' in parsed) return parsed.error
    const d = { ...parsed.data, mobile: parsed.data.mobile ? normalizeMobile(parsed.data.mobile) : undefined }
    const fa = isFa(req)

    const existing = (await pgQuery<{ user_id: string | null }>(
      `SELECT user_id FROM hr_employees WHERE id=$1`, [d.id]))[0]
    if (!existing) return notFound()
    const { rowInScope } = await import('@/lib/rbac/data')
    if (!(await rowInScope(auth.user.id, 'hr.employees', existing.user_id))) return notFound()

    const issues = validateEmployee(d, { requireIdentity: false })
    if (issues.length) return issues400(issues, fa)

    await updateEmployee(d.id, d)
    await logAction(auth.user, 'UPDATE', 'hr_employees', d.id, null,
      { fields: Object.keys(d).filter(k => k !== 'id' && !['nationalId', 'iban', 'bankAccount', 'insuranceNo'].includes(k)) })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission('hr.employees', 'write', 'delete')
    if ('error' in auth) return auth.error
    const { id } = await guardJson(req).catch(() => ({ id: undefined })) as { id?: number }
    if (!id || typeof id !== 'number') return badRequest('id required')
    const existing = (await pgQuery<{ user_id: string | null }>(
      `SELECT user_id FROM hr_employees WHERE id=$1`, [id]))[0]
    if (!existing) return notFound()
    const { rowInScope } = await import('@/lib/rbac/data')
    if (!(await rowInScope(auth.user.id, 'hr.employees', existing.user_id))) return notFound()
    await deleteEmployee(id)
    await logAction(auth.user, 'DELETE', 'hr_employees', id)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
