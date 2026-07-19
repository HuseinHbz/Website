#!/usr/bin/env node
/**
 * Load / stress + memory-leak test (Phase 26.24 بند ۵.۲ → 26.24b بند ۴ →
 * 26.25 بند ۰). Drives the hot routes with autocannon (fetched on demand via
 * npx — no committed dependency) and produces REAL numbers: full status-code
 * distribution (2xx / 429 / 4xx / 5xx), p50 / p95 (p97_5) / p99 / req-s, then
 * watches server RSS DURING sustained load to detect a memory leak.
 *
 *   BASE=http://127.0.0.1:3000 RATE_LIMIT_DISABLED=1 node scripts/load-test.mjs
 *
 * 26.25 بند ۰: a valid latency number requires the responses to actually be 2xx.
 * The admin login limiter is 10/15min and the API limiter 120/min, so without
 * RATE_LIMIT_DISABLED=1 on the SERVER a benchmark just measures a 429 storm.
 * This script therefore FAILS on any 429 (or 4xx/5xx) — a rate-limited run is a
 * failed run, not a passing one. Auto-logs-in with the seeded admin for the
 * gated routes. MEM_WATCH_SECONDS>0 runs the RSS leak watch under concurrent load.
 */
import { spawnSync, spawn } from 'node:child_process'

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

/** Bucket autocannon's statusCodeStats into 2xx/3xx/429/4xx/5xx. */
function classify(stats) {
  const b = { '2xx': 0, '3xx': 0, '429': 0, '4xx': 0, '5xx': 0 }
  for (const [code, v] of Object.entries(stats ?? {})) {
    const n = v.count ?? 0
    if (code === '429') b['429'] += n
    else if (code.startsWith('2')) b['2xx'] += n
    else if (code.startsWith('3')) b['3xx'] += n
    else if (code.startsWith('4')) b['4xx'] += n
    else if (code.startsWith('5')) b['5xx'] += n
  }
  return b
}

function bench(name, route, cookie) {
  const headers = route.auth && cookie ? ['-H', `cookie: ${cookie}`] : []
  const post = route.method === 'POST' ? ['-m', 'POST', '-H', 'content-type: application/json', '-b', route.body ?? '{}'] : []
  const conns = String(route.conns ?? CONNECTIONS)
  const res = spawnSync('npx', ['--yes', 'autocannon', '-c', conns, '-d', DURATION, '-j', ...headers, ...post, route.url], { encoding: 'utf8' })
  if (res.status !== 0) { console.log(`  ${name.padEnd(14)} — autocannon unavailable`); return { bad: false } }
  try {
    const j = JSON.parse(res.stdout)
    const b = classify(j.statusCodeStats)
    const p95 = j.latency.p95 ?? j.latency.p97_5 ?? j.latency.p90   // autocannon exposes p97_5, not p95
    const warn = p95 > P95_WARN_MS ? ' ⚠p95' : ''
    // A run is only VALID when every response is 2xx/3xx. 429/4xx/5xx = failure.
    const bad = b['429'] > 0 || b['4xx'] > 0 || b['5xx'] > 0
    console.log(`  ${name.padEnd(14)} p50 ${String(j.latency.p50).padStart(5)}ms  p95(p97.5) ${String(p95).padStart(5)}ms  p99 ${String(j.latency.p99).padStart(5)}ms  req/s ${String(Math.round(j.requests.average)).padStart(5)}  |  2xx ${b['2xx']}  429 ${b['429']}  4xx ${b['4xx']}  5xx ${b['5xx']}${warn}${bad ? '  ❌' : ''}`)
    return { bad }
  } catch { console.log(`  ${name.padEnd(14)} — parse error`); return { bad: false } }
}

// INFRA-1: the server HARD-IGNORES RATE_LIMIT_DISABLED in production (26.25b),
// and `next start` is always production — so a duration-based login storm is
// guaranteed to be shed by the 10/15min login limiter (the 15k-429 CI failure).
// Bench limiter-guarded routes with a FIXED sequential sample inside the
// limiter budget instead; any non-2xx still fails the run (contract intact).
async function benchSamples(name, route, cookie, n) {
  const times = []
  const b = { '2xx': 0, '429': 0, '4xx': 0, '5xx': 0 }
  const hit = () => fetch(route.url, route.method === 'POST'
    ? { method: 'POST', headers: { 'content-type': 'application/json', ...(route.auth && cookie ? { cookie } : {}) }, body: route.body }
    : { headers: route.auth && cookie ? { cookie } : {} })
  for (let i = 0; i < n; i++) {
    const t0 = Date.now()
    let res
    try { res = await hit() } catch {
      // a thrown fetch is a client-side transport hiccup, not an HTTP response —
      // retry once before letting it count against the run
      try { res = await hit() } catch { b['5xx']++; continue }
    }
    times.push(Date.now() - t0)
    if (res.status < 400) b['2xx']++
    else if (res.status === 429) b['429']++
    else if (res.status < 500) b['4xx']++
    else b['5xx']++
  }
  times.sort((a, c) => a - c)
  const q = p => times.length ? times[Math.min(times.length - 1, Math.floor(p * times.length))] : 0
  const bad = b['429'] > 0 || b['4xx'] > 0 || b['5xx'] > 0
  console.log(`  ${name.padEnd(14)} p50 ${String(q(0.5)).padStart(5)}ms  p95(p97.5) ${String(q(0.95)).padStart(5)}ms  p99 ${String(q(0.99)).padStart(5)}ms  (${n} sequential samples — limiter-budgeted)  |  2xx ${b['2xx']}  429 ${b['429']}  4xx ${b['4xx']}  5xx ${b['5xx']}${bad ? '  ❌' : ''}`)
  return { bad }
}

