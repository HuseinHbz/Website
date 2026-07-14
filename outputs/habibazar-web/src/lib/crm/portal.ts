/**
 * Customer-portal auth primitives (Phase 26.25 بند ۲) — INDEPENDENT of the admin
 * JWT. Pure/deterministic helpers (crypto is deterministic): token + OTP
 * generation, sha256 hashing (raw secrets are never stored), and the validity /
 * ownership predicates the routes enforce. No DB, no admin session, no shared key.
 */
import { createHash, randomBytes, randomInt } from 'node:crypto'

/** sha256 hex — used to store token/OTP hashes, never the raw value. */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

/** A 6-digit numeric OTP (crypto-random, zero-padded). */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

/** A 256-bit opaque session token (hex). The client holds this; we store its hash. */
export function generateToken(): string {
  return randomBytes(32).toString('hex')
}

export interface OtpRecord {
  otpHash: string | null
  otpExpiresAt: string | null   // ISO
  attempts: number
  verified: number
}

export const MAX_OTP_ATTEMPTS = 5

export type OtpCheck = 'ok' | 'no_pending' | 'expired' | 'too_many_attempts' | 'mismatch'

/** Validate a submitted OTP against the stored hash + expiry + attempt cap. */
export function checkOtp(rec: OtpRecord, code: string, nowIso: string): OtpCheck {
  if (!rec.otpHash || !rec.otpExpiresAt) return 'no_pending'
  if (rec.attempts >= MAX_OTP_ATTEMPTS) return 'too_many_attempts'
  if (Date.parse(nowIso) > Date.parse(rec.otpExpiresAt)) return 'expired'
  return sha256(code) === rec.otpHash ? 'ok' : 'mismatch'
}

export interface SessionRecord {
  tokenHash: string | null
  verified: number
  revoked: number
  expiresAt: string | null   // ISO
}

/** Is a post-verify session token still valid right now? */
export function isSessionValid(rec: SessionRecord, tokenHash: string, nowIso: string): boolean {
  if (!rec.verified || rec.revoked) return false
  if (!rec.tokenHash || rec.tokenHash !== tokenHash) return false
  if (!rec.expiresAt) return false
  return Date.parse(nowIso) <= Date.parse(rec.expiresAt)
}

/**
 * Ownership guard (بند ۲.۵ — IDOR). A portal request may only touch a resource
 * that belongs to the authenticated customer. Returns true only when the
 * resource's customer_id matches the session's customer_id.
 */
export function ownsResource(sessionCustomerId: number, resourceCustomerId: number | null | undefined): boolean {
  return resourceCustomerId != null && sessionCustomerId === resourceCustomerId
}

/** OTP validity window (minutes) and session lifetime (hours). */
export const OTP_TTL_MIN = 5
export const SESSION_TTL_HOURS = 24
