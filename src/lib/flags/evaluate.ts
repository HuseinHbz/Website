/**
 * Feature-flag evaluation (Phase 18) — pure & deterministic.
 *
 * A flag resolves for a given "subject" (a user id, tenant id, session, or a
 * stable string). Percentage rollout is deterministic: the same subject always
 * gets the same answer for a flag, and the enabled cohort grows monotonically as
 * the percentage increases — so raising the rollout never flips someone off.
 * No DB access here (unit-testable); the DB layer supplies the flag rows.
 */
import crypto from 'crypto'

export interface Flag {
  key: string
  enabled: boolean
  rolloutPercent: number // 0–100
}

/** Stable 0–99 bucket for (flagKey, subject). */
export function bucket(flagKey: string, subject: string): number {
  const h = crypto.createHash('sha1').update(`${flagKey}:${subject}`).digest()
  // Use the first 4 bytes as an unsigned int → 0–99.
  const n = h.readUInt32BE(0)
  return n % 100
}

/**
 * Is a flag on for this subject?
 *   - disabled flag → always false
 *   - rollout 100 → true; rollout 0 → false
 *   - otherwise → deterministic bucket < rolloutPercent
 * Subject defaults to 'global' (flag acts as a simple on/off when omitted).
 */
export function isEnabled(flag: Flag | undefined | null, subject = 'global'): boolean {
  if (!flag || !flag.enabled) return false
  const pct = Math.max(0, Math.min(100, flag.rolloutPercent))
  if (pct >= 100) return true
  if (pct <= 0) return false
  return bucket(flag.key, subject) < pct
}

/** Evaluate every flag for a subject → a `{ key: boolean }` map. */
export function evaluateAll(flags: Flag[], subject = 'global'): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const f of flags) out[f.key] = isEnabled(f, subject)
  return out
}
