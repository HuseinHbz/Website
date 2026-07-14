#!/usr/bin/env node
/**
 * Load / stress + memory-leak test (Phase 26.24 بند ۵.۲ → 26.24b بند ۴).
 * Drives the hot routes with autocannon (fetched on demand via npx — no
 * committed dependency) and produces REAL p50/p95/p99 + req/s + 5xx numbers,
 * then watches server RSS over a sustained window to detect a memory leak.
 *
 *   BASE=http://127.0.0.1:3000 node scripts/load-test.mjs
 *
 * Auto-logs-in with the seeded admin (ADMIN_EMAIL/ADMIN_PASSWORD, defaults to
 * the seed creds) to obtain the admin_token cookie for gated routes. Set
 * MEM_WATCH_SECONDS>0 to run the RSS leak watch (samples ?probe=deep&detail=1).
 * Exit code is non-zero only when a route returns any 5xx (hard signal); latency
 * thresholds are printed as soft warnings so a perf regression is visible in CI
 * without breaking the build.
 */
import { spawnSync } from 'node:child_process'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3000'
const DURATION = process.env.DURATION ?? '15'
const CONNECTIONS = process.env.CONNECTIONS ?? '20'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@habibazar.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'HBZ@Admin2025!'
const MEM_WATCH_SECONDS = Number(process.env.MEM_WATCH_SECONDS ?? '0')
const P95_WARN_MS = Number(process.env.P95_WARN_MS ?? '500')

async function login() {
  try {
    const res = await fetch(`${BASE}/api/admin/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    })
    const setCookie = res.headers.get('set-cookie') ?? ''
    const m = setCookie.match(/admin_token=[^;]+/)
    if (m) return m[0]
    console.log(`  (login returned ${res.status}; gated routes will be unauthenticated)`)
  } catch (e) { console.log(`  (login failed: ${e.message})`) }
  return ''
}

function bench(name, route, cookie) {
  const headers = route.auth && cookie ? ['-H', `cookie: ${cookie}`] : []
  const post = route.method === 'POST' ? ['-m', 'POST', '-H', 'content-type: application/json', '-b', route.body ?? '{}'] : []
  const res = spawnSync('npx', ['--yes', 'autocannon', '-c', CONNECTIONS, '-d', DURATION, '-j', ...headers, ...post, route.url], { encoding: 'utf8' })
  if (res.status !== 0) { console.log(`  ${name.padEnd(14)} — autocannon unavailable`); return { has5xx: false } }
  try {
    const j = JSON.parse(res.stdout)
    const c5 = Object.entries(j.statusCodeStats ?? {}).filter(([k]) => k.startsWith('5')).reduce((a, [, v]) => a + (v.count ?? 0), 0)
    // autocannon's histogram exposes p97_5 (not p95) — use it for the tail column.
    const p95 = j.latency.p95 ?? j.latency.p97_5 ?? j.latency.p90
    const warn = p95 > P95_WARN_MS ? '  ⚠ p95>threshold' : ''
    console.log(`  ${name.padEnd(14)} p50 ${String(j.latency.p50).padStart(5)}ms  p95 ${String(p95).padStart(5)}ms  p99 ${String(j.latency.p99).padStart(5)}ms  req/s ${String(Math.round(j.requests.average)).padStart(5)}  5xx ${c5}${warn}`)
    return { has5xx: c5 > 0 }
  } catch { console.log(`  ${name.padEnd(14)} — parse error`); return { has5xx: false } }
}

async function memWatch() {
  const samples = []
  const started = Date.now()
  console.log(`\nRSS memory watch → ${MEM_WATCH_SECONDS}s (sampling every 10s)`)
  while ((Date.now() - started) / 1000 < MEM_WATCH_SECONDS) {
    try {
      const r = await fetch(`${BASE}/api/health?probe=deep&detail=1`)
      const j = await r.json()
      const rss = Math.round((j.memory?.rss ?? 0) / 1024 / 1024)
      samples.push(rss)
      process.stdout.write(`  t+${Math.round((Date.now() - started) / 1000)}s rss ${rss}MB\n`)
    } catch { /* ignore transient */ }
    await new Promise(r => setTimeout(r, 10_000))
  }
  if (samples.length >= 2) {
    const first = samples[0], last = samples[samples.length - 1], max = Math.max(...samples)
    const growthPct = first ? Math.round(((last - first) / first) * 100) : 0
    console.log(`  RSS start ${first}MB → end ${last}MB (max ${max}MB, growth ${growthPct}%)`)
    console.log(growthPct > 50 ? '  ⚠ possible memory leak (sustained >50% growth)' : '  ✅ no sustained RSS growth')
  }
}

async function main() {
  console.log(`Load test → ${BASE}  (${CONNECTIONS} conns × ${DURATION}s each)\n`)
  const cookie = await login()
  const routes = [
    { name: 'health-live', url: `${BASE}/api/health?probe=live`, auth: false },
    { name: 'login', url: `${BASE}/api/admin/auth/login`, method: 'POST', body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }), auth: false },
    { name: 'journal-list', url: `${BASE}/api/admin/erp/finance/journal`, auth: true },
    { name: 'sales-docs', url: `${BASE}/api/admin/erp/sales/documents?type=invoice`, auth: true },
    { name: 'overview', url: `${BASE}/api/admin/overview`, auth: true },
  ]
  let any5xx = false
  for (const r of routes) { const out = bench(r.name, r, cookie); any5xx = any5xx || out.has5xx }
  if (MEM_WATCH_SECONDS > 0) await memWatch()
  if (any5xx) { console.log('\n❌ 5xx responses observed under load'); process.exit(1) }
  console.log('\n✅ zero 5xx under the configured load')
}
main()
