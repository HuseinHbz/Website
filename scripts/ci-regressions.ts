/**
 * Regression runner (Phase 26.25b بند ۰.۱). Runs ALL committed live-PG regression
 * suites, each against its OWN fresh database (created on the postgres service), so
 * every future phase must keep the enterprise history green. Fails the job if any
 * suite fails. Reuses the DATABASE_URL host/credentials from the environment.
 */
import { Client } from 'pg'
import { spawnSync } from 'node:child_process'

const SUITES = [
  { name: '26.20 self-heal', script: 'verify-2620.ts', db: 'rg_2620' },
  { name: '26.21 two-year simulation', script: 'sim-2621.ts', db: 'rg_2621' },
  { name: '26.23 GL/CRM', script: 'verify-2623.ts', db: 'rg_2623' },
  { name: '26.24 hardening/Iran', script: 'verify-2624.ts', db: 'rg_2624' },
  { name: '26.24b closeout (AP non-negative)', script: 'verify-2624b.ts', db: 'rg_2624b' },
  { name: '26.25 foundation', script: 'verify-2625.ts', db: 'rg_2625' },
  { name: '26.25s multi-channel', script: 'verify-2625s.ts', db: 'rg_2625s' },
  { name: '26.25a portal/IDOR', script: 'verify-2625a.ts', db: 'rg_2625a' },
  { name: '26.25b inherited-debt', script: 'verify-2625b.ts', db: 'rg_2625b' },
  { name: '26.26 defects (return/AR/nav/db)', script: 'verify-2626.ts', db: 'rg_2626' },
  { name: '26.26b CFO hunt (BUG-020 reversal/overpay/closed-period)', script: 'verify-2626b-cfo.ts', db: 'rg_2626b' },
  { name: '26.27 RBAC/ABAC/2FA security matrix', script: 'verify-2627-rbac.ts', db: 'rg_2627' },
]

const BASE = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/postgres'
const SECRET = process.env.ADMIN_JWT_SECRET || 'ci-regressions-secret-placeholder'

function withDb(db: string): string {
  const u = new URL(BASE)
  u.pathname = `/${db}`
  return u.toString()
}

async function createDb(db: string) {
  const admin = new URL(BASE)
  admin.pathname = '/postgres'
  const c = new Client({ connectionString: admin.toString() })
  await c.connect()
  await c.query(`DROP DATABASE IF EXISTS ${db}`)
  await c.query(`CREATE DATABASE ${db}`)
  await c.end()
}

async function main() {
  let failed = 0
  for (const s of SUITES) {
    console.log(`\n══ ${s.name} (${s.script}) ══`)
    await createDb(s.db)
    const r = spawnSync('npx', ['tsx', '--tsconfig', 'tsconfig.json', `scripts/${s.script}`], {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: withDb(s.db), ADMIN_JWT_SECRET: SECRET },
    })
    if (r.status !== 0) { failed++; console.error(`  ✗ ${s.name} FAILED (exit ${r.status})`) }
  }
  console.log(`\n${failed === 0 ? '✅ ALL' : `❌ ${failed}`} regression suites — ${SUITES.length} total`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
