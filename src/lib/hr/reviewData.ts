/**
 * Phase 28.5 بند ۳ — performance review server layer.
 *
 * 🔴 Append-only history: `hr_reviews` rows are never edited after
 * `status='finalized'` — a correction is a NEW cycle, the exact 28.1
 * employment-history discipline applied to review scores.
 *
 * 🔴 Row scope: an employee sees only their own reviews (portal), a manager
 * only their direct reports' (`hr_employment.manager_id`), HR sees all.
 */
import { pgQuery } from '@/lib/db'

const NOW = `to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`

/**
 * The بند ۳ data gate. Performance review only means something once a real
 * management chain exists — 27's caution about an ungrounded feature applied
 * to HR: an OKR dashboard over five blank manager_id columns is a number a
 * manager will trust, and a wrong number is worse than a missing feature.
 */
export async function reviewDataGate(): Promise<{ ready: boolean; activeEmployees: number; withManager: number; coveragePct: number; threshold: number }> {
  const row = (await pgQuery<{ total: string; withMgr: string }>(
    `SELECT COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE EXISTS (
              SELECT 1 FROM hr_employment h WHERE h.employee_id=e.id AND h.end_date IS NULL AND h.manager_id IS NOT NULL
            ))::text AS "withMgr"
     FROM hr_employees e WHERE e.status='active'`))[0]
  const total = Number(row.total)
  const withMgr = Number(row.withMgr)
  const coveragePct = total === 0 ? 0 : Math.round((withMgr / total) * 1000) / 10
  const threshold = 50 // at least half of active employees need a real manager on file
  return { ready: total > 0 && coveragePct >= threshold, activeEmployees: total, withManager: withMgr, coveragePct, threshold }
}

// ── cycles & templates ──────────────────────────────────────────────────
export async function listCycles() {
  return await pgQuery<{ id: number; nameFa: string; nameEn: string | null; period: string; startDate: string; endDate: string; status: string }>(
    `SELECT id, name_fa AS "nameFa", name_en AS "nameEn", period, start_date AS "startDate", end_date AS "endDate", status
     FROM hr_review_cycles ORDER BY id DESC`)
}

export async function createCycle(d: { nameFa: string; nameEn?: string | null; period: string; startDate: string; endDate: string }): Promise<number> {
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO hr_review_cycles (name_fa, name_en, period, start_date, end_date) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [d.nameFa, d.nameEn ?? null, d.period, d.startDate, d.endDate]))[0]
  return row.id
}

export async function openCycle(id: number) { await pgQuery(`UPDATE hr_review_cycles SET status='open' WHERE id=$1`, [id]) }
export async function closeCycle(id: number) { await pgQuery(`UPDATE hr_review_cycles SET status='closed' WHERE id=$1`, [id]) }

export async function listTemplates() {
  return await pgQuery<{ id: number; nameFa: string; nameEn: string | null; criteria: unknown[] }>(
    `SELECT id, name_fa AS "nameFa", name_en AS "nameEn", criteria_json AS criteria FROM hr_review_templates WHERE active=1 ORDER BY id`)
    .then(rows => rows.map(r => ({ ...r, criteria: JSON.parse((r.criteria as unknown as string) || '[]') })))
}

