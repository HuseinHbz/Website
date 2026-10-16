/**
 * ERPFIX-2 (BUG-ERP-03) — restate journal entries posted in a foreign
 * currency BEFORE the base-currency fix.
 *
 * Method (maintainer decision): reversal of the original (which stays
 * posted — CLAUDE.md rule 11) + a re-post in base currency, both in ONE
 * transaction through the GL core, and the source row re-pointed at the
 * re-post. Open periods only; closed/locked periods and non-document entries
 * (Treasury, manual, import) are REPORTED for the accountant.
 *
 * SAFETY:
 *   • DRY-RUN by default. Real writes need BOTH `--apply` AND `--confirm`,
 *     and only after the ACCOUNTANT has reviewed the dry-run and
 *     `deploy/erp-fx-survey.ts`.
 *   • Idempotent (gl_remediation_links kind 'fx-restate').
 *   • Proof uses the production loadTallies/trialBalance.
 *
 * Usage (repo root, as the app user):
 *   DATABASE_URL=… npx tsx deploy/erp-fx-remediate.ts                     # dry-run
 *   DATABASE_URL=… npx tsx deploy/erp-fx-remediate.ts --apply --confirm
 */
import { remediateFx } from '@/lib/erp/fxRemediation'
import { loadTallies } from '@/lib/erp/ledgerData'
import { trialBalance } from '@/lib/erp/ledger'
import { logAction } from '@/lib/admin/audit'

const APPLY = process.argv.includes('--apply') && process.argv.includes('--confirm')
const KEY = ['1010', '1100', '2000', '2100', '4000', '4900', '6980']

async function balances() {
  const tb = trialBalance(await loadTallies())
  return Object.fromEntries(KEY.map(c => { const r = tb.rows.find(x => x.code === c); return [c, r ? Math.round((r.debit - r.credit) * 100) / 100 : 0] }))
}

async function main() {
  console.log(`\n  ERPFIX-2 FX restatement — ${APPLY ? 'APPLY' : 'DRY-RUN (pass --apply --confirm to write)'}\n`)
  if (process.argv.includes('--apply') && !process.argv.includes('--confirm')) console.log('  --apply without --confirm → staying in dry-run.\n')
  const dry = await remediateFx({ apply: false })
  for (const e of dry.entries) console.log(`  · ${e.entryNo} ${e.date} ${e.kind.padEnd(16)} ${e.currency} @ ${e.rate} → ${e.action === 'restate' ? 'RESTATE' : `REPORT ONLY (${e.reason})`}`)
  if (!dry.entries.length) console.log('  nothing to restate.')
  console.log(`\n  key balances BEFORE: ${JSON.stringify(await balances())}`)
  if (!APPLY) { console.log(''); process.exit(0) }
  const r = await remediateFx({ apply: true })
  await logAction(null, 'erpfix2.fx_restatement', 'gl_journal_entries', '', { restated: r.restated })
  for (const x of r.restated) console.log(`  ✔ #${x.entryId} reversed by #${x.reversalId}, restated as ${x.newEntryNo} (#${x.newEntryId})`)
  console.log(`  key balances AFTER:  ${JSON.stringify(await balances())}`)
  console.log(`  trial balance balanced: ${trialBalance(await loadTallies()).balanced}\n`)
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
