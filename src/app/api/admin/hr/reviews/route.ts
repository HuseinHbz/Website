/**
 * Phase 28.5 بند ۳ — performance review API.
 *
 * 🔴 Row scope: an employee sees only their own review (via the portal, not
 * this admin route); a MANAGER (an admin user whose linked `hr_employees`
 * row is another employee's `manager_id`) sees only their direct reports'
 * reviews; HR (the `hr.reviews:finalize` op or a legacy edit role) sees all.
 *
 * 🔴 Append-only: `finalizeReview` is the only path that closes a review, and
 * a finalized review can never be resubmitted — a correction is a new cycle.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, requirePermission, requireOp, notFound } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import {
  reviewDataGate, listCycles, createCycle, openCycle, closeCycle,
  listTemplates, createTemplate, createReview, submitReview, finalizeReview,
  reviewsForCycle, reviewsForManager,
} from '@/lib/hr/reviewData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const cycleSchema = z.object({
  action: z.literal('cycle'), nameFa: z.string().trim().min(1).max(200), nameEn: z.string().trim().max(200).optional().nullable(),
  period: z.string().trim().min(1).max(40), startDate: z.string().trim().min(4).max(24), endDate: z.string().trim().min(4).max(24),
})
const cycleStatusSchema = z.object({ action: z.enum(['openCycle', 'closeCycle']), id: z.number().int().positive() })
const templateSchema = z.object({
  action: z.literal('template'), nameFa: z.string().trim().min(1).max(200), nameEn: z.string().trim().max(200).optional().nullable(),
  criteria: z.array(z.object({ key: z.string().min(1).max(60), labelFa: z.string().min(1).max(120), weight: z.number().min(0).max(100) })).max(30),
})
const createReviewSchema = z.object({
  action: z.literal('createReview'), cycleId: z.number().int().positive(), employeeId: z.number().int().positive(),
  reviewerId: z.number().int().positive().optional().nullable(), templateId: z.number().int().positive().optional().nullable(),
  kind: z.enum(['self', 'manager', 'peer', 'review_360']).optional(),
})
const submitSchema = z.object({
  action: z.literal('submit'), id: z.number().int().positive(), scores: z.record(z.string(), z.number().min(0).max(100)), note: z.string().trim().max(2000).optional().nullable(),
})
const finalizeSchema = z.object({ action: z.literal('finalize'), id: z.number().int().positive() })

/** The admin user's own hr_employees.id, if linked — needed for manager row-scope. */
async function actingEmployeeId(userId: string): Promise<number | null> {
  const row = (await pgQuery<{ id: number }>(`SELECT id FROM hr_employees WHERE user_id=$1`, [userId]))[0]
  return row?.id ?? null
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission('hr.reviews', 'read', 'edit')
    if ('error' in auth) return auth.error
    const sp = req.nextUrl.searchParams
    const view = sp.get('view') ?? 'cycles'

    if (view === 'gate') return NextResponse.json({ gate: await reviewDataGate() })
    if (view === 'cycles') return NextResponse.json({ cycles: await listCycles() })
    if (view === 'templates') return NextResponse.json({ templates: await listTemplates() })
    if (view === 'reviews') {
      const cycleId = sp.get('cycleId') ? Number(sp.get('cycleId')) : null
      if (!cycleId) return badRequest('cycleId required')
      // 🔴 row scope: without the finalize op (HR), only see the reviews of
      // employees who report to the caller's own hr_employees record.
      const deniedFinalize = await requireOp(auth.user, 'hr.reviews:finalize', 'manage_settings')
      if (!deniedFinalize) return NextResponse.json({ reviews: await reviewsForCycle(cycleId) })
      const empId = await actingEmployeeId(auth.user.id)
      if (!empId) return NextResponse.json({ reviews: [] })
      const mine = (await reviewsForManager(empId)).filter(r => r.cycleId === cycleId)
      return NextResponse.json({ reviews: mine })
    }
    return NextResponse.json({ cycles: await listCycles() })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission('hr.reviews', 'write', 'edit')
    if ('error' in auth) return auth.error
    const raw = await req.clone().json().catch(() => ({})) as { action?: string }

    switch (raw.action) {
      case 'cycle': {
        const parsed = await readJson(req, cycleSchema)
        if ('error' in parsed) return parsed.error
        const { action: _a, ...d } = parsed.data
        const id = await createCycle(d)
        await logAction(auth.user, 'CREATE', 'hr_review_cycles', id, null, { period: d.period })
        return NextResponse.json({ id }, { status: 201 })
      }
      case 'openCycle': case 'closeCycle': {
        const parsed = await readJson(req, cycleStatusSchema)
        if ('error' in parsed) return parsed.error
        if (parsed.data.action === 'openCycle') await openCycle(parsed.data.id)
        else await closeCycle(parsed.data.id)
        await logAction(auth.user, 'UPDATE', 'hr_review_cycles', parsed.data.id, null, { action: parsed.data.action })
        return NextResponse.json({ ok: true })
      }
      case 'template': {
        const parsed = await readJson(req, templateSchema)
        if ('error' in parsed) return parsed.error
        const { action: _a, ...d } = parsed.data
        const id = await createTemplate(d)
        await logAction(auth.user, 'CREATE', 'hr_review_templates', id, null, { nameFa: d.nameFa })
        return NextResponse.json({ id }, { status: 201 })
      }
      case 'createReview': {
        const parsed = await readJson(req, createReviewSchema)
        if ('error' in parsed) return parsed.error
        const { action: _a, ...d } = parsed.data
        // 🔴 row scope: a manager may only initiate a review for their own report.
        const deniedFinalize = await requireOp(auth.user, 'hr.reviews:finalize', 'manage_settings')
        if (deniedFinalize) {
          const empId = await actingEmployeeId(auth.user.id)
          const isMyReport = empId ? (await pgQuery<{ n: string }>(
            `SELECT COUNT(*)::text AS n FROM hr_employment h WHERE h.employee_id=$1 AND h.end_date IS NULL AND h.manager_id=$2`,
            [d.employeeId, empId]))[0] : { n: '0' }
          if (!empId || Number(isMyReport.n) === 0) return notFound()
        }
        const id = await createReview(d)
        await logAction(auth.user, 'CREATE', 'hr_reviews', id, null, { cycleId: d.cycleId, employeeId: d.employeeId })
        return NextResponse.json({ id }, { status: 201 })
      }
      case 'submit': {
        const parsed = await readJson(req, submitSchema)
        if ('error' in parsed) return parsed.error
        const r = await submitReview(parsed.data.id, parsed.data.scores, parsed.data.note)
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        // 🔴 scores/notes are sensitive — the identifiers only in the log, never the values.
        await logAction(auth.user, 'UPDATE', 'hr_reviews', parsed.data.id, null, { submitted: true })
        return NextResponse.json(r)
      }
      case 'finalize': {
        const parsed = await readJson(req, finalizeSchema)
        if ('error' in parsed) return parsed.error
        const denied = await requireOp(auth.user, 'hr.reviews:finalize', 'manage_settings')
        if (denied) return denied
        const r = await finalizeReview(parsed.data.id)
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, 'UPDATE', 'hr_reviews', parsed.data.id, null, { finalized: true })
        return NextResponse.json(r)
      }
      default:
        return badRequest('Unknown action')
    }
  } catch (e: unknown) {
    return apiError(e)
  }
}
