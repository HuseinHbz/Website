/**
 * P0 fix — a real production incident: during `next build`'s static
 * generation, several concurrent SSG workers (441 pages) plus the still-
 * running PM2 instance can transiently exhaust Postgres's connection slots
 * ("sorry, too many clients already", PG code 53300). The public pages
 * already degrade to an empty state instead of a 500 on any query failure
 * (26.30 بند۱ — a deliberate, correct safety net, kept as-is) — but that
 * meant a purely TRANSIENT contention spike silently shipped empty content
 * to production (confirmed live: /industries, /technologies, /solutions
 * all built empty from exactly this error). A short retry-with-backoff
 * gives the transient case a real chance to resolve before falling back,
 * without weakening the existing "never throw, never 500" guarantee.
 */

/** Pure — no timers, no I/O. Isolated so the retry DECISION is unit-testable
 *  without touching a real database connection. */
export function shouldRetryDbError(error: unknown, attempt: number, maxAttempts: number): boolean {
  if (attempt >= maxAttempts) return false
  const code = (error as { code?: string } | null)?.code
  // 53300 too_many_connections, 08006/08001/08004 connection failures,
  // ECONNREFUSED/ETIMEDOUT for the raw socket layer. Never retry a real
  // query error (bad SQL, constraint violation, etc.) — those will fail
  // identically on retry and just delay the safe empty-state fallback.
  return code === '53300' || code === '08006' || code === '08001' || code === '08004'
    || code === 'ECONNREFUSED' || code === 'ETIMEDOUT'
}

const BACKOFF_MS = [300, 800]

/** Runs `fn`, retrying on a transient connection error per
 *  `shouldRetryDbError`, and only returning `fallback` after every attempt
 *  is exhausted — same call shape as the `.catch(() => fallback)` pattern
 *  this replaces, so call sites change minimally. */
export async function withDbRetry<T>(fn: () => Promise<T>, fallback: T, label: string): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastError = e
      if (!shouldRetryDbError(e, attempt, BACKOFF_MS.length)) break
      await new Promise(resolve => setTimeout(resolve, BACKOFF_MS[attempt]))
    }
  }
  console.error(`[${label}] query failed after retries — rendering empty state`, lastError)
  return fallback
}
