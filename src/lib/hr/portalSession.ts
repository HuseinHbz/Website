/**
 * Phase 28.4 — employee-portal session data layer.
 *
 * 🔴 INDEPENDENT of `customer_portal_sessions` (26.25a) and the admin JWT: its
 * own table (`hr_portal_sessions`), its own cookie (`hr_portal_token`), its own
 * opaque sha256-hashed token. The pure crypto primitives are reused from
 * `@/lib/crm/portal` (they are generic — no customer coupling), but the
 * SESSION itself is never shared. A customer's cookie must not authenticate an
 * employee, and an employee who also has an admin login gets two completely
 * separate sessions.
 */
import { pgQuery } from '@/lib/db'
import {
  sha256, generateOtp, generateToken, checkOtp, isSessionValid,
  OTP_TTL_MIN, SESSION_TTL_HOURS, type OtpCheck,
} from '@/lib/crm/portal'
import { dispatch } from '@/lib/messaging/manager'
import { normalizeMobile } from './employees'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
export const HR_PORTAL_COOKIE = 'hr_portal_token'   // deliberately distinct from portal_token / admin_token

export interface HrPortalIdentity { employeeId: number; sessionId: number }

async function findEmployeeByMobile(mobile: string) {
  const norm = normalizeMobile(mobile) ?? mobile.trim()
  return (await pgQuery<{ id: number; firstName: string; mobile: string | null }>(
    `SELECT id, first_name AS "firstName", mobile FROM hr_employees
     WHERE status IN ('active','on_leave') AND mobile=$1 LIMIT 1`, [norm]))[0]
}

/**
 * Start a portal login: create a session row with a hashed, short-lived OTP and
 * send it by SMS to the employee's registered mobile (reuses the 26.25s
 * messaging adapter). Returns a neutral result when the mobile is unknown —
 * no enumeration of who is or is not an employee.
 */
export async function requestEmployeeOtp(mobile: string, ip?: string): Promise<{ sessionId: number | null; sent: boolean }> {
  const emp = await findEmployeeByMobile(mobile)
  if (!emp || !emp.mobile) return { sessionId: null, sent: false }
  const code = generateOtp()
  const expires = new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString()
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO hr_portal_sessions (employee_id, channel, identifier, otp_hash, otp_expires_at, attempts, verified, ip, created_at, updated_at)
     VALUES ($1,'otp',$2,$3,$4,0,0,$5,${NOW},${NOW}) RETURNING id`,
    [emp.id, emp.mobile, sha256(code), expires, ip ?? null]))[0]
  const text = `کد ورود شما به پورتال کارمند: ${code}\nHBZ employee portal code: ${code}`
  await dispatch('sms', { to: emp.mobile, text })
  return { sessionId: row.id, sent: true }
}

export async function verifyEmployeeOtp(sessionId: number, code: string): Promise<{ ok: boolean; token?: string; employeeId?: number; reason?: OtpCheck }> {
  const s = (await pgQuery<{ employee_id: number; otp_hash: string | null; otp_expires_at: string | null; attempts: number; verified: number; revoked: number }>(
    `SELECT employee_id, otp_hash, otp_expires_at, attempts, verified, revoked FROM hr_portal_sessions WHERE id=$1`, [sessionId]))[0]
  if (!s || s.revoked) return { ok: false, reason: 'no_pending' }
  const verdict = checkOtp({ otpHash: s.otp_hash, otpExpiresAt: s.otp_expires_at, attempts: s.attempts, verified: s.verified }, code, new Date().toISOString())
  if (verdict !== 'ok') {
    await pgQuery(`UPDATE hr_portal_sessions SET attempts=attempts+1, updated_at=${NOW} WHERE id=$1`, [sessionId])
    return { ok: false, reason: verdict }
  }
  const token = generateToken()
  const expires = new Date(Date.now() + SESSION_TTL_HOURS * 3_600_000).toISOString()
  await pgQuery(
    `UPDATE hr_portal_sessions SET verified=1, token_hash=$2, expires_at=$3, otp_hash=NULL, otp_expires_at=NULL, updated_at=${NOW} WHERE id=$1`,
    [sessionId, sha256(token), expires])
  return { ok: true, token, employeeId: s.employee_id }
}

export async function getHrPortalIdentity(token: string | undefined): Promise<HrPortalIdentity | null> {
  if (!token) return null
  const hash = sha256(token)
  const s = (await pgQuery<{ id: number; employee_id: number; token_hash: string | null; verified: number; revoked: number; expires_at: string | null }>(
    `SELECT id, employee_id, token_hash, verified, revoked, expires_at FROM hr_portal_sessions WHERE token_hash=$1 LIMIT 1`, [hash]))[0]
  if (!s) return null
  if (!isSessionValid({ tokenHash: s.token_hash, verified: s.verified, revoked: s.revoked, expiresAt: s.expires_at }, hash, new Date().toISOString())) return null
  return { employeeId: s.employee_id, sessionId: s.id }
}

export async function revokeEmployeeSession(sessionId: number): Promise<void> {
  await pgQuery(`UPDATE hr_portal_sessions SET revoked=1, updated_at=${NOW} WHERE id=$1`, [sessionId])
}
export async function revokeAllEmployeeSessions(employeeId: number): Promise<void> {
  await pgQuery(`UPDATE hr_portal_sessions SET revoked=1, updated_at=${NOW} WHERE employee_id=$1 AND revoked=0`, [employeeId])
}
