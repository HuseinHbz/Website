/** npm run seed:demo — populate a self-contained DEMO- dataset for pilots. */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { seedDemo } from '@/lib/admin/demoData'
async function main() { await runMigrations(); await seedDatabase(); const r = await seedDemo(); console.log('✅ demo seeded:', JSON.stringify(r)); process.exit(0) }
main().catch(e => { console.error(e); process.exit(1) })
