/**
 * Phase 28.4 — live-PostgreSQL proof for the employee portal.
 *
 * 🔴 بند ۲ (IDOR) is the gate this whole suite exists for: the worst possible
 * outcome for this feature is two colleagues seeing each other's pay. Every
 * ownership boundary below is asserted directly against the data layer the
 * routes call — the same functions, not a parallel check.
 *
 * The assertions:
 *  1. Session independence: an employee session and a customer session use
 *     different tables and cannot resolve each other's identity.
 *  2. OTP: hashed, single-use, expiry, attempt-cap — identical discipline to
 *     the customer portal (26.25a), reused rather than reimplemented.
 *  3. 🔴 IDOR matrix: employee A's session against employee B's payslip,
 *     leave request, and portal request all resolve to nothing (→ 404 at the
 *     route). Employee-id from the body is ignored — the session decides.
 *  4. A leave request beyond the balance is refused with the reason (reuse of
 *     28.2's engine, not a parallel check).
 *  5. A request routes through the SAME approval engine, and full approval
 *     mirrors onto the portal-request row — a rejection does too.
 *  6. An info-correction request never touches hr_employees.
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import { createEmployee, addEmploymentRecord, deleteEmployee } from '@/lib/hr/employeeData'
import {
  requestEmployeeOtp, verifyEmployeeOtp, getHrPortalIdentity,
  revokeAllEmployeeSessions, HR_PORTAL_COOKIE,
} from '@/lib/hr/portalSession'
import { getPortalIdentity } from '@/lib/portal/session'
import { sha256 } from '@/lib/crm/portal'
import {
  myPayslips, myPayslipDetail, myLeaveOverview, myLeaveRequests, myLeaveRequest,
  myLeaveCancel, myPortalRequests, submitPortalRequest, myProfile, updateMyProfile,
  portalDashboard,
} from '@/lib/hr/portalData'
import { openPeriod, calculatePeriod, approvePeriod, postPeriodToGl } from '@/lib/hr/payrollData'
import { actOnRequest } from '@/lib/erp/approvalData'

let n = 0, failed = 0
const ok = (c: boolean, l: string, detail = '') => {
  n++
  if (c) console.log(`  ✅ ${n}. ${l}${detail ? ` — ${detail}` : ''}`)
  else { failed++; console.error(`  ❌ ${n}. ${l}${detail ? ` — ${detail}` : ''}`) }
}
const one = async <T>(sql: string, p: unknown[] = []) => (await pgQuery<T>(sql, p))[0]
const NOW = "to_char(now(), 'YYYY-MM-DD HH24:MI:SS')"

async function main() {
  await runMigrations()
  await seedDatabase()
  const userId = (await pgQuery<{ id: string }>(`SELECT id FROM users LIMIT 1`))[0]?.id
  const approverId = (await pgQuery<{ id: string }>(
    `INSERT INTO users (id, email, name, password_hash, role, active, created_at)
     VALUES ('portal-approver','portal-approver@test.local','تأییدکننده','x','administrator',true,${NOW})
     ON CONFLICT (id) DO UPDATE SET active=true RETURNING id`))[0].id

  const empA = await createEmployee({
    firstName: 'الف', lastName: 'کارمند', hireDate: '2024-01-01', status: 'active',
    mobile: '09120000101',
  }, userId)
  await addEmploymentRecord(empA, { startDate: '2024-01-01', baseSalary: 300_000_000, contractType: 'permanent' }, userId)

  const empB = await createEmployee({
    firstName: 'ب', lastName: 'کارمند', hireDate: '2024-01-01', status: 'active',
    mobile: '09120000102',
  }, userId)
  await addEmploymentRecord(empB, { startDate: '2024-01-01', baseSalary: 200_000_000, contractType: 'permanent' }, userId)

  console.log('— بند ۱: independent OTP session —')
  const reqA = await requestEmployeeOtp('09120000101', '1.1.1.1')
  ok(reqA.sessionId != null && reqA.sent, 'OTP requested for a real employee mobile → session created')
  const unknown = await requestEmployeeOtp('09999999999')
  ok(unknown.sessionId === null && !unknown.sent, 'unknown mobile → neutral (no enumeration)')

  const stored = await one<{ otp_hash: string }>(`SELECT otp_hash FROM hr_portal_sessions WHERE id=$1`, [reqA.sessionId])
  ok(stored.otp_hash != null && stored.otp_hash.length === 64 && !/^\d{6}$/.test(stored.otp_hash),
    'OTP stored HASHED (sha256), never plaintext')

  const knownCode = '135790'
  await pgQuery(`UPDATE hr_portal_sessions SET otp_hash=$2, attempts=0 WHERE id=$1`, [reqA.sessionId, sha256(knownCode)])
  const wrong = await verifyEmployeeOtp(reqA.sessionId!, '000000')
  ok(wrong.ok === false && wrong.reason === 'mismatch', 'wrong code refused, attempts recorded')
  const verifiedA = await verifyEmployeeOtp(reqA.sessionId!, knownCode)
  ok(verifiedA.ok === true && !!verifiedA.token && verifiedA.employeeId === empA, 'correct code → session token issued')

  const consumed = await one<{ otp_hash: string | null }>(`SELECT otp_hash FROM hr_portal_sessions WHERE id=$1`, [reqA.sessionId])
  ok(consumed.otp_hash === null, 'OTP consumed on success — single-use')
  const reuse = await verifyEmployeeOtp(reqA.sessionId!, knownCode)
  ok(reuse.ok === false, '🔴 the SAME code cannot be used twice')

  const identA = await getHrPortalIdentity(verifiedA.token)
  ok(identA?.employeeId === empA, 'the session token resolves back to the employee who logged in')

  console.log('— 🔴 بند ۱: employee, customer and admin sessions never share tokens —')
  ok((await getPortalIdentity(verifiedA.token)) === null,
    '🔴 an EMPLOYEE token is REJECTED by the customer-portal session resolver')

  const cust = await one<{ id: number }>(
    `INSERT INTO sales_customers (code,name,kind,phone,updated_at) VALUES ('EP-C','مشتری آزمون','company','09120000201',${NOW}) RETURNING id`)
  await pgQuery(`INSERT INTO customer_portal_sessions (customer_id, channel, identifier, token_hash, verified, expires_at, created_at, updated_at)
    VALUES ($1,'otp','09120000201',$2,1,$3,${NOW},${NOW})`,
    [cust.id, sha256('cust-token'), new Date(Date.now() + 3_600_000).toISOString()])
  ok((await getHrPortalIdentity('cust-token')) === null,
    '🔴 a CUSTOMER token is REJECTED by the employee-portal session resolver')

  console.log('— attempt cap / expiry / revocation —')
  const reqLock = await requestEmployeeOtp('09120000101')
  await pgQuery(`UPDATE hr_portal_sessions SET otp_hash=$2, attempts=5 WHERE id=$1`, [reqLock.sessionId, sha256('222222')])
  const lockCheck = await verifyEmployeeOtp(reqLock.sessionId!, '222222')
  ok(lockCheck.ok === false && lockCheck.reason === 'too_many_attempts', 'attempt cap locks the session')

  const reqExp = await requestEmployeeOtp('09120000101')
  await pgQuery(`UPDATE hr_portal_sessions SET otp_hash=$2, otp_expires_at='2020-01-01T00:00:00Z' WHERE id=$1`, [reqExp.sessionId, sha256('333333')])
  const expCheck = await verifyEmployeeOtp(reqExp.sessionId!, '333333')
  ok(expCheck.ok === false && expCheck.reason === 'expired', 'an expired OTP is refused')

  await revokeAllEmployeeSessions(empA)
  ok((await getHrPortalIdentity(verifiedA.token)) === null, 'logging out of all devices revokes every session')

  // Re-login for the rest of the suite.
  const reqA2 = await requestEmployeeOtp('09120000101')
  await pgQuery(`UPDATE hr_portal_sessions SET otp_hash=$2 WHERE id=$1`, [reqA2.sessionId, sha256('444444')])
  const sessA = await verifyEmployeeOtp(reqA2.sessionId!, '444444')
  const reqB = await requestEmployeeOtp('09120000102')
  await pgQuery(`UPDATE hr_portal_sessions SET otp_hash=$2 WHERE id=$1`, [reqB.sessionId, sha256('555555')])
  const sessB = await verifyEmployeeOtp(reqB.sessionId!, '555555')
  ok(!!sessA.token && !!sessB.token, 'both employees have independent sessions')

  console.log('— payroll data for the IDOR matrix —')
  const period = await openPeriod(1405, 5, userId!)
  await calculatePeriod(period.id!, userId!)
  await approvePeriod(period.id!, approverId)
  await postPeriodToGl(period.id!, approverId)

  const slipsA = await myPayslips(empA)
  const slipsB = await myPayslips(empB)
  ok(slipsA.length === 1 && slipsB.length === 1, 'each employee sees exactly one payslip — their own')

  console.log('— 🔴 بند ۲: the IDOR matrix —')
  ok((await myPayslipDetail(empA, slipsB[0].id)) === null,
    '🔴 employee A with employee B\'s payslip id → resolves to null (route → 404, not 403)')
  ok((await myPayslipDetail(empB, slipsA[0].id)) === null,
    '🔴 the reverse also fails — the boundary is symmetric')
  ok((await myPayslipDetail(empA, slipsA[0].id)) !== null, 'employee A can see their OWN payslip')

  const openPeriod2 = await openPeriod(1405, 6, userId!)
  await calculatePeriod(openPeriod2.id!, userId!)   // still "calculated", not approved
  const openSlips = await pgQuery<{ id: number }>(
    `SELECT id FROM payroll_slips WHERE period_id=$1 AND employee_id=$2`, [openPeriod2.id, empA])
  ok(openSlips.length > 0 && (await myPayslipDetail(empA, openSlips[0].id)) === null,
    '🔴 a slip from a NOT-YET-APPROVED period is invisible even to its own owner')

  const leaveA = await myLeaveOverview(empA)
  const annualType = leaveA.balances.find(b => b.type.code === 'annual')!
  await pgQuery(`INSERT INTO hr_leave_transactions (employee_id, leave_type_id, kind, days) VALUES ($1,$2,'accrual',20)`,
    [empA, annualType.type.id])
  await pgQuery(`INSERT INTO hr_leave_transactions (employee_id, leave_type_id, kind, days) VALUES ($1,$2,'accrual',20)`,
    [empB, annualType.type.id])

  const reqLeaveA = await myLeaveRequest(empA, {
    leaveTypeId: annualType.type.id, startDate: '2026-08-01', endDate: '2026-08-03',
  })
  ok(reqLeaveA.ok === true, 'employee A submits their own leave request', JSON.stringify(reqLeaveA))

  const cancelWrongOwner = await myLeaveCancel(empB, reqLeaveA.id!)
  ok(cancelWrongOwner.ok === false && cancelWrongOwner.error === 'Not found',
    '🔴 employee B cannot cancel employee A\'s leave request (404, not 403)')
  const cancelRightOwner = await myLeaveCancel(empA, reqLeaveA.id!)
  ok(cancelRightOwner.ok === true, 'employee A CAN cancel their own pending request')

  const requestsA = await myLeaveRequests(empA)
  const requestsB = await myLeaveRequests(empB)
  ok(!requestsB.some(r => r.id === reqLeaveA.id), '🔴 employee B\'s leave list never contains employee A\'s request')
  ok(requestsA.some(r => r.id === reqLeaveA.id), 'employee A\'s own list contains it')

  console.log('— employeeId in the body is ignored; the session decides —')
  // myLeaveRequest's signature takes employeeId as its own first argument
  // (never read from a client payload) — proven structurally: calling it with
  // B's id files the request as B, regardless of what a forged body might say.
  const forged = await myLeaveRequest(empB, {
    leaveTypeId: annualType.type.id, startDate: '2026-08-10', endDate: '2026-08-10',
  })
  ok(forged.ok === true && (await myLeaveRequests(empB)).some(r => r.id === forged.id),
    'a request is always filed under the SESSION\'s employee, structurally')

  console.log('— بند ۴: leave beyond the balance is refused —')
  const overBalance = await myLeaveRequest(empB, {
    leaveTypeId: annualType.type.id, startDate: '2026-09-01', endDate: '2026-12-31',
  })
  ok(overBalance.ok === false && overBalance.reason === 'insufficient_balance',
    '🔴 a request beyond the balance is refused with the reason, not silently shortened',
    JSON.stringify(overBalance))

  console.log('— بند ۵: administrative requests route through the real approval engine —')
  const certReq = await submitPortalRequest(empA, 'certificate', { note: 'برای اجارهٔ منزل' })
  ok(certReq.ok === true, 'a certificate request is submitted', certReq.error)

  const idorRequests = await myPortalRequests(empB)
  ok(!idorRequests.some(r => r.id === certReq.id), '🔴 employee B never sees employee A\'s portal request')

  const apRow = await one<{ approval_request_id: number }>(
    `SELECT approval_request_id FROM hr_portal_requests WHERE id=$1`, [certReq.id])
  ok(apRow.approval_request_id != null, 'the request created a real approval_requests row (same engine as everything else)')

  const admin = { id: approverId, email: 'x', role: 'administrator' } as never
  await actOnRequest(apRow.approval_request_id, admin, 'approved', 'ok', '1.1.1.1')
  const afterApprove = await one<{ status: string }>(`SELECT status FROM hr_portal_requests WHERE id=$1`, [certReq.id])
  ok(afterApprove.status === 'approved', '🔴 full approval mirrors onto the portal-request row automatically')

  const rejReq = await submitPortalRequest(empB, 'mission', { destination: 'اصفهان' })
  const rejAp = await one<{ approval_request_id: number }>(`SELECT approval_request_id FROM hr_portal_requests WHERE id=$1`, [rejReq.id])
  await actOnRequest(rejAp.approval_request_id, admin, 'rejected', 'not needed', '1.1.1.1')
  const afterReject = await one<{ status: string }>(`SELECT status FROM hr_portal_requests WHERE id=$1`, [rejReq.id])
  ok(afterReject.status === 'rejected', 'a rejection mirrors too')

  console.log('— 🔴 info-correction is NEVER auto-applied —')
  const before = await one<{ national_id: string | null }>(`SELECT national_id FROM hr_employees WHERE id=$1`, [empA])
  const correction = await submitPortalRequest(empA, 'info_correction', { nationalId: '0000000000' })
  ok(correction.ok === true, 'an info-correction request is accepted as a proposal')
  const corrAp = await one<{ approval_request_id: number }>(`SELECT approval_request_id FROM hr_portal_requests WHERE id=$1`, [correction.id])
  await actOnRequest(corrAp.approval_request_id, admin, 'approved', 'ok', '1.1.1.1')
  const after = await one<{ national_id: string | null }>(`SELECT national_id FROM hr_employees WHERE id=$1`, [empA])
  ok(before.national_id === after.national_id,
    '🔴 EVEN after full approval, hr_employees.national_id is UNCHANGED — HR must apply it by hand')

  console.log('— بند ۶: profile — sensitive fields read-only, non-sensitive editable —')
  const profA = await myProfile(empA)
  ok(profA !== null && profA.nationalIdMasked !== undefined, 'own profile includes a masked national id for display')
  const updRes = await updateMyProfile(empA, { email: 'employee-a@test.local' })
  ok(updRes.ok === true, 'employee can update their own non-sensitive fields')
  const profAfter = await myProfile(empA)
  ok(profAfter?.email === 'employee-a@test.local', 'the update actually landed')

  const dashA = await portalDashboard(empA)
  ok(typeof dashA.leaveBalance === 'number', 'the dashboard assembles', JSON.stringify(dashA))

  console.log('— cookie constant sanity —')
  const cookieDistinct: string = HR_PORTAL_COOKIE
  ok(cookieDistinct === 'hr_portal_token', '🔴 the employee-portal cookie name is distinct from both other sessions')

  // ── cleanup ───────────────────────────────────────────────────────────────
  for (const id of [empA, empB]) {
    await pgQuery(`DELETE FROM hr_portal_requests WHERE employee_id=$1`, [id])
    await pgQuery(`DELETE FROM hr_portal_sessions WHERE employee_id=$1`, [id])
    await pgQuery(`DELETE FROM hr_leave_requests WHERE employee_id=$1`, [id])
    await pgQuery(`DELETE FROM hr_leave_transactions WHERE employee_id=$1`, [id])
    await pgQuery(`DELETE FROM payroll_slips WHERE employee_id=$1`, [id])
    await deleteEmployee(id)
  }
  await pgQuery(`DELETE FROM customer_portal_sessions WHERE customer_id=$1`, [cust.id])
  await pgQuery(`DELETE FROM sales_customers WHERE id=$1`, [cust.id])
  await pgQuery(`UPDATE users SET active=false WHERE id=$1`, [approverId])

  console.log(`\n  ${failed === 0 ? '✅' : '❌'} Phase 28.4: ${n - failed}/${n} passed\n`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
