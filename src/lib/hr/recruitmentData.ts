/**
 * Phase 28.5 بند ۱ — recruitment server layer.
 *
 * "Candidate → employee" is written through the SAME 28.1 path
 * (`createEmployee` + `addEmploymentRecord`), never a parallel insert, and the
 * candidate row keeps a two-way link (`converted_employee_id`) so the hire
 * decision stays traceable to its source application.
 */
import { pgQuery } from '@/lib/db'
import { createEmployee, addEmploymentRecord } from './employeeData'
import { canTransition, type ApplicationStage } from './recruitment'
import type { ContractType } from './employees'

const NOW = `to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`

// ── openings ─────────────────────────────────────────────────────────────
export async function listOpenings(status?: string) {
  const where = status ? `WHERE status=$1` : ''
  return await pgQuery<{ id: number; titleFa: string; titleEn: string | null; positionId: number | null; headcount: number; status: string; opensAt: string | null; closesAt: string | null; applicants: number }>(
    `SELECT o.id, o.title_fa AS "titleFa", o.title_en AS "titleEn", o.position_id AS "positionId",
            o.headcount, o.status, o.opens_at AS "opensAt", o.closes_at AS "closesAt",
            (SELECT COUNT(*)::int FROM hr_applications a WHERE a.opening_id=o.id) AS applicants
     FROM hr_job_openings o ${where} ORDER BY o.id DESC`,
    status ? [status] : [])
}

export async function createOpening(d: {
  titleFa: string; titleEn?: string | null; positionId?: number | null; departmentId?: number | null
  description?: string | null; requirements?: string | null; headcount?: number; opensAt?: string | null; closesAt?: string | null
}, userId: string | null): Promise<number> {
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO hr_job_openings (title_fa, title_en, position_id, department_id, description, requirements, headcount, opens_at, closes_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [d.titleFa, d.titleEn ?? null, d.positionId ?? null, d.departmentId ?? null, d.description ?? null,
      d.requirements ?? null, d.headcount ?? 1, d.opensAt ?? null, d.closesAt ?? null, userId]))[0]
  return row.id
}

export async function setOpeningStatus(id: number, status: 'open' | 'closed' | 'cancelled') {
  await pgQuery(`UPDATE hr_job_openings SET status=$2, updated_at=${NOW} WHERE id=$1`, [id, status])
}

// ── candidates ───────────────────────────────────────────────────────────
export async function listCandidates(opts: { status?: string; search?: string } = {}) {
  const params: unknown[] = []
  let where = '1=1'
  if (opts.status) { params.push(opts.status); where += ` AND status=$${params.length}` }
  if (opts.search) { params.push(`%${opts.search}%`); where += ` AND (full_name ILIKE $${params.length} OR mobile ILIKE $${params.length})` }
  return await pgQuery<{ id: number; fullName: string; mobile: string | null; email: string | null; source: string; status: string; convertedEmployeeId: number | null }>(
    `SELECT id, full_name AS "fullName", mobile, email, source, status, converted_employee_id AS "convertedEmployeeId"
     FROM hr_candidates WHERE ${where} ORDER BY id DESC`, params)
}

export async function createCandidate(d: {
  fullName: string; mobile?: string | null; email?: string | null; resumeMediaId?: number | null; source?: string
}): Promise<number> {
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO hr_candidates (full_name, mobile, email, resume_media_id, source)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [d.fullName, d.mobile ?? null, d.email ?? null, d.resumeMediaId ?? null, d.source ?? 'site']))[0]
  return row.id
}

// ── applications (kanban) ───────────────────────────────────────────────
export async function listApplications(openingId?: number) {
  const where = openingId ? `WHERE a.opening_id=$1` : ''
  return await pgQuery<{
    id: number; candidateId: number; candidateName: string; openingId: number; openingTitle: string
    stage: ApplicationStage; note: string | null
  }>(
    `SELECT a.id, a.candidate_id AS "candidateId", c.full_name AS "candidateName",
            a.opening_id AS "openingId", o.title_fa AS "openingTitle", a.stage, a.note
     FROM hr_applications a
     JOIN hr_candidates c ON c.id = a.candidate_id
     JOIN hr_job_openings o ON o.id = a.opening_id
     ${where} ORDER BY a.id DESC`,
    openingId ? [openingId] : [])
}

