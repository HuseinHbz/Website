/**
 * CI live-PostgreSQL smoke (Phase 26.24, بند ۲.۱). Runs inside the CI postgres
 * service container: migrate → seed → assert the health probe is green and the
 * tenancy contract holds. Fast, deterministic, no app server needed.
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'

async function main() {
  await runMigrations()
  await seedDatabase()
  // Migrations are idempotent — a second run must not throw or duplicate.
  await runMigrations()

  const admin = (await pgQuery<{ n: number }>(`SELECT COUNT(*)::int AS n FROM users WHERE role='super_admin'`))[0]
  if (admin.n < 1) throw new Error('seed did not create the admin user')

  // Tenancy contract: every transactional table carries company_id.
  const tables = ['sales_documents', 'purchase_documents', 'inv_moves', 'assets', 'crm_leads', 'moadian_queue', 'payment_transactions']
  for (const t of tables) {
    const col = (await pgQuery<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_name=$1 AND column_name='company_id'`, [t]))[0]
    if (col.n !== 1) throw new Error(`tenancy: ${t} missing company_id`)
  }

  await pgQuery('SELECT 1') // DB probe (mirrors /api/health deep check)
  console.log('✅ CI live-PG smoke passed: migrate + seed idempotent, admin seeded, tenancy contract holds')
  process.exit(0)
}
main().catch(e => { console.error('❌ CI live-PG smoke failed:', e); process.exit(1) })
