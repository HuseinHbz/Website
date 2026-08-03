/**
 * Phase 26.32 بند ۳ — EMPIRICAL checks for the two error classes that 26.26c
 * closed by ARGUMENT rather than by measurement.
 *
 *  1. double-submit — fires two genuinely CONCURRENT POSTs at each create
 *     endpoint with an identical body and counts the rows that actually landed
 *     in PostgreSQL. Two rows = the class is real for that module. (When first
 *     run it was real for 3 of 6 endpoints.)
 *  2. contract drift (26.26 BUG-012) — asks the running server what each
 *     list-bound endpoint really returns and compares it with the array
 *     contract the manager component binds. The failure is silent: 200, no
 *     error, table empty forever.
 *
 * Usage: npm run audit:modules:classes   (AUDIT_STRICT=1 fails the build)
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const STRICT = process.env.AUDIT_STRICT === '1'
const BASE = process.env.AUDIT_BASE || 'http://localhost:3001'
let cookie = ''

const CASES: { name: string; route: string; body: Record<string, unknown>; table: string; where: string }[] = [
  { name: 'blog', route: 'blog', body: { titleEn: 'DS32 Post', titleFa: 'دی‌اس', status: 'draft' }, table: 'blog_posts', where: "title_en='DS32 Post'" },
  { name: 'skills', route: 'skills', body: { nameEn: 'DS32', nameFa: 'دی‌اس', categoryEn: 'net', categoryFa: 'شبکه', level: 80 }, table: 'skills', where: "name_en='DS32'" },
  { name: 'timeline', route: 'timeline', body: { year: '2026', titleEn: 'DS32 TL', titleFa: 'دی‌اس' }, table: 'timeline_items', where: "title_en='DS32 TL'" },
  { name: 'partners', route: 'partners', body: { nameEn: 'DS32 P', nameFa: 'دی‌اس' }, table: 'partners', where: "name_en='DS32 P'" },
  { name: 'crm-leads', route: 'crm/leads', body: { name: 'DS32 Lead', email: 'ds32@example.com', source: 'other' }, table: 'crm_leads', where: "name='DS32 Lead'" },
  { name: 'sales-customer', route: 'erp/sales/customers', body: { code: 'DS32C', name: 'DS32 Cust', kind: 'company' }, table: 'sales_customers', where: "name='DS32 Cust'" },
  { name: 'docs', route: 'docs', body: { titleEn: 'DS32 Doc', titleFa: 'دی‌اس' }, table: 'docs', where: "title_en='DS32 Doc'" },
  { name: 'solutions', route: 'solutions', body: { nameEn: 'DS32 Sol', nameFa: 'دی‌اس' }, table: 'solutions', where: "name_en='DS32 Sol'" },
  { name: 'products', route: 'products', body: { nameEn: 'DS32 Prod', nameFa: 'دی‌اس' }, table: 'products', where: "name_en='DS32 Prod'" },
  { name: 'projects', route: 'projects', body: { nameEn: 'DS32 Proj', nameFa: 'دی‌اس' }, table: 'projects', where: "name_en='DS32 Proj'" },
  { name: 'courses', route: 'courses', body: { titleEn: 'DS32 Course', titleFa: 'دی‌اس' }, table: 'courses', where: "title_en='DS32 Course'" },
  { name: 'technologies', route: 'technologies', body: { nameEn: 'DS32 Tech', nameFa: 'دی‌اس' }, table: 'technologies', where: "name_en='DS32 Tech'" },
  { name: 'industries', route: 'industries', body: { nameEn: 'DS32 Ind', nameFa: 'دی‌اس' }, table: 'industries', where: "name_en='DS32 Ind'" },
  { name: 'content', route: 'content', body: { type: 'doc', titleEn: 'DS32 Cnt', titleFa: 'دی‌اس' }, table: 'content', where: "title_en='DS32 Cnt'" },
  { name: 'organizations', route: 'organizations', body: { nameEn: 'DS32 Org', nameFa: 'دی‌اس' }, table: 'organizations', where: "name_en='DS32 Org'" },
]

async function main() {
  const login = await fetch(`${BASE}/api/admin/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@habibazar.com', password: 'HBZ@Admin2025!' }),
  })
  cookie = (login.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ')
  if (!cookie) { console.error('login failed', login.status); process.exit(1) }

  const { pgQuery } = await import('@/lib/db')
  const findings: string[] = []

  for (const c of CASES) {
    const post = () => fetch(`${BASE}/api/admin/${c.route}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify(c.body),
    }).then(r => r.status)
    const [a, b] = await Promise.all([post(), post()])
    let rows = 0
    try {
      const r = await pgQuery<{ n: string }>(`SELECT count(*)::text AS n FROM ${c.table} WHERE ${c.where}`)
      rows = Number(r[0]?.n ?? 0)
    } catch (e) { console.log(`  ${c.name}: count failed — ${(e as Error).message}`); continue }
    const dup = rows > 1
    console.log(`${dup ? '❌' : '✅'} ${c.name.padEnd(16)} statuses=${a},${b}  rows=${rows}`)
    if (dup) findings.push(`${c.name}: ${rows} rows from 2 concurrent POSTs`)
    // cleanup
    await pgQuery(`DELETE FROM ${c.table} WHERE ${c.where}`)
  }

  console.log(`\nDuplicate-creating modules: ${findings.length}/${CASES.length}`)
  findings.forEach(f => console.log('  - ' + f))

  const drift = await driftCheck()
  const failed = findings.length + drift
  console.log(`\n${failed === 0 ? '✅' : '❌'} error classes — double-submit: ${findings.length} · contract drift: ${drift}`)
  process.exit(STRICT && failed > 0 ? 1 : 0)
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.tsx')) out.push(p)
  }
  return out
}

/**
 * A manager that binds a list renders the parsed body AS AN ARRAY. If the
 * endpoint answers with an object the table is empty forever — with a 200 and
 * nothing in the console. Both halves look right in isolation, which is exactly
 * why reading the code missed this class twice.
 */
