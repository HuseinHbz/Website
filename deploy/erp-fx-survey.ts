/**
 * ERPFIX-2 (BUG-ERP-03) — READ-ONLY foreign-currency survey. Changes nothing.
 *
 *  1. Foreign-currency documents, payments, payment orders and GL entries by
 *     currency (raw total vs base total).
 *  2. Documents with base_total = 0 or a zero/negative rate — LISTED only
 *     (ERPFIX-2 stop condition: never auto-fixed).
 *  3. Legacy GL entries posted before the base-currency fix (lines in the
 *     transaction currency) and the distortion they put on each account
 *     (raw amount vs amount × the entry's rate), with what
 *     erp-fx-remediate.ts would do to each.
 *
 * Usage (repo root, as the app user):  DATABASE_URL=… npx tsx deploy/erp-fx-survey.ts
 */
import { fxSurvey } from '@/lib/erp/fxRemediation'

const f = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 })

async function main() {
  console.log('\n  ERPFIX-2 foreign-currency survey (read-only)\n')
  const s = await fxSurvey()
  console.log(`  1) foreign-currency rows: ${s.documents.length ? '' : 'none'}`)
  for (const d of s.documents) console.log(`     · ${d.table.padEnd(20)} ${d.currency}  ${String(d.count).padStart(5)} rows   raw ${f(d.total)}   base ${d.base ? f(d.base) : '—'}`)
  console.log(`  2) documents with base_total = 0 or rate ≤ 0 (listed, not fixed): ${s.invalidDocs.length}`)
  for (const d of s.invalidDocs.slice(0, 50)) console.log(`     ✗ ${d.table} #${d.id} ${d.docNo ?? ''} ${d.currency} total ${f(d.total)} rate ${d.exchangeRate} base_total ${f(d.baseTotal)}`)
  console.log(`  3) legacy GL entries in a foreign currency without fx_amount: ${s.legacyEntries.length}`)
  for (const e of s.legacyEntries) console.log(`     · ${e.entryNo} ${e.date} ${e.reference ?? ''} ${e.currency} @ ${e.rate} total ${f(e.total)} → ${e.action === 'restate' ? 'RESTATE' : `REPORT ONLY (${e.reason})`}`)
  if (s.distortion.length) {
    console.log('     distortion per account (base − raw):')
    for (const d of s.distortion) console.log(`       ${d.code} ${d.nameEn.padEnd(28)} raw ${f(d.rawNet).padStart(18)}  base ${f(d.baseNet).padStart(20)}  distortion ${f(d.distortion)}`)
  }
  if (!s.documents.length && !s.legacyEntries.length) console.log('\n  No foreign-currency data: nothing to remediate (the structural fix still applies to all future postings).')
  console.log('')
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
