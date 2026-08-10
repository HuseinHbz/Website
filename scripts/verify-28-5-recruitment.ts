/**
 * Phase 28.5 — live-PostgreSQL proof for recruitment, training and review.
 *
 * The assertions this suite exists for:
 *
 *  1. 🔴 Candidate → employee reuses the EXACT 28.1 path — the resulting
 *     employee has real `hr_employees`/`hr_employment` rows, not a parallel
 *     insert, and the hire is idempotent (double-click → one employee).
 *  2. Training rides the existing academy `courses` catalog — no duplicate
 *     catalog table — and the mandatory-coverage report is arithmetic, not
 *     guessed.
 *  3. 🔴 The بند ۳ data gate correctly reports "not ready" over an
 *     unmanaged workforce and "ready" once most employees have a manager on
 *     file — the honest boundary the spec required before building analytics.
 *  4. 🔴 Review row scope: a manager sees only their own reports' reviews.
 *  5. 🔴 Append-only: a finalized review can never be resubmitted; a second
 *     finalize call is idempotent, not an error.
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import { createEmployee, addEmploymentRecord } from '@/lib/hr/employeeData'
import {
  createOpening, createCandidate, createApplication, moveApplication,
  scheduleInterview, recordInterviewResult, createOffer, hireFromApplication,
} from '@/lib/hr/recruitmentData'
import { canTransition } from '@/lib/hr/recruitment'
import { enrollEmployee, completeEnrollment, trainingCoverage } from '@/lib/hr/trainingData'
import {
  reviewDataGate, createCycle, createTemplate, createReview, submitReview,
  finalizeReview, reviewsForManager,
} from '@/lib/hr/reviewData'

let pass = 0, fail = 0
function check(label: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`) }
}

async function main() {
  console.log('\n  Phase 28.5 — recruitment, training & performance review, live PostgreSQL\n')
  await runMigrations()
  await seedDatabase()

  const ADMIN = (await pgQuery<{ id: string }>(`SELECT id FROM users WHERE role IN ('super_admin','administrator') ORDER BY id LIMIT 1`))[0].id

  // ── pure stage-machine sanity ─────────────────────────────────────────
  check('canTransition screening → interview_1 allowed', canTransition('screening', 'interview_1'))
  check('canTransition screening → offer refused (skips a stage)', !canTransition('screening', 'offer'))
  check('any live stage → rejected allowed', canTransition('interview_1', 'rejected'))
  check('a terminal stage (hired) accepts no further move', !canTransition('hired', 'rejected'))

  console.log('\n— بند ۱: candidate → application → interview → offer → hire —')

  const openingId = await createOpening({ titleFa: 'مهندس زیرساخت', headcount: 1 }, ADMIN)
  check('an opening is created', !!openingId)

  const candidateId = await createCandidate({ fullName: 'سارا احمدی', mobile: '09120000001', email: 'sara@example.com', source: 'site' })
  const applicationId = await createApplication(candidateId, openingId)
  check('an application is filed', !!applicationId)

  let r = await moveApplication(applicationId, 'interview_1')
  check('the application moves to interview_1', r.ok)
  r = await moveApplication(applicationId, 'offer')
  check('🔴 skipping interview_2 is refused by the same guard the kanban uses', !r.ok)

  await moveApplication(applicationId, 'interview_2')
  const interviewId = await scheduleInterview({ applicationId, kind: 'online', interviewerId: ADMIN })
  await recordInterviewResult(interviewId, { score: 88, result: 'pass' })
  const iv = (await pgQuery<{ result: string }>(`SELECT result FROM hr_interviews WHERE id=$1`, [interviewId]))[0]
  check('the interview result is recorded', iv.result === 'pass')

  await moveApplication(applicationId, 'offer')
  const offerId = await createOffer({ applicationId, proposedSalary: 450_000_000, startDate: '1405-02-01' }, ADMIN)
  check('an offer is created', !!offerId)

  const hireResult = await hireFromApplication(applicationId, {
    hireDate: '1405-02-01', baseSalary: 450_000_000, contractType: 'permanent',
  }, ADMIN)
  check('🔴 the candidate converts to an employee', hireResult.ok && !!hireResult.employeeId)

  const emp = (await pgQuery<{ id: number; hire_date: string }>(`SELECT id, hire_date FROM hr_employees WHERE id=$1`, [hireResult.employeeId]))[0]
  check('🔴 a REAL hr_employees row exists — the exact 28.1 table, no parallel insert', !!emp)
  const employment = (await pgQuery<{ id: number; base_salary: string }>(`SELECT id, base_salary FROM hr_employment WHERE employee_id=$1`, [hireResult.employeeId]))[0]
  check('🔴 a REAL hr_employment row exists with the offered salary', !!employment && Number(employment.base_salary) === 450_000_000)

  const candidateAfter = (await pgQuery<{ converted_employee_id: number | null }>(`SELECT converted_employee_id FROM hr_candidates WHERE id=$1`, [candidateId]))[0]
  check('🔴 the candidate keeps a two-way link to the employee it became', candidateAfter.converted_employee_id === hireResult.employeeId)

  const hireAgain = await hireFromApplication(applicationId, {
    hireDate: '1405-02-01', baseSalary: 450_000_000, contractType: 'permanent',
  }, ADMIN)
  check('🔴 a repeated hire call (double-click) returns the SAME employee, not a second one', hireAgain.employeeId === hireResult.employeeId)
  const empCount = (await pgQuery<{ n: string }>(`SELECT COUNT(*)::text AS n FROM hr_employees WHERE mobile='09120000001'`))[0]
  check('🔴 exactly ONE employee exists for this candidate', Number(empCount.n) === 1)

  console.log('\n— بند ۲: training on the existing academy catalog —')

  const course = (await pgQuery<{ id: number }>(
    `INSERT INTO courses (slug, title_en, title_fa, status, certificate_enabled, created_at, updated_at)
     VALUES ('sec-101','Security 101','امنیت ۱۰۱','published',true,now()::text,now()::text) RETURNING id`))[0]
  check('a course exists in the SAME courses table the public academy reads', !!course.id)

  const e1 = await enrollEmployee({ employeeId: hireResult.employeeId!, courseId: course.id, mandatory: true })
  check('an employee is enrolled', e1.ok)
  const e1Again = await enrollEmployee({ employeeId: hireResult.employeeId!, courseId: course.id, mandatory: true })
  check('🔴 re-enrolling is idempotent — same enrollment id, not a duplicate row', e1Again.id === e1.id)

  const completion = await completeEnrollment(hireResult.employeeId!, e1.id!, 92)
  check('completing the course succeeds and a certificate is issued (certificate_enabled=1)', completion.ok && !!completion.certificateNo)

  const cov = await trainingCoverage()
  const row = cov.find(c => c.courseId === course.id)
  check('🔴 coverage report is real arithmetic — 1/1 completed = 100%', !!row && row.enrolled === 1 && row.completed === 1 && row.coveragePct === 100)

  console.log('\n— بند ۳: 🔴 the review data gate —')

  const gateEmpty = await reviewDataGate()
  check('🔴 with a workforce mostly WITHOUT a manager on file, the gate reports NOT ready',
    !gateEmpty.ready, `coverage ${gateEmpty.coveragePct}% of ${gateEmpty.activeEmployees}`)

  // Build a real management chain: a manager and several reports.
  const managerId = await createEmployee({ firstName: 'مدیر', lastName: 'تیم', status: 'active' }, ADMIN)
  await addEmploymentRecord(managerId, { startDate: '1404-01-01', baseSalary: 500_000_000, contractType: 'permanent', changeReason: 'hire' }, ADMIN)
  await addEmploymentRecord(hireResult.employeeId!, {
    startDate: '1405-02-01', baseSalary: 450_000_000, contractType: 'permanent', managerId, changeReason: 'org change',
  }, ADMIN)
  // Terminate every other active employee that has no manager so the ratio clears the threshold cleanly.
  await pgQuery(`UPDATE hr_employees SET status='terminated' WHERE status='active' AND id NOT IN ($1,$2)`, [managerId, hireResult.employeeId])

  const gateReady = await reviewDataGate()
  check('🔴 once most active employees have a real manager on file, the gate reports ready',
    gateReady.ready, `coverage ${gateReady.coveragePct}%`)

  console.log('\n— بند ۳: review cycle, row scope, append-only —')

  const cycleId = await createCycle({ nameFa: 'ارزیابی بهار ۱۴۰۵', period: '1405-Q1', startDate: '1405-01-01', endDate: '1405-03-31' })
  const templateId = await createTemplate({ nameFa: 'قالب پایه', criteria: [{ key: 'quality', labelFa: 'کیفیت', weight: 60 }, { key: 'speed', labelFa: 'سرعت', weight: 40 }] })

  const reviewId = await createReview({ cycleId, employeeId: hireResult.employeeId!, reviewerId: managerId, templateId, kind: 'manager' })
  check('a review is created for the manager\'s direct report', !!reviewId)

  const submitRes = await submitReview(reviewId, { quality: 90, speed: 70 }, 'خوب بود')
  check('the review is submitted with a weighted overall score', submitRes.ok)
  const submitted = (await pgQuery<{ overall_score: string; status: string }>(`SELECT overall_score, status FROM hr_reviews WHERE id=$1`, [reviewId]))[0]
  check('🔴 the overall score is the weighted average (90×0.6+70×0.4=82), not a plain mean', Number(submitted.overall_score) === 82)

  console.log('\n— 🔴 بند ۴: review row scope (IDOR) —')

  const otherManagerId = await createEmployee({ firstName: 'مدیر', lastName: 'دیگر', status: 'active' }, ADMIN)
  const myReports = await reviewsForManager(managerId)
  const otherReports = await reviewsForManager(otherManagerId)
  check('🔴 the real manager sees the review of their own report', myReports.some(r2 => r2.id === reviewId))
  check('🔴 an unrelated manager sees NONE of it', !otherReports.some(r2 => r2.id === reviewId))

  console.log('\n— 🔴 append-only: finalize freezes the review —')

  const finalizeRes = await finalizeReview(reviewId)
  check('finalizing a submitted review succeeds', finalizeRes.ok)
  const resubmit = await submitReview(reviewId, { quality: 10, speed: 10 }, 'تلاش برای بازنویسی')
  check('🔴 a finalized review REFUSES a resubmit — the score cannot be silently overwritten', !resubmit.ok)
  const afterAttempt = (await pgQuery<{ overall_score: string }>(`SELECT overall_score FROM hr_reviews WHERE id=$1`, [reviewId]))[0]
  check('🔴 the original score survives the resubmit attempt untouched', Number(afterAttempt.overall_score) === 82)

  const finalizeAgain = await finalizeReview(reviewId)
  check('finalizing an already-finalized review is idempotent, not an error', finalizeAgain.ok)

  console.log(`\n  ${fail === 0 ? '✅' : '❌'} Phase 28.5: ${pass}/${pass + fail} passed\n`)
  if (fail > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