async function driftCheck(): Promise<number> {
  const listBound = new Map<string, string>()
  for (const file of walk('src/app/admin')) {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/useResource<[^>]*>\(\s*[`'"]([^`'"?]+)/g)) listBound.set(m[1], file)
    for (const m of src.matchAll(/fetch\(\s*[`'"](\/api\/admin\/[^`'"?]+)[^)]*\)[\s\S]{0,200}?set\w+\(await\s+res\w*\.json\(\)\)/g)) {
      if (!listBound.has(m[1])) listBound.set(m[1], file)
    }
    for (const m of src.matchAll(
      /fetch\(\s*[`'"](\/api\/admin\/[^`'"?]+)[^)]*\)[\s\S]{0,240}?const\s+(\w+)\s*=\s*await\s+res\w*\.json\(\)[\s\S]{0,240}?set\w+\(\s*\2\s*\)/g)) {
      if (!listBound.has(m[1])) listBound.set(m[1], file)
    }
  }

  let drift = 0, ok = 0, skipped = 0
  for (const [ep, file] of [...listBound].sort()) {
    const res = await fetch(`${BASE}${ep}`, { headers: { cookie } })
    if (res.status !== 200) { skipped++; continue }
    let body: unknown
    try { body = await res.json() } catch { skipped++; continue }
    if (Array.isArray(body)) { ok++; continue }
    const keys = body && typeof body === 'object' ? Object.keys(body as object) : []
    console.log(`❌ DRIFT ${ep} — bound as a list by ${file.replace('src/app/admin/', '')} but returns an OBJECT [${keys.slice(0, 8).join(', ')}]`)
    drift++
  }
  console.log(`Contract drift — list-bound endpoints live-checked: ${ok + drift} (${skipped} unreachable) · OK: ${ok} · drift: ${drift}`)
  return drift
}

main()
