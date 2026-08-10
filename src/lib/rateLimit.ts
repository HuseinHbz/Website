/**
 * In-process rate limiter using a sliding window counter.
 * Suitable for single-instance deployments (PM2 cluster: each worker has its own store).
 * For multi-instance, replace the Map with a Redis-backed store.
 */

interface Window {
  count: number
  resetAt: number
}

const store = new Map<string, Window>()

// Cleanup stale entries every 5 minutes to avoid unbounded memory growth
setInterval(() => {
  const now = Date.now()
  for (const [key, win] of store) {
    if (win.resetAt < now) store.delete(key)
  }
}, 5 * 60 * 1000)

export interface RateLimitOptions {
  /** Maximum requests per window */
  limit: number
  /** Window duration in seconds */
  windowSec: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfter?: number
}

// 26.25 بند ۰: an explicit opt-in bypass for load/perf testing ONLY. It is a
// hard error to enable this in a real production deployment — the flag exists so
// `scripts/load-test.mjs` measures true 2xx throughput instead of 429 storms.
// Never set RATE_LIMIT_DISABLED=1 outside a throwaway benchmark environment.
// 26.25b بند ۰.۵: RATE_LIMIT_DISABLED is a benchmark-only knob and is a security
// hazard if it ever leaks into a real deployment. It is HARD-GATED to non-production
// — in production the flag is ignored even when set to '1'. `rateLimitBypassActive`
// is exported so instrumentation can loudly warn on a misconfiguration.
export function rateLimitBypassActive(): boolean {
  return process.env.RATE_LIMIT_DISABLED === '1' && process.env.NODE_ENV !== 'production'
}
const RATE_LIMIT_DISABLED = rateLimitBypassActive()

export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  if (RATE_LIMIT_DISABLED) return { allowed: true, remaining: opts.limit, resetAt: now + opts.windowSec * 1000 }
  const windowMs = opts.windowSec * 1000

  let win = store.get(key)
  if (!win || win.resetAt <= now) {
    win = { count: 0, resetAt: now + windowMs }
    store.set(key, win)
  }

  win.count++
  const remaining = Math.max(0, opts.limit - win.count)
  const allowed = win.count <= opts.limit

  return {
    allowed,
    remaining,
    resetAt: win.resetAt,
    retryAfter: allowed ? undefined : Math.ceil((win.resetAt - now) / 1000),
  }
}

/** Pre-configured limiters */
export const limiters = {
  /** Login: 10 attempts / 15 min per IP */
  login: (ip: string) => rateLimit(`login:${ip}`, { limit: 10, windowSec: 900 }),

  /** API: 120 req / min per IP */
  api: (ip: string) => rateLimit(`api:${ip}`, { limit: 120, windowSec: 60 }),

  /** AI: 20 req / min per IP */
  ai: (ip: string) => rateLimit(`ai:${ip}`, { limit: 20, windowSec: 60 }),

  /** Contact form: 5 req / hour per IP */
  contact: (ip: string) => rateLimit(`contact:${ip}`, { limit: 5, windowSec: 3600 }),

  /** Portal OTP request: 5 / 15 min per IP (stricter than public API). */
  portalOtp: (ip: string) => rateLimit(`potp:${ip}`, { limit: 5, windowSec: 900 }),

  /** Portal OTP verify: 10 / 15 min per IP (attempt cap is also per-session). */
  portalVerify: (ip: string) => rateLimit(`pver:${ip}`, { limit: 10, windowSec: 900 }),

  /** Employee-portal OTP request/verify (28.4) — same shape, separate bucket. */
  hrPortalOtp: (ip: string) => rateLimit(`hpotp:${ip}`, { limit: 5, windowSec: 900 }),
  hrPortalVerify: (ip: string) => rateLimit(`hpver:${ip}`, { limit: 10, windowSec: 900 }),
}