export async function createApplication(candidateId: number, openingId: number): Promise<number> {
  await pgQuery(`UPDATE hr_candidates SET status='in_process' WHERE id=$1 AND status='new'`, [candidateId])
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO hr_applications (candidate_id, opening_id) VALUES ($1,$2) RETURNING id`,
    [candidateId, openingId]))[0]
  return row.id
}

/** Move an application to a new pipeline stage — the kanban's drop handler. */
export async function moveApplication(id: number, next: ApplicationStage): Promise<{ ok: boolean; error?: string }> {
  const row = (await pgQuery<{ stage: ApplicationStage; candidate_id: number }>(
    `SELECT stage, candidate_id FROM hr_applications WHERE id=$1`, [id]))[0]
  if (!row) return { ok: false, error: 'Application not found' }
  if (!canTransition(row.stage, next)) return { ok: false, error: `Cannot move from ${row.stage} to ${next}` }
  await pgQuery(`UPDATE hr_applications SET stage=$2, updated_at=${NOW} WHERE id=$1`, [id, next])
  if (next === 'rejected') await pgQuery(`UPDATE hr_candidates SET status='rejected' WHERE id=$1`, [row.candidate_id])
  return { ok: true }
}

// ── interviews ───────────────────────────────────────────────────────────
export async function listInterviews(opts: { applicationId?: number; interviewerScopeUserId?: string | null } = {}) {
  const params: unknown[] = []
  let where = '1=1'
  if (opts.applicationId) { params.push(opts.applicationId); where += ` AND i.application_id=$${params.length}` }
  if (opts.interviewerScopeUserId) { params.push(opts.interviewerScopeUserId); where += ` AND i.interviewer_id=$${params.length}` }
  return await pgQuery<{ id: number; applicationId: number; kind: string; scheduledAt: string | null; interviewerId: string | null; score: number | null; note: string | null; result: string }>(
    `SELECT i.id, i.application_id AS "applicationId", i.kind, i.scheduled_at AS "scheduledAt",
            i.interviewer_id AS "interviewerId", i.score, i.note, i.result
     FROM hr_interviews i WHERE ${where} ORDER BY i.id DESC`, params)
}

export async function scheduleInterview(d: {
  applicationId: number; kind?: string; scheduledAt?: string | null; interviewerId?: string | null
}): Promise<number> {
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO hr_interviews (application_id, kind, scheduled_at, interviewer_id)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [d.applicationId, d.kind ?? 'online', d.scheduledAt ?? null, d.interviewerId ?? null]))[0]
  return row.id
}

/** Record an interview result — only the interviewer of record or HR may call this (route-enforced). */
export async function recordInterviewResult(id: number, d: { score?: number | null; note?: string | null; result: 'pass' | 'fail' }) {
  await pgQuery(`UPDATE hr_interviews SET score=$2, note=$3, result=$4 WHERE id=$1`,
    [id, d.score ?? null, d.note ?? null, d.result])
}

// ── offers ───────────────────────────────────────────────────────────────
export async function listOffers(applicationId?: number) {
  const where = applicationId ? `WHERE application_id=$1` : ''
  return await pgQuery<{ id: number; applicationId: number; proposedSalary: number; startDate: string | null; status: string }>(
    `SELECT id, application_id AS "applicationId", proposed_salary::float AS "proposedSalary", start_date AS "startDate", status
     FROM hr_offers ${where} ORDER BY id DESC`, applicationId ? [applicationId] : [])
}

export async function createOffer(d: { applicationId: number; proposedSalary: number; startDate?: string | null }, approvedBy: string | null): Promise<number> {
  await pgQuery(`UPDATE hr_applications SET stage='offer', updated_at=${NOW} WHERE id=$1`, [d.applicationId])
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO hr_offers (application_id, proposed_salary, start_date, approved_by)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [d.applicationId, d.proposedSalary, d.startDate ?? null, approvedBy]))[0]
  return row.id
}

export async function decideOffer(id: number, status: 'accepted' | 'rejected' | 'expired') {
  await pgQuery(`UPDATE hr_offers SET status=$2, updated_at=${NOW} WHERE id=$1`, [id, status])
}

/**
 * 🔴 The candidate → employee conversion. Reuses the EXACT 28.1 path
 * (`createEmployee` then `addEmploymentRecord`) — no parallel insert. Wrapped
 * by the route in `runOnce` so a double-click cannot hire the same candidate
 * twice; this function additionally refuses on its own if already converted
 * (idempotent at the data layer too, not just the request-fingerprint layer).
 */
export async function hireFromApplication(
  applicationId: number,
  d: { hireDate: string; baseSalary: number; contractType: ContractType; positionId?: number | null; managerId?: number | null; departmentId?: number | null },
  userId: string,
): Promise<{ ok: boolean; employeeId?: number; error?: string }> {
  const app = (await pgQuery<{ candidate_id: number; stage: ApplicationStage }>(
    `SELECT candidate_id, stage FROM hr_applications WHERE id=$1`, [applicationId]))[0]
  if (!app) return { ok: false, error: 'Application not found' }
  const candidate = (await pgQuery<{ id: number; full_name: string; mobile: string | null; email: string | null; converted_employee_id: number | null }>(
    `SELECT id, full_name, mobile, email, converted_employee_id FROM hr_candidates WHERE id=$1`, [app.candidate_id]))[0]
  if (!candidate) return { ok: false, error: 'Candidate not found' }
  if (candidate.converted_employee_id) return { ok: true, employeeId: candidate.converted_employee_id } // idempotent

  const [firstName, ...rest] = candidate.full_name.trim().split(/\s+/)
  const employeeId = await createEmployee({
    firstName: firstName || candidate.full_name,
    lastName: rest.join(' ') || '-',
    mobile: candidate.mobile,
    email: candidate.email,
    hireDate: d.hireDate,
    departmentId: d.departmentId ?? null,
    status: 'active',
  }, userId)
  await addEmploymentRecord(employeeId, {
    startDate: d.hireDate, baseSalary: d.baseSalary, contractType: d.contractType,
    positionId: d.positionId ?? null, managerId: d.managerId ?? null, changeReason: 'hire',
  }, userId)

  await pgQuery(`UPDATE hr_candidates SET status='hired', converted_employee_id=$2, updated_at=${NOW} WHERE id=$1`,
    [candidate.id, employeeId])
  await pgQuery(`UPDATE hr_applications SET stage='hired', updated_at=${NOW} WHERE id=$1`, [applicationId])
  return { ok: true, employeeId }
}

export async function recruitmentOverview() {
  const openings = (await pgQuery<{ n: string }>(`SELECT COUNT(*)::text AS n FROM hr_job_openings WHERE status='open'`))[0]
  const candidates = (await pgQuery<{ n: string }>(`SELECT COUNT(*)::text AS n FROM hr_candidates WHERE status IN ('new','in_process')`))[0]
  const hiredThisYear = (await pgQuery<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM hr_candidates WHERE status='hired' AND updated_at >= date_trunc('year', now())::text`))[0]
  return { openOpenings: Number(openings.n), activeCandidates: Number(candidates.n), hiredThisYear: Number(hiredThisYear.n) }
}
