/**
 * Upload concurrency guard (26.34 бند۷). A sliding-window rate limiter
 * (requests per minute) doesn't bound what actually costs RAM/disk here:
 * several large uploads arriving at once each buffer their FULL file into
 * memory (`Buffer.from(await file.arrayBuffer())`) before any validation
 * runs, and each writes to disk concurrently — N simultaneous 100MB
 * uploads is a real N×100MB RAM spike and N-way disk contention
 * regardless of how many requests/minute a rate limiter would still
 * allow. This is a simple in-process counting semaphore, capping how
 * many uploads may be actively buffering/writing AT THE SAME TIME.
 *
 * Single-process (PM2 cluster: each worker has its own counter, matching
 * the existing rate limiter's own documented single-instance scope in
 * src/lib/rateLimit.ts) — acceptable for the same reason that one
 * already is: this app runs as a small, fixed number of PM2 workers, not
 * a large horizontally-scaled fleet where an in-process counter would
 * under-count real global concurrency.
 */
let active = 0

function envInt(name: string, fallback: number): number {
  const v = process.env[name]
  const n = v ? parseInt(v, 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** How many uploads (across ALL admin sessions on this process) may be
 *  actively buffering/writing at once. 6 is generous for a small admin
 *  team's realistic simultaneous usage while still bounding the worst
 *  case to a few hundred MB of transient RAM, not unbounded. */
export function maxConcurrentUploads(): number {
  return envInt('MEDIA_MAX_CONCURRENT_UPLOADS', 6)
}

export function activeUploadCount(): number {
  return active
}

/** Returns true and reserves a slot if one is free; false (reserves
 *  nothing) if the process is already at its concurrency cap. Caller
 *  MUST call releaseUploadSlot() in a `finally` once done, success or
 *  failure, or slots leak. */
export function tryAcquireUploadSlot(): boolean {
  if (active >= maxConcurrentUploads()) return false
  active++
  return true
}

export function releaseUploadSlot(): void {
  active = Math.max(0, active - 1)
}

/** Test-only: force the counter to a known state between test cases. */
export function __resetForTests(): void {
  active = 0
}
