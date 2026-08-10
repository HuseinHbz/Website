/**
 * Phase 28.5 بند ۲ — training server layer, built ON the existing academy
 * catalog (`courses`). `courses` was audited first: it is the PUBLIC content
 * catalog (no employee_id, no "mandatory" concept, no attendance/completion
 * state) — a structurally different thing from an internal training record.
 * So the catalog is reused (`course_id` FK) and only the assignment/
 * completion/certificate layer is new.
 */
import { pgQuery } from '@/lib/db'

const NOW = `to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`

export async function listCourses() {
  return await pgQuery<{ id: number; titleFa: string | null; titleEn: string; durationHours: number | null }>(
    `SELECT id, title_fa AS "titleFa", title_en AS "titleEn", duration_hours AS "durationHours"
     FROM courses WHERE status='published' ORDER BY title_en`)
}

export async function enrollEmployee(d: { employeeId: number; courseId: number; mandatory?: boolean }): Promise<{ ok: boolean; id?: number; error?: string }> {
  const existing = (await pgQuery<{ id: number }>(
    `SELECT id FROM hr_training_enrollments WHERE employee_id=$1 AND course_id=$2`,
    [d.employeeId, d.courseId]))[0]
  if (existing) return { ok: true, id: existing.id } // idempotent — re-enrolling is a no-op
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO hr_training_enrollments (employee_id, course_id, mandatory)
     VALUES ($1,$2,$3) RETURNING id`,
    [d.employeeId, d.courseId, d.mandatory ? 1 : 0]))[0]
  return { ok: true, id: row.id }
}

export async function myEnrollments(employeeId: number) {
  return await pgQuery<{ id: number; courseId: number; titleFa: string | null; titleEn: string; mandatory: number; status: string; score: number | null; enrolledAt: string; completedAt: string | null }>(
    `SELECT e.id, e.course_id AS "courseId", c.title_fa AS "titleFa", c.title_en AS "titleEn",
            e.mandatory, e.status, e.score::float AS score, e.enrolled_at AS "enrolledAt", e.completed_at AS "completedAt"
     FROM hr_training_enrollments e JOIN courses c ON c.id = e.course_id
     WHERE e.employee_id=$1 ORDER BY e.enrolled_at DESC`, [employeeId])
}

/** Ownership-scoped — returns null if the enrollment does not belong to this employee (route → 404). */
export async function myEnrollment(employeeId: number, enrollmentId: number) {
  const row = (await myEnrollments(employeeId)).find(e => e.id === enrollmentId)
  return row ?? null
}

export async function completeEnrollment(employeeId: number, enrollmentId: number, score?: number | null): Promise<{ ok: boolean; certificateNo?: string }> {
  const row = (await pgQuery<{ id: number; certificate_enabled: boolean }>(
    `SELECT e.id, c.certificate_enabled FROM hr_training_enrollments e
     JOIN courses c ON c.id = e.course_id WHERE e.id=$1 AND e.employee_id=$2`, [enrollmentId, employeeId]))[0]
  if (!row) return { ok: false }
  await pgQuery(`UPDATE hr_training_enrollments SET status='completed', score=$2, completed_at=${NOW} WHERE id=$1`,
    [enrollmentId, score ?? null])
  if (!row.certificate_enabled) return { ok: true }
  const certNo = `CERT-${enrollmentId}-${Date.now().toString(36).toUpperCase()}`
  await pgQuery(`INSERT INTO hr_training_certificates (enrollment_id, certificate_no) VALUES ($1,$2)
                 ON CONFLICT (certificate_no) DO NOTHING`, [enrollmentId, certNo])
  return { ok: true, certificateNo: certNo }
}

/** HR/admin coverage report: what fraction of employees completed each mandatory course. */
export async function trainingCoverage() {
  return await pgQuery<{ courseId: number; titleFa: string | null; titleEn: string; enrolled: number; completed: number; coveragePct: number }>(
    `SELECT c.id AS "courseId", c.title_fa AS "titleFa", c.title_en AS "titleEn",
            COUNT(e.id)::int AS enrolled,
            COUNT(e.id) FILTER (WHERE e.status='completed')::int AS completed,
            (CASE WHEN COUNT(e.id)=0 THEN 0
                 ELSE ROUND(COUNT(e.id) FILTER (WHERE e.status='completed')::numeric * 100 / COUNT(e.id), 1) END)::float AS "coveragePct"
     FROM courses c
     LEFT JOIN hr_training_enrollments e ON e.course_id = c.id AND e.mandatory=1
     WHERE EXISTS (SELECT 1 FROM hr_training_enrollments e2 WHERE e2.course_id=c.id AND e2.mandatory=1)
     GROUP BY c.id, c.title_fa, c.title_en ORDER BY c.id`)
}

export async function allEnrollments() {
  return await pgQuery<{ id: number; employeeId: number; employeeName: string; courseId: number; titleFa: string | null; titleEn: string; mandatory: number; status: string }>(
    `SELECT e.id, e.employee_id AS "employeeId", (emp.first_name || ' ' || emp.last_name) AS "employeeName",
            e.course_id AS "courseId", c.title_fa AS "titleFa", c.title_en AS "titleEn", e.mandatory, e.status
     FROM hr_training_enrollments e
     JOIN hr_employees emp ON emp.id = e.employee_id
     JOIN courses c ON c.id = e.course_id
     ORDER BY e.id DESC`)
}
