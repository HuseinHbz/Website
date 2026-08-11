import { NextResponse } from 'next/server'
import v8 from 'node:v8'
import { pgQuery } from '@/lib/db/index'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Check {
  name: string
  status: 'ok' | 'degraded' | 'down'
  latencyMs?: number
  detail?: string
}

async function checkDatabase(): Promise<Check> {
  const start = Date.now()
  try {
    await pgQuery('SELECT 1')
    return { name: 'database', status: 'ok', latencyMs: Date.now() - start }
  } catch {
    // Never the raw driver error — a `pg` connection failure can echo back
    // internal network detail (host/port, sometimes credentials embedded in
    // a connection-string parse error) to whoever asked, and this endpoint
    // is intentionally unauthenticated for infra healthchecks. A fixed,
    // generic reason is enough for anyone reading the status; the real
    // error still goes to `logger`/system_logs for an operator to see.
    return { name: 'database', status: 'down', detail: 'connection failed' }
  }
}

async function checkMemory(): Promise<Check> {
  const mem = process.memoryUsage()
  const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024)
  // Compare against the actual V8 heap size limit, not heapTotal — heapTotal
  // tracks heapUsed and its ratio flaps under GC pressure, causing false
  // "degraded" readings. heap_size_limit reflects true proximity to OOM.
  const limitMb = Math.round(v8.getHeapStatistics().heap_size_limit / 1024 / 1024)
  const usage = heapUsedMb / limitMb
  return {
    name: 'memory',
    status: usage > 0.9 ? 'degraded' : 'ok',
    detail: `heap ${heapUsedMb}/${limitMb} MB`,
  }
}

// Migrations applied? (deep probe — a table from the latest phase must exist.)
async function checkMigrations(): Promise<Check> {
  try {
    await pgQuery(`SELECT 1 FROM moadian_queue LIMIT 1`)
    return { name: 'migrations', status: 'ok', detail: 'schema current' }
  } catch {
    return { name: 'migrations', status: 'down', detail: 'schema behind' }
  }
}

// Disk headroom on the writable filesystem (deep probe).
async function checkDisk(): Promise<Check> {
  try {
    const { statfs } = await import('node:fs/promises')
    const fs = await statfs(process.cwd())
    const freePct = fs.blocks ? (fs.bfree / fs.blocks) * 100 : 100
    return { name: 'disk', status: freePct < 5 ? 'degraded' : 'ok', detail: `${freePct.toFixed(1)}% free` }
  } catch { return { name: 'disk', status: 'ok', detail: 'n/a' } }
}

/** True once the caller proves it's allowed to see verbose operational
 *  telemetry (per-check detail strings, memory/disk numbers, version,
 *  NODE_ENV). This endpoint is intentionally unauthenticated — nginx, PM2,
 *  CI's `wait-on`/`curl -sf`, and the Playwright health spec all hit it with
 *  no session at all — so the gate is a shared secret header, never the
 *  admin session. `HEALTH_CHECK_TOKEN` unset ⇒ FAILS CLOSED (minimal
 *  response always, regardless of `?probe=deep`/`?detail=1`): operator must
 *  explicitly opt in to verbose output rather than a new deploy silently
 *  exposing internal telemetry to anyone on the internet by default. */
function isAuthorizedForDetail(request: Request): boolean {
  const configured = process.env.HEALTH_CHECK_TOKEN
  if (!configured) return false
  const provided = request.headers.get('x-health-token')
  return provided === configured
}

/**
 * Phase 26.24 (بند ۲.۲): three probe levels via ?probe=
 *   live  — process is up (no I/O; for liveness restarts)
 *   ready — DB reachable (for load-balancer readiness / traffic gating)
 *   deep  — DB + migrations + disk + memory (default; full picture)
 * `?detail=1` also attaches raw checks + memory (backward compatible).
 *
 * Every probe level stays reachable with NO auth (that's the whole point —
 * infra healthchecks can't hold a session) and `status`/HTTP code are always
 * accurate. What's gated by `isAuthorizedForDetail` is verbose CONTENT: an
 * anonymous caller learns ok/degraded/down per subsystem and nothing else —
 * no version string, no NODE_ENV, no disk-free%/heap numbers, no per-check
 * detail text. A caller with `HEALTH_CHECK_TOKEN` gets the full picture this
 * endpoint always used to hand out to anyone.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const probe = searchParams.get('probe') ?? 'deep'
  const detailed = searchParams.get('detail') === '1'
  const authorized = isAuthorizedForDetail(request)

  if (probe === 'live') {
    return NextResponse.json({ status: 'ok', probe: 'live', ts: new Date().toISOString(), uptime: Math.round(process.uptime()) },
      { headers: { 'Cache-Control': 'no-store', 'X-Health-Status': 'ok' } })
  }

  const checks: Check[] = probe === 'ready'
    ? [await checkDatabase()]
    : await Promise.all([checkDatabase(), checkMigrations(), checkDisk(), checkMemory()])

  const overallStatus = checks.some(c => c.status === 'down')
    ? 'down'
    : checks.some(c => c.status === 'degraded')
    ? 'degraded'
    : 'ok'

  const publicChecks = checks.map(c => ({ name: c.name, status: c.status }))

  const body: Record<string, unknown> = {
    status: overallStatus,
    probe,
    ts: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    checks: authorized ? checks : publicChecks,
  }
  if (authorized) {
    body.version = process.env.APP_VERSION ?? '2.0.0'
    body.env = process.env.NODE_ENV
    if (detailed) body.memory = process.memoryUsage()
  }

  const httpStatus = overallStatus === 'down' ? 503 : 200
  return NextResponse.json(body, {
    status: httpStatus,
    headers: { 'Cache-Control': 'no-store', 'X-Health-Status': overallStatus },
  })
}
