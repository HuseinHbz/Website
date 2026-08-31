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
  { name: '26.28 ABAC row/field scope + 2FA policy', script: 'verify-2628-abac.ts', db: 'rg_2628' },
  { name: '26.29 nav reorg + RBAC key migration', script: 'verify-2629-navkeys.ts', db: 'rg_2629' },
  { name: '27 CRM completion (opportunities + loyalty)', script: 'verify-27-crm.ts', db: 'rg_27' },
  { name: '28.1 HR personnel + employment history', script: 'verify-28-hr.ts', db: 'rg_28' },
  { name: '28.2 HR leave ledger + attendance', script: 'verify-28-2-leave.ts', db: 'rg_282' },
  { name: '28.3-الف payroll (rules as data, immutable slips)', script: 'verify-28-3-payroll.ts', db: 'rg_283' },
  { name: '28.3-ب annual (Eid, severance, settlement)', script: 'verify-28-3b-annual.ts', db: 'rg_283b' },
  { name: '28.3-ج bank payment + advances', script: 'verify-28-3c-completion.ts', db: 'rg_283c' },
  { name: '28.4 employee portal (IDOR matrix, independent session)', script: 'verify-28-4-portal.ts', db: 'rg_284' },
  { name: '28.5 recruitment, training & review (data-gated)', script: 'verify-28-5-recruitment.ts', db: 'rg_285' },
  { name: 'Phase 5 three-way match + payment gate', script: 'verify-phase5-3wm.ts', db: 'rg_p5' },
  { name: 'Phase 6 sales/inventory/fulfillment', script: 'verify-phase6-sales-inventory.ts', db: 'rg_p6' },
  { name: 'Phase 7 finance/AR/AP/GL hardening', script: 'verify-phase7-finance.ts', db: 'rg_p7' },
  { name: 'Phase 8 treasury/returns/refund hardening', script: 'verify-phase8-finance.ts', db: 'rg_p8' },
  { name: 'Phase 9 treasury-AP/bank-recon/precision controls', script: 'verify-phase9-financial-controls.ts', db: 'rg_p9' },
  { name: 'Phase 10 supplier-payment AP allocation + master reconciliation', script: 'verify-phase10-financial-controls.ts', db: 'rg_p10' },
  { name: 'Phase 11 treasury unapplied cash + payment allocation closure', script: 'verify-phase11-financial-controls.ts', db: 'rg_p11' },
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
