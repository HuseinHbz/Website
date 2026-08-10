/**
 * Phase 28.5 بند ۱ — recruitment API (openings → candidates → kanban
 * applications → interviews → offer → hire).
 *
 * 🔴 `hire` reuses the exact 28.1 employee-creation path
 * (`hireFromApplication`) wrapped in `runOnce` — a double-click on "Hire"
 * creates exactly one employee, not two.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, requirePermission, requireOp, notFound } from '@/lib/api/respond'
import { runOnce } from '@/lib/api/idempotency'
import { logAction } from '@/lib/admin/audit'
import { CONTRACT_TYPES } from '@/lib/hr/employees'
import {
  listOpenings, createOpening, setOpeningStatus,
  listCandidates, createCandidate,
  listApplications, createApplication, moveApplication,
  listInterviews, scheduleInterview, recordInterviewResult,
  listOffers, createOffer, decideOffer,
  hireFromApplication, recruitmentOverview,
} from '@/lib/hr/recruitmentData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const openingSchema = z.object({
  action: z.literal('opening'),
  titleFa: z.string().trim().min(1).max(200),
  titleEn: z.string().trim().max(200).optional().nullable(),
  positionId: z.number().int().positive().optional().nullable(),
  departmentId: z.number().int().positive().optional().nullable(),
  description: z.string().trim().max(4000).optional().nullable(),
  requirements: z.string().trim().max(4000).optional().nullable(),
  headcount: z.number().int().min(1).max(1000).optional(),
  opensAt: z.string().trim().max(24).optional().nullable(),
  closesAt: z.string().trim().max(24).optional().nullable(),
})

const openingStatusSchema = z.object({
  action: z.literal('openingStatus'), id: z.number().int().positive(),
  status: z.enum(['open', 'closed', 'cancelled']),
})

const candidateSchema = z.object({
  action: z.literal('candidate'),
  fullName: z.string().trim().min(1).max(200),
  mobile: z.string().trim().max(20).optional().nullable(),
  email: z.string().trim().max(200).optional().nullable(),
  resumeMediaId: z.number().int().positive().optional().nullable(),
  source: z.enum(['site', 'referral', 'agency', 'other']).optional(),
})

const applicationSchema = z.object({
  action: z.literal('application'),
  candidateId: z.number().int().positive(),
  openingId: z.number().int().positive(),
})

const moveSchema = z.object({
  action: z.literal('move'), id: z.number().int().positive(),
  stage: z.enum(['screening', 'interview_1', 'interview_2', 'offer', 'rejected', 'hired']),
})

const interviewSchema = z.object({
  action: z.literal('interview'),
  applicationId: z.number().int().positive(),
  kind: z.enum(['onsite', 'online', 'phone']).optional(),
  scheduledAt: z.string().trim().max(24).optional().nullable(),
  interviewerId: z.string().trim().max(64).optional().nullable(),
})

const interviewResultSchema = z.object({
  action: z.literal('interviewResult'), id: z.number().int().positive(),
  score: z.number().min(0).max(100).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
  result: z.enum(['pass', 'fail']),
})

const offerSchema = z.object({
  action: z.literal('offer'),
  applicationId: z.number().int().positive(),
  proposedSalary: z.number().min(0).max(1_000_000_000_000),
  startDate: z.string().trim().max(24).optional().nullable(),
})

const offerDecisionSchema = z.object({
  action: z.literal('offerDecision'), id: z.number().int().positive(),
  status: z.enum(['accepted', 'rejected', 'expired']),
})

const hireSchema = z.object({
  action: z.literal('hire'),
  applicationId: z.number().int().positive(),
  hireDate: z.string().trim().min(4).max(24),
  baseSalary: z.number().min(0).max(1_000_000_000_000),
  contractType: z.enum(CONTRACT_TYPES),
  positionId: z.number().int().positive().optional().nullable(),
  managerId: z.number().int().positive().optional().nullable(),
  departmentId: z.number().int().positive().optional().nullable(),
})

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission('hr.recruitment', 'read', 'edit')
    if ('error' in auth) return auth.error
    const sp = req.nextUrl.searchParams
    const view = sp.get('view') ?? 'overview'

    if (view === 'openings') return NextResponse.json({ openings: await listOpenings(sp.get('status') ?? undefined) })
    if (view === 'candidates') return NextResponse.json({ candidates: await listCandidates({ status: sp.get('status') ?? undefined, search: sp.get('search') ?? undefined }) })
    if (view === 'applications') {
      const openingId = sp.get('openingId') ? Number(sp.get('openingId')) : undefined
      return NextResponse.json({ applications: await listApplications(openingId) })
    }
    if (view === 'interviews') {
      const applicationId = sp.get('applicationId') ? Number(sp.get('applicationId')) : undefined
      // 🔴 row scope: someone without the hire/offer authority (a plain
      // interviewer, not HR) sees only interviews assigned to them.
      const deniedHireOp = await requireOp(auth.user, 'hr.recruitment:hire', 'manage_settings')
      const interviewerScope = deniedHireOp ? auth.user.id : null
      return NextResponse.json({ interviews: await listInterviews({ applicationId, interviewerScopeUserId: interviewerScope }) })
    }
    if (view === 'offers') {
      const applicationId = sp.get('applicationId') ? Number(sp.get('applicationId')) : undefined
      return NextResponse.json({ offers: await listOffers(applicationId) })
    }
    return NextResponse.json({ overview: await recruitmentOverview() })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission('hr.recruitment', 'write', 'edit')
    if ('error' in auth) return auth.error
    const raw = await req.clone().json().catch(() => ({})) as { action?: string }

    switch (raw.action) {
      case 'opening': {
        const parsed = await readJson(req, openingSchema)
        if ('error' in parsed) return parsed.error
        const { action: _a, ...d } = parsed.data
        const id = await runOnce(auth.user.id, 'hr/recruitment/opening', d, () => createOpening(d, auth.user.id))
        await logAction(auth.user, 'CREATE', 'hr_job_openings', id, null, { titleFa: d.titleFa })
        return NextResponse.json({ id }, { status: 201 })
      }
      case 'openingStatus': {
        const parsed = await readJson(req, openingStatusSchema)
        if ('error' in parsed) return parsed.error
        await setOpeningStatus(parsed.data.id, parsed.data.status)
        await logAction(auth.user, 'UPDATE', 'hr_job_openings', parsed.data.id, null, { status: parsed.data.status })
        return NextResponse.json({ ok: true })
      }
      case 'candidate': {
        const parsed = await readJson(req, candidateSchema)
        if ('error' in parsed) return parsed.error
        const { action: _a, ...d } = parsed.data
        const id = await runOnce(auth.user.id, 'hr/recruitment/candidate', d, () => createCandidate(d))
        // 🔴 R8 — resume access is audited, never just a silent read.
        await logAction(auth.user, 'CREATE', 'hr_candidates', id, null, { fullName: d.fullName, source: d.source })
        return NextResponse.json({ id }, { status: 201 })
      }
      case 'application': {
        const parsed = await readJson(req, applicationSchema)
        if ('error' in parsed) return parsed.error
        const d = parsed.data
        const id = await runOnce(auth.user.id, 'hr/recruitment/application', d, () => createApplication(d.candidateId, d.openingId))
        await logAction(auth.user, 'CREATE', 'hr_applications', id, null, d)
        return NextResponse.json({ id }, { status: 201 })
      }
      case 'move': {
        const parsed = await readJson(req, moveSchema)
        if ('error' in parsed) return parsed.error
        const r = await moveApplication(parsed.data.id, parsed.data.stage)
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, 'UPDATE', 'hr_applications', parsed.data.id, null, { stage: parsed.data.stage })
        return NextResponse.json(r)
      }
      case 'interview': {
        const parsed = await readJson(req, interviewSchema)
        if ('error' in parsed) return parsed.error
        const { action: _a, ...d } = parsed.data
        const id = await runOnce(auth.user.id, 'hr/recruitment/interview', d, () => scheduleInterview(d))
        await logAction(auth.user, 'CREATE', 'hr_interviews', id, null, { applicationId: d.applicationId })
        return NextResponse.json({ id }, { status: 201 })
      }
      case 'interviewResult': {
        const parsed = await readJson(req, interviewResultSchema)
        if ('error' in parsed) return parsed.error
        const { id, ...d } = parsed.data
        // 🔴 row scope — only the assigned interviewer or an HR administrator may record a result.
        const row = (await listInterviews({})).find(i => i.id === id)
        if (!row) return notFound()
        const isOwnInterview = row.interviewerId === auth.user.id
        if (!isOwnInterview) {
          const denied = await requireOp(auth.user, 'hr.recruitment:hire', 'manage_settings')
          if (denied) return denied
        }
        await recordInterviewResult(id, d)
        await logAction(auth.user, 'UPDATE', 'hr_interviews', id, null, { result: d.result })
        return NextResponse.json({ ok: true })
      }
      case 'offer': {
        const parsed = await readJson(req, offerSchema)
        if ('error' in parsed) return parsed.error
        const denied = await requireOp(auth.user, 'hr.recruitment:offer', 'manage_settings')
        if (denied) return denied
        const { action: _a, ...d } = parsed.data
        const id = await runOnce(auth.user.id, 'hr/recruitment/offer', d, () => createOffer(d, auth.user.id))
        await logAction(auth.user, 'CREATE', 'hr_offers', id, null, { applicationId: d.applicationId, proposedSalary: d.proposedSalary })
        return NextResponse.json({ id }, { status: 201 })
      }
      case 'offerDecision': {
        const parsed = await readJson(req, offerDecisionSchema)
        if ('error' in parsed) return parsed.error
        await decideOffer(parsed.data.id, parsed.data.status)
        await logAction(auth.user, 'UPDATE', 'hr_offers', parsed.data.id, null, { status: parsed.data.status })
        return NextResponse.json({ ok: true })
      }
      case 'hire': {
        const parsed = await readJson(req, hireSchema)
        if ('error' in parsed) return parsed.error
        const denied = await requireOp(auth.user, 'hr.recruitment:hire', 'manage_settings')
        if (denied) return denied
        const { action: _a, applicationId, ...d } = parsed.data
        const r = await runOnce(auth.user.id, 'hr/recruitment/hire', { applicationId }, () => hireFromApplication(applicationId, d, auth.user.id))
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, 'CREATE', 'hr_employees', r.employeeId!, null, { source: 'recruitment', applicationId })
        return NextResponse.json(r, { status: 201 })
      }
      default:
        return badRequest('Unknown action')
    }
  } catch (e: unknown) {
    return apiError(e)
  }
}
