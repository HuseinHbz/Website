/** npm run reset:demo — delete ONLY DEMO- rows; real business data is untouched. */
import { resetDemo } from '@/lib/admin/demoData'
async function main() { const r = await resetDemo(); console.log('✅ demo reset — rows deleted:', r.deleted); process.exit(0) }
main().catch(e => { console.error(e); process.exit(1) })