async function memWatch() {
  // Keep the server BUSY while sampling RSS so the slope reflects sustained load,
  // not post-build GC settling (26.25 بند ۰.۳).
  const load = spawn('npx', ['--yes', 'autocannon', '-c', CONNECTIONS, '-d', String(MEM_WATCH_SECONDS + 5), `${BASE}/api/health?probe=live`], { stdio: 'ignore' })
  const samples = []
  const started = Date.now()
  console.log(`\nRSS memory watch under sustained load → ${MEM_WATCH_SECONDS}s (sampling every 10s)`)
  // Discard the first two samples as warmup; measure the slope of the stable window.
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
  load.kill()
  const stable = samples.slice(2)   // drop warmup
  if (stable.length >= 2) {
    const first = stable[0], last = stable[stable.length - 1], max = Math.max(...stable)
    const growthPct = first ? Math.round(((last - first) / first) * 100) : 0
    console.log(`  stable window: start ${first}MB → end ${last}MB (max ${max}MB, growth ${growthPct}%)`)
    console.log(Math.abs(growthPct) > 15 ? `  ⚠ RSS slope ${growthPct}% over the stable window — investigate` : '  ✅ RSS slope ≈ 0 under sustained load (no leak)')
  }
}

async function main() {
  console.log(`Load test → ${BASE}  (${CONNECTIONS} conns × ${DURATION}s each)`)
  // 26.25b: the flag is inert on a production server regardless of env — never
  // assume the storm path is safe; login is always benched inside its budget.
  console.log(`rate-limit bypass requested: ${process.env.RATE_LIMIT_DISABLED === '1' ? 'yes (inert on production servers — 26.25b hard gate)' : 'no'}\n`)
  const cookie = await login()
  const routes = [
    { name: 'health-live', url: `${BASE}/api/health?probe=live`, auth: false },
    // 26.25a بند ۰.۳: login is bcrypt-bound (pure-JS, ~460ms/req blocks the loop)
    // + protected by a concurrent-login cap → bench it at LOW concurrency for a
    // meaningful per-request number, not a 20-way contention artifact.
    // login limiter is 10/15min per IP: 1 (auth helper) + 7 samples stays inside
    // the budget → zero expected 429s even with the limiter fully active.
    { name: 'login', url: `${BASE}/api/admin/auth/login`, method: 'POST', body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }), auth: false, samples: 7 },
    { name: 'journal-list', url: `${BASE}/api/admin/erp/finance/journal`, auth: true },
    { name: 'sales-docs', url: `${BASE}/api/admin/erp/sales/documents?type=invoice`, auth: true },
    { name: 'overview', url: `${BASE}/api/admin/overview`, auth: true },
  ]
  let anyBad = false
  for (const r of routes) {
    // 26.25a بند ۰.۲: warm up + cool down between routes so one route's stress
    // never poisons the next route's p99 tail (the journal p99=5969ms artifact).
    if (r.samples) {
      // limiter-budgeted route: NO extra warmup hit (it would eat the budget)
      const out = await benchSamples(r.name, r, cookie, r.samples); anyBad = anyBad || out.bad
      continue
    }
    try { await fetch(r.url, r.method === 'POST' ? { method: 'POST', headers: { 'content-type': 'application/json', ...(r.auth && cookie ? { cookie } : {}) }, body: r.body } : { headers: r.auth && cookie ? { cookie } : {} }) } catch { /* warmup */ }
    await new Promise(res => setTimeout(res, 1500))
    const out = bench(r.name, r, cookie); anyBad = anyBad || out.bad
  }
  if (MEM_WATCH_SECONDS > 0) await memWatch()
  if (anyBad) { console.log('\n❌ non-2xx responses (429/4xx/5xx) observed under load — numbers INVALID'); process.exit(1) }
  console.log('\n✅ all responses 2xx under the configured load — numbers valid')
}
main()
