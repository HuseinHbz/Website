#!/usr/bin/env node
/**
 * Tenancy audit (Phase 26.24, ADR-001). Enforces that every TRANSACTIONAL table
 * declared in migrate.ts carries a `company_id` column. Reference/config/CMS
 * tables are shared and exempt. Fails (exit 1) on any transactional table that
 * is missing company_id — so the multi-company contract cannot silently rot.
 *
 *   node scripts/tenancy-audit.mjs [--json]
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const migrate = readFileSync(join(ROOT, 'src/lib/db/migrate.ts'), 'utf8')

// Transactional tables: business records that belong to a legal entity. These
// MUST carry company_id. Everything else (chart of accounts, currencies,
// settings, numbering, CMS, catalog, nav prefs, logs) is shared → exempt.
const TRANSACTIONAL = [
  'sales_documents', 'sales_payments',
  'purchase_documents', 'purchase_payments',
  'inv_moves', 'assets', 'crm_leads',
  'gl_journal_entries', 'bank_accounts',
  'moadian_queue', 'payment_transactions',
  // 26.25: CRM transactional tables (tickets + campaign sends).
  'crm_tickets', 'crm_campaigns', 'crm_campaign_recipients',
  'crm_customer_channels',
]

// A table "has company_id" if it declares it inline in its CREATE TABLE body OR
// via an ALTER TABLE ... ADD COLUMN ... company_id anywhere in the migration.
function hasCompanyId(table) {
  const altered = new RegExp(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS company_id`, 'i').test(migrate)
  if (altered) return true
  const create = new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\s*\\(([\\s\\S]*?)\\n\\s*\\);`, 'i').exec(migrate)
  return create ? /company_id/i.test(create[1]) : false
}

const missing = TRANSACTIONAL.filter(t => !hasCompanyId(t))
const ok = TRANSACTIONAL.filter(t => hasCompanyId(t))

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ checked: TRANSACTIONAL.length, ok: ok.length, missing }, null, 2))
} else {
  console.log('\n  Tenancy Audit (ADR-001 — company_id on transactional tables)')
  console.log('  ' + '─'.repeat(58))
  console.log(`  Transactional tables checked . ${TRANSACTIONAL.length}`)
  console.log(`  ✓ company-aware .............. ${ok.length}`)
  console.log(`  ✗ missing company_id ......... ${missing.length}  (budget 0)`)
  for (const t of missing) console.log(`      · ${t}`)
  console.log('')
}
process.exit(missing.length === 0 ? 0 : 1)
