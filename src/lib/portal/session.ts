/**
 * Customer-portal session data layer (Phase 26.25a بند ۲.۱). INDEPENDENT of the
 * admin JWT — opaque random session tokens (never JWT, no shared secret, no
 * shared cookie name). Raw OTP/token are never stored; only their sha256. Reuses
 * the pure primitives in `@/lib/crm/portal` (generate/checkOtp/isSessionValid/
 * ownsResource) so the crypto decisions stay unit-tested.
 */
import { pgQuery } from '@/lib/db'
import {
  sha256, generateOtp, generateToken, checkOtp, isSessionValid,
  OTP_TTL_MIN, SESSION_TTL_HOURS, type OtpCheck,
} from '@/lib/crm/portal'
import { dispatch } from '@/lib/messaging/manager'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
export const PORTAL_COOKIE = 'portal_token'   // deliberately NOT 'admin_token'

export interface PortalIdentity { customerId: number; sessionId: number }

/** Resolve the customer + email/phone for a login identifier. */
async function findCustomer(channel: 'sms' | 'email', identifier: string) {
  const col = channel === 'email' ? 'email' : 'phone'
  const id = identifier.trim().toLowerCase()
  return (await pgQuery<{ id: number; name: string; email: string | null; phone: string | null }>(
    `SELECT id, name, email, phone FROM sales_customers WHERE active=1 AND lower(${col})=$1 LIMIT 1`, [id]))[0]
}

/**
 * Start a portal login: create a session row with a hashed, short-lived OTP and
 * send it over the requested channel (SMS/email; sandbox when unconfigured).
 * Returns a neutral result even when the identifier is unknown (no enumeration).
 */
export async function requestOtp(channel: 'sms' | 'email', identifier: string, ip?: string): Promise<{ sessionId: number | null; sent: boolean }> {
  const cust = await findCustomer(channel, identifier)
  if (!cust) return { sessionId: null, sent: false }   // caller returns a generic 200
  const code = generateOtp()
  const expires = new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString()
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO customer_portal_sessions (customer_id, channel, identifier, otp_hash, otp_expires_at, attempts, verified, ip, created_at, updated_at)
     VALUES ($1,'otp',$2,$3,$4,0,0,$5,${NOW},${NOW}) RETURNING id`,
    [cust.id, identifier.trim().toLowerCase(), sha256(code), expires, ip ?? null]))[0]
  const text = `کد ورود شما به پرتال حبیب‌آذر: ${code}\nHBZ portal code: ${code}`
  await dispatch(channel, { to: channel === 'email' ? (cust.email ?? '') : (cust.phone ?? ''), text, subject: 'HBZ Portal — کد ورود' })
  return { sessionId: row.id, sent: true }
}

/**
 * Verify an OTP for a session. On success issues an opaque session token (stored
 * hashed) and returns it (the route sets the httpOnly cookie). Enforces the
 * attempt cap + expiry via the pure checkOtp. Increments attempts on every miss.
 */
export async function verifyOtp(sessionId: number, code: string): Promise<{ ok: boolean; token?: string; customerId?: number; reason?: OtpCheck }> {
  const s = (await pgQuery<{ customer_id: number; otp_hash: string | null; otp_expires_at: string | null; attempts: number; verified: number; revoked: number }>(
    `SELECT customer_id, otp_hash, otp_expires_at, attempts, verified, revoked FROM customer_portal_sessions WHERE id=$1`, [sessionId]))[0]
  if (!s || s.revoked) return { ok: false, reason: 'no_pending' }
  const verdict = checkOtp({ otpHash: s.otp_hash, otpExpiresAt: s.otp_expires_at, attempts: s.attempts, verified: s.verified }, code, new Date().toISOString())
  if (verdict !== 'ok') {
    await pgQuery(`UPDATE customer_portal_sessions SET attempts=attempts+1, updated_at=${NOW} WHERE id=$1`, [sessionId])
    return { ok: false, reason: verdict }
  }
  const token = generateToken()
  const expires = new Date(Date.now() + SESSION_TTL_HOURS * 3_600_000).toISOString()
  // Consume the OTP (clear it) and promote to a verified session.
  await pgQuery(
    `UPDATE customer_portal_sessions SET verified=1, token_hash=$2, expires_at=$3, otp_hash=NULL, otp_expires_at=NULL, updated_at=${NOW} WHERE id=$1`,
    [sessionId, sha256(token), expires])
  return { ok: true, token, customerId: s.customer_id }
}

/** Resolve the authenticated customer from a raw portal token (cookie value). */
export async function getPortalIdentity(token: string | undefined): Promise<PortalIdentity | null> {
  if (!token) return null
  const hash = sha256(token)
  const s = (await pgQuery<{ id: number; customer_id: number; token_hash: string | null; verified: number; revoked: number; expires_at: string | null }>(
    `SELECT id, customer_id, token_hash, verified, revoked, expires_at FROM customer_portal_sessions WHERE token_hash=$1 LIMIT 1`, [hash]))[0]
  if (!s) return null
  if (!isSessionValid({ tokenHash: s.token_hash, verified: s.verified, revoked: s.revoked, expiresAt: s.expires_at }, hash, new Date().toISOString())) return null
  return { customerId: s.customer_id, sessionId: s.id }
}

/** Log out: revoke this session (or all sessions for the customer). */
export async function revokeSession(sessionId: number): Promise<void> {
  await pgQuery(`UPDATE customer_portal_sessions SET revoked=1, updated_at=${NOW} WHERE id=$1`, [sessionId])
}
export async function revokeAllSessions(customerId: number): Promise<void> {
  await pgQuery(`UPDATE customer_portal_sessions SET revoked=1, updated_at=${NOW} WHERE customer_id=$1 AND revoked=0`, [customerId])
}
