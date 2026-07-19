/**
 * Global concurrent-login guard (Phase 26.25a بند ۰.۳). bcryptjs is pure-JS and
 * blocks the event loop (~460ms/hash). The per-IP rate limiter does not stop a
 * distributed flood (100 IPs × 10 req each stay under 10/15min yet can pin the
 * loop). This caps the number of password verifications running at once and
 * SHEDS the excess with 429 — bounding worst-case event-loop blocking to
 * `MAX_CONCURRENT_LOGINS × hashCost` instead of unbounded.
 */
export const MAX_CONCURRENT_LOGINS = 4

let inFlight = 0

/** Pure decision: should a new login be shed given the in-flight count + cap? */
export function shouldShedLogin(current: number, cap: number = MAX_CONCURRENT_LOGINS): boolean {
  return current >= cap
}

/** Try to acquire a login slot. Returns false (shed → 429) when at capacity. */
export function acquireLoginSlot(): boolean {
  if (shouldShedLogin(inFlight)) return false
  inFlight++
  return true
}

export function releaseLoginSlot(): void {
  if (inFlight > 0) inFlight--
}

/** Test/introspection helper. */
export function loginInFlight(): number {
  return inFlight
}
