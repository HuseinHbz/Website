/**
 * Phase 28.5 بند ۲ — training API, riding on the existing academy `courses`
 * catalog (see trainingData.ts header for the audit finding).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, requirePermission, notFound } from '@/lib/api/respond'
import { runOnce } from '@/lib/api/idempotency'
import { logAction } from '@/lib/admin/audit'
import {
  listCourses, enrollEmployee, allEnrollments, trainingCoverage, completeEnrollment,
} from '@/lib/hr/trainingData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const enrollSchema = z.object({
  action: z.literal('enroll'),
  employeeId: z.number().int().positive(),
  courseId: z.number().int().positive(),
  mandatory: z.boolean().optional(),
})

const completeSchema = z.object({
  action: z.literal('complete'),
  employeeId: z.number().int().positive(),
  enrollmentId: z.number().int().positive(),
  score: z.number().min(0).max(100).optional().nullable(),
})

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission('hr.training', 'read', 'edit')
    if ('error' in auth) return auth.error
    const view = req.nextUrl.searchParams.get('view') ?? 'enrollments'
    if (view === 'courses') return NextResponse.json({ courses: await listCourses() })
    if (view === 'coverage') return NextResponse.json({ coverage: await trainingCoverage() })
    return NextResponse.json({ enrollments: await allEnrollments() })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission('hr.training', 'write', 'edit')
    if ('error' in auth) return auth.error
    const raw = await req.clone().json().catch(() => ({})) as { action?: string }

    switch (raw.action) {
      case 'enroll': {
        const parsed = await readJson(req, enrollSchema)
        if ('error' in parsed) return parsed.error
        const { action: _a, ...d } = parsed.data
        const r = await runOnce(auth.user.id, 'hr/training/enroll', d, () => enrollEmployee(d))
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, 'CREATE', 'hr_training_enrollments', r.id!, null, d)
        return NextResponse.json(r, { status: 201 })
      }
      case 'complete': {
        const parsed = await readJson(req, completeSchema)
        if ('error' in parsed) return parsed.error
        const { employeeId, enrollmentId, score } = parsed.data
        const r = await completeEnrollment(employeeId, enrollmentId, score)
        if (!r.ok) return notFound()
        await logAction(auth.user, 'UPDATE', 'hr_training_enrollments', enrollmentId, null, { completed: true, score })
        return NextResponse.json(r)
      }
      default:
        return badRequest('Unknown action')
    }
  } catch (e: unknown) {
    return apiError(e)
  }
}