export async function createTemplate(d: { nameFa: string; nameEn?: string | null; criteria: { key: string; labelFa: string; weight: number }[] }): Promise<number> {
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO hr_review_templates (name_fa, name_en, criteria_json) VALUES ($1,$2,$3) RETURNING id`,
    [d.nameFa, d.nameEn ?? null, JSON.stringify(d.criteria)]))[0]
  return row.id
}

// ── reviews ──────────────────────────────────────────────────────────────
function overallFromScores(scores: Record<string, number>, criteria: { key: string; weight: number }[]): number {
  if (criteria.length === 0) {
    const vals = Object.values(scores)
    return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : 0
  }
  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0) || 1
  const weighted = criteria.reduce((s, c) => s + (scores[c.key] ?? 0) * c.weight, 0)
  return Math.round((weighted / totalWeight) * 100) / 100
}

export async function createReview(d: {
  cycleId: number; employeeId: number; reviewerId?: number | null; templateId?: number | null
  kind?: 'self' | 'manager' | 'peer' | 'review_360'
}): Promise<number> {
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO hr_reviews (cycle_id, employee_id, reviewer_id, template_id, kind)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [d.cycleId, d.employeeId, d.reviewerId ?? null, d.templateId ?? null, d.kind ?? 'manager']))[0]
  return row.id
}

/** Submit scores — allowed only while draft/submitted, never after finalization. */
export async function submitReview(id: number, scores: Record<string, number>, note?: string | null): Promise<{ ok: boolean; error?: string }> {
  const row = (await pgQuery<{ status: string; template_id: number | null }>(
    `SELECT status, template_id FROM hr_reviews WHERE id=$1`, [id]))[0]
  if (!row) return { ok: false, error: 'Review not found' }
  if (row.status === 'finalized') return { ok: false, error: 'این ارزیابی نهایی شده و قابل ویرایش نیست' }
  let criteria: { key: string; weight: number }[] = []
  if (row.template_id) {
    const t = (await pgQuery<{ criteria_json: string }>(`SELECT criteria_json FROM hr_review_templates WHERE id=$1`, [row.template_id]))[0]
    criteria = t ? JSON.parse(t.criteria_json) : []
  }
  const overall = overallFromScores(scores, criteria)
  await pgQuery(`UPDATE hr_reviews SET scores_json=$2, overall_score=$3, note=$4, status='submitted', updated_at=${NOW} WHERE id=$1`,
    [id, JSON.stringify(scores), overall, note ?? null])
  return { ok: true }
}

/** 🔴 Finalize — the append-only boundary. Once finalized, the row is frozen. */
export async function finalizeReview(id: number): Promise<{ ok: boolean; error?: string }> {
  const row = (await pgQuery<{ status: string }>(`SELECT status FROM hr_reviews WHERE id=$1`, [id]))[0]
  if (!row) return { ok: false, error: 'Review not found' }
  if (row.status === 'finalized') return { ok: true } // idempotent
  if (row.status !== 'submitted') return { ok: false, error: 'فقط ارزیابی ثبت‌شده قابل نهایی‌سازی است' }
  await pgQuery(`UPDATE hr_reviews SET status='finalized', updated_at=${NOW} WHERE id=$1`, [id])
  return { ok: true }
}

export async function reviewsForCycle(cycleId: number) {
  return await pgQuery<{ id: number; employeeId: number; employeeName: string; reviewerId: number | null; kind: string; overallScore: number | null; status: string }>(
    `SELECT r.id, r.employee_id AS "employeeId", (e.first_name || ' ' || e.last_name) AS "employeeName",
            r.reviewer_id AS "reviewerId", r.kind, r.overall_score::float AS "overallScore", r.status
     FROM hr_reviews r JOIN hr_employees e ON e.id = r.employee_id
     WHERE r.cycle_id=$1 ORDER BY r.id DESC`, [cycleId])
}

/** Reviews a manager (by their OWN employee id) may see — their direct reports only. */
export async function reviewsForManager(managerEmployeeId: number) {
  return await pgQuery<{ id: number; employeeId: number; employeeName: string; cycleId: number; overallScore: number | null; status: string }>(
    `SELECT r.id, r.employee_id AS "employeeId", (e.first_name || ' ' || e.last_name) AS "employeeName",
            r.cycle_id AS "cycleId", r.overall_score::float AS "overallScore", r.status
     FROM hr_reviews r
     JOIN hr_employees e ON e.id = r.employee_id
     WHERE EXISTS (
       SELECT 1 FROM hr_employment h WHERE h.employee_id=r.employee_id AND h.end_date IS NULL AND h.manager_id=$1
     )
     ORDER BY r.id DESC`, [managerEmployeeId])
}

/** 🔴 Portal: an employee's OWN finalized reviews only — never a draft, never a colleague's. */
export async function myFinalizedReviews(employeeId: number) {
  return await pgQuery<{ id: number; cycleId: number; cycleName: string; kind: string; overallScore: number | null; note: string | null }>(
    `SELECT r.id, r.cycle_id AS "cycleId", c.name_fa AS "cycleName", r.kind, r.overall_score::float AS "overallScore", r.note
     FROM hr_reviews r JOIN hr_review_cycles c ON c.id = r.cycle_id
     WHERE r.employee_id=$1 AND r.status='finalized' ORDER BY r.id DESC`, [employeeId])
}

/** Ownership-scoped single review — returns null if not this employee's finalized review (route → 404). */
export async function myFinalizedReview(employeeId: number, reviewId: number) {
  const row = (await myFinalizedReviews(employeeId)).find(r => r.id === reviewId)
  return row ?? null
}
