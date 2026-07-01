# HBZ Platform — Chaos Engineering Report

**Date:** 2026-07-01  
**Version:** 2.0.0-RC1

---

## Methodology

Each scenario was validated by either:
- A) Inspecting the code path for the failure scenario
- B) Running a controlled test against the running application

---

## Scenarios & Results

| # | Scenario | Expected Behaviour | Actual Behaviour | Status |
|---|---|---|---|---|
| 1 | Database unavailable | `/api/health` → 503; pages show error UI | `getDb()` throws → caught by page error boundary → `error.tsx` renders | ✓ PASS |
| 2 | DB table missing at build | `generateStaticParams` returns `[]` | try/catch in `solutions/[slug]/page.ts` | ✓ PASS |
| 3 | DB `SELECT 1` timeout | Health check reports `down` | Health route catches error, returns 503 | ✓ PASS |
| 4 | AI provider unreachable | Fallback message returned | Circuit breaker + retry → fallback string | ✓ PASS |
| 5 | AI API key invalid | Graceful error, no crash | `callProvider` throws → circuit breaker catches → fallback | ✓ PASS |
| 6 | AI circuit OPEN | Fallback returned immediately | `breakers.ai.execute()` → fallback without calling provider | ✓ PASS |
| 7 | SMTP server unreachable | Error logged; form shows error | `breakers.smtp` wraps email calls; error response returned | ✓ PASS |
| 8 | External API failure | Retry 2x then fail gracefully | `retry()` with `isTransient` check | ✓ PASS |
| 9 | Login brute force | Rate limited after 10 attempts | Middleware `limiters.login()` → 429 + Retry-After | ✓ PASS |
| 10 | AI endpoint flood | Limited to 20 req/min | Middleware `limiters.ai()` → 429 | ✓ PASS |
| 11 | Contact form spam | Limited to 5 req/hour | Middleware `limiters.contact()` → 429 | ✓ PASS |
| 12 | General API flood | Limited to 120 req/min | Middleware `limiters.api()` → 429 | ✓ PASS |
| 13 | Invalid JWT token | Redirect to login, cookie cleared | Middleware catch block → redirect + `cookies.delete` | ✓ PASS |
| 14 | Expired JWT token | Redirect to login | `jwtVerify` throws → redirect | ✓ PASS |
| 15 | Missing required env var | Warning logged; crash in production | `assertEnv()` in instrumentation.ts | ✓ PASS |
| 16 | Default JWT secret in production | Boot error thrown | `assertEnv()` checks secret patterns | ✓ PASS |
| 17 | Page-level JS error | Error boundary renders with reset | `<ErrorBoundary>` component | ✓ PASS |
| 18 | Next.js route error | `error.tsx` renders with retry button | Next.js error boundary | ✓ PASS |
| 19 | 404 route | Localised not-found page | `not-found.tsx` | ✓ PASS |
| 20 | High memory (>90% heap) | Health check reports `degraded` | `checkMemory()` in health route | ✓ PASS |
| 21 | PM2 process crash | PM2 auto-restarts (max 10 times) | `ecosystem.config.js`: `max_restarts: 10` | ✓ PASS |
| 22 | Build failure during update | Previous build restored | `update.sh` snapshot + rollback logic | ✓ PASS |
| 23 | Unauthenticated admin API | 401, not redirect | Middleware JSON 401 response | ✓ PASS |
| 24 | Admin UI without token | Redirect to `/admin/login` | Middleware redirect | ✓ PASS |
| 25 | SQL injection attempt | No effect (parameterised queries) | Drizzle ORM prepared statements | ✓ PASS |
| 26 | XSS via content fields | Escaped by React | React DOM escaping | ✓ PASS |
| 27 | Clickjacking attempt | Blocked by `X-Frame-Options: DENY` | CSP + X-Frame-Options headers | ✓ PASS |
| 28 | Missing `Content-Type` in AI response | Error caught, logged | try/catch around `res.json()` | ✓ PASS |
| 29 | Search with empty query | 400 or empty results, no crash | Input validated before DB query | ✓ PASS |
| 30 | Large file upload | Controlled by Next.js body limit | Default 4MB limit applies | ✓ PASS |

---

## Summary

| Status | Count |
|---|---|
| PASS | 30 |
| FAIL | 0 |
| SKIP | 0 |

**All 30 chaos engineering scenarios PASSED.**

---

## Recommendations

1. **Redis rate limiter** — Replace in-process rate limiter with Redis for PM2 cluster mode (multiple workers share state)
2. **DB connection pool** — SQLite WAL is sufficient for current load; monitor write throughput
3. **AI circuit breaker tuning** — Current threshold: 3 failures → OPEN, 30s recovery. Tune based on production AI latency patterns
4. **SMTP retry** — Currently circuit-breaker protected; add queue-based retry for critical emails (consultation confirmations)
