#!/usr/bin/env node
/**
 * Load test (Phase 26.24 بند ۵.۲). Drives the hot routes with autocannon
 * (fetched on demand via npx — no committed dependency). Requires a running
 * server (npm start / blue-green colour) + an admin cookie for gated routes.
 *
 *   BASE=http://127.0.0.1:3000 COOKIE="admin_token=…" node scripts/load-test.mjs
 *
 * Prints p95/p99 latency + non-2xx count per route. Target: p95 < 500ms on the
 * read routes, 0 5xx under the configured connection count.
 */
import { spawnSync } from 'node:child_process'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3000'
const COOKIE = process.env.COOKIE ?? ''
const DURATION = process.env.DURATION ?? '15'
const CONNECTIONS = process.env.CONNECTIONS ?? '20'

const ROUTES = [
  { name: 'health-live', url: `${BASE}/api/health?probe=live`, auth: false },
  { name: 'health-deep', url: `${BASE}/api/health?probe=deep`, auth: false },
  { name: 'journal-list', url: `${BASE}/api/admin/erp/finance/journal`, auth: true },
  { name: 'sales-docs', url: `${BASE}/api/admin/erp/sales/documents?type=invoice`, auth: true },
  { name: 'overview', url: `${BASE}/api/admin/overview`, auth: true },
]

console.log(`Load test → ${BASE}  (${CONNECTIONS} conns × ${DURATION}s each)\n`)
for (const r of ROUTES) {
  const headers = r.auth && COOKIE ? ['-H', `cookie: ${COOKIE}`] : []
  const res = spawnSync('npx', ['--yes', 'autocannon', '-c', CONNECTIONS, '-d', DURATION, '-j', ...headers, r.url], { encoding: 'utf8' })
  if (res.status !== 0) { console.log(`  ${r.name.padEnd(14)} — autocannon unavailable (run: npx autocannon ${r.url})`); continue }
  try {
    const j = JSON.parse(res.stdout)
    console.log(`  ${r.name.padEnd(14)} p95 ${String(j.latency.p95).padStart(5)}ms  p99 ${String(j.latency.p99).padStart(5)}ms  non2xx ${j.non2xx}  req/s ${Math.round(j.requests.average)}`)
  } catch { console.log(`  ${r.name.padEnd(14)} — parse error`) }
}
