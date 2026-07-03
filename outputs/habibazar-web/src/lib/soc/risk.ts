/**
 * SOC (Security Operations Center) risk scoring — pure, deterministic, testable.
 *
 * Derives an overall risk level from aggregated security signal counts so the
 * SOC dashboard shows a single headline posture. No DB access here.
 */

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface SecuritySignals {
  failedLogins: number
  bruteForceIps: number      // distinct IPs with many failed logins
  injectionBlocks: number    // AI prompt-injection / jailbreak blocks
  permissionDenied: number   // 403 / RBAC violations
  rateLimited: number        // 429 rate-limit hits
  securityErrors: number     // security-source error logs
}

// Weighted contribution of each signal to the risk score.
const WEIGHTS: Record<keyof SecuritySignals, number> = {
  failedLogins: 1,
  bruteForceIps: 15,
  injectionBlocks: 8,
  permissionDenied: 6,
  rateLimited: 2,
  securityErrors: 10,
}

/** Weighted risk score (unbounded ≥ 0). */
export function riskScore(s: SecuritySignals): number {
  return (Object.keys(WEIGHTS) as (keyof SecuritySignals)[])
    .reduce((sum, k) => sum + Math.max(0, s[k] ?? 0) * WEIGHTS[k], 0)
}

/** Map the score to a level. Any brute-force or security error escalates. */
export function riskLevel(s: SecuritySignals): RiskLevel {
  const score = riskScore(s)
  if (s.bruteForceIps >= 3 || s.securityErrors >= 10 || score >= 120) return 'critical'
  if (s.bruteForceIps >= 1 || score >= 50) return 'high'
  if (score >= 15) return 'medium'
  return 'low'
}
