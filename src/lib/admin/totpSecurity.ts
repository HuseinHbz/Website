/**
 * Phase 26.27 بند ۵ — 2FA hardening primitives.
 *
 * 5.4 Encryption at rest: TOTP secrets are stored AES-256-GCM encrypted
 *     (`enc:v1:<iv>:<tag>:<data>` base64url). Legacy plaintext secrets still
 *     decode (passthrough) so existing users keep working; they are upgraded
 *     to the encrypted form on the next write.
 * 5.2 Replay guard: the consumed TOTP time-step is persisted per user
 *     (`users.totp_last_step`); a code from a step ≤ the last consumed one is
 *     rejected even if cryptographically valid.
 * 5.3 Dedicated rate limit: per-user failed-attempt counter with a temporary
 *     lock (5 fails → 10 minutes).
 * 5.1 Recovery codes: 10 single-use codes, stored sha256-hashed, shown once.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'crypto'
import { pgQuery } from '@/lib/db'
import { verifyTotpCode } from './auth'

const ENC_PREFIX = 'enc:v1:'
const TOTP_STEP_SEC = 30
const MAX_FAILS = 5
const LOCK_MINUTES = 10

function encKey(): Buffer {
  const raw = process.env.TOTP_ENC_KEY || process.env.ADMIN_JWT_SECRET || 'HBZ-Admin-Secret-Key-2025-Change-In-Production'
  return createHash('sha256').update(raw).digest()
}

/** Encrypt a TOTP secret for storage. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encKey(), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${ENC_PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${data.toString('base64url')}`
}

/** Decrypt a stored secret; legacy plaintext passes through unchanged (5.4 migration). */
export function decryptSecret(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) return stored
  const [ivB, tagB, dataB] = stored.slice(ENC_PREFIX.length).split(':')
  const decipher = createDecipheriv('aes-256-gcm', encKey(), Buffer.from(ivB, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(dataB, 'base64url')), decipher.final()]).toString('utf8')
}

export function isEncryptedSecret(stored: string): boolean {
  return stored.startsWith(ENC_PREFIX)
}

export type TotpVerdict = 'ok' | 'invalid' | 'replayed' | 'locked'

/**
 * Guarded TOTP verification (5.2 replay + 5.3 rate limit). Persists the
 * consumed step on success and the fail counter / lock on failure.
 */
export async function verifyTotpGuarded(userId: string, storedSecret: string, code: string): Promise<TotpVerdict> {
  const row = (await pgQuery<{ totp_last_step: string | null; totp_fail_count: number; totp_locked_until: string | null }>(
    `SELECT totp_last_step, totp_fail_count, totp_locked_until FROM users WHERE id=$1`, [userId]))[0]
  const now = Date.now()
  if (row?.totp_locked_until && new Date(row.totp_locked_until).getTime() > now) return 'locked'

  const secret = decryptSecret(storedSecret)
  const step = Math.floor(now / 1000 / TOTP_STEP_SEC)
  if (!verifyTotpCode(code, secret)) {
    const fails = (row?.totp_fail_count ?? 0) + 1
    const lock = fails >= MAX_FAILS ? new Date(now + LOCK_MINUTES * 60_000).toISOString() : null
    await pgQuery(`UPDATE users SET totp_fail_count=$2, totp_locked_until=$3 WHERE id=$1`,
      [userId, fails >= MAX_FAILS ? 0 : fails, lock])
    return lock ? 'locked' : 'invalid'
  }
  const lastStep = row?.totp_last_step != null ? Number(row.totp_last_step) : null
  // otplib accepts a ±1-step window; consuming `step` blocks that whole window on replay
  if (lastStep != null && step <= lastStep) return 'replayed'
  await pgQuery(`UPDATE users SET totp_last_step=$2, totp_fail_count=0, totp_locked_until=NULL WHERE id=$1`, [userId, step])
  return 'ok'
}

const hashCode = (code: string) => createHash('sha256').update(code.toLowerCase()).digest('hex')

/** Generate 10 fresh single-use recovery codes (plaintext — show once). */
export function generateRecoveryCodes(): string[] {
  return Array.from({ length: 10 }, () => randomBytes(5).toString('hex'))
}

/** Replace a user's recovery codes; returns the plaintext codes exactly once. */
export async function issueRecoveryCodes(userId: string): Promise<string[]> {
  const codes = generateRecoveryCodes()
  await pgQuery(`DELETE FROM admin_recovery_codes WHERE user_id=$1`, [userId])
  for (const c of codes) {
    await pgQuery(`INSERT INTO admin_recovery_codes (user_id, code_hash) VALUES ($1,$2)`, [userId, hashCode(c)])
  }
  return codes
}

export async function remainingRecoveryCodes(userId: string): Promise<number> {
  const r = await pgQuery<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM admin_recovery_codes WHERE user_id=$1 AND used_at IS NULL`, [userId])
  return Number(r[0]?.n ?? 0)
}

/** Consume a recovery code (single-use, timing-safe compare). True on success. */
export async function consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
  if (!/^[0-9a-fA-F]{10}$/.test(code)) return false
  const target = Buffer.from(hashCode(code))
  const rows = await pgQuery<{ id: number; code_hash: string }>(
    `SELECT id, code_hash FROM admin_recovery_codes WHERE user_id=$1 AND used_at IS NULL`, [userId])
  for (const r of rows) {
    const stored = Buffer.from(r.code_hash)
    if (stored.length === target.length && timingSafeEqual(stored, target)) {
      await pgQuery(`UPDATE admin_recovery_codes SET used_at=NOW()::text WHERE id=$1`, [r.id])
      return true
    }
  }
  return false
}
