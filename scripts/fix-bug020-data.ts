/**
 * BUG-020 data remediation (Phase 26.26c بند ۰).
 *
 * The 26.26b code fix corrected `reverseEntry` GOING FORWARD, but every document
 * voided on production BEFORE that deploy still carries the buggy shape: the
 * original entry is `status='void'` while its reversal is `status='posted'`.
 * Balance sums count `status='posted'` only, so those accounts still net to
 * −original instead of 0. This one-off script repairs the historical rows by
 * restoring the reversed originals to `status='posted'` (the two balanced entries
 * then net to zero, exactly like a freshly-reversed pair).
 *
 * SAFETY:
 *   • DRY-RUN by default — prints the scope + the WRONG vs FIXED balances and
 *     changes nothing. Real writes require BOTH `--apply` AND `--confirm`.
 *   • Idempotent — a second run finds zero victims.
 *   • Touches ONLY entries with `reversed_by IS NOT NULL AND status='void'` — a
 *     plain void (draft never posted) is never modified.
 *   • Refuses to write without evidence of a recent backup unless
 *     `--i-have-a-backup` is passed (the operator asserts a fresh dump exists).
 *   • Every applied run writes a `logAction` audit record (count + entry ids).
 *   • Proof uses the PRODUCTION `loadTallies`/`trialBalance` (26.26c بند ۲.۱) —
 *     never hand-rolled SQL that could re-interpret status.
 *
 * Usage:
 *   DATABASE_URL=… npx tsx scripts/fix-bug020-data.ts            # dry-run
 *   DATABASE_URL=… npx tsx scripts/fix-bug020-data.ts --apply --confirm
 */
import { pgQuery } from '@/lib/db'
import { loadTallies } from '@/lib/erp/ledgerData'
import { trialBalance } from '@/lib/erp/ledger'
import { logAction } from '@/lib/admin/audit'

const APPLY = process.argv.includes('--apply')
const CONFIRM = process.argv.includes('--confirm')
const HAVE_BACKUP = process.argv.includes('--i-have-a-backup')

interface Victim {
  id: number; entry_no: string; date: string; memo: string | null; reference: string | null
  reversed_by: number; total: number
}

async function affectedAccounts(entryIds: number[]): Promise<Set<number>> {
  if (!entryIds.length) return new Set()
  const rows = await pgQuery<{ account_id: number }>(
    `SELECT DISTINCT account_id FROM gl_journal_lines WHERE entry_id = ANY($1)`, [entryIds])
  return new Set(rows.map(r => r.account_id))
}

/** Balances of the given accounts as production sees them (trialBalance). */
async function balancesOf(accountIds: Set<number>): Promise<Map<number, number>> {
  const tb = trialBalance(await loadTallies())
  const m = new Map<number, number>()
  for (const r of tb.rows) if (accountIds.has(r.id)) m.set(r.id, r.debit - r.credit)
  // Accounts that net to exactly zero are dropped by trialBalance → fill 0.
  for (const id of accountIds) if (!m.has(id)) m.set(id, 0)
  return m
}

async function backupIsFresh(): Promise<boolean> {
  const r = await pgQuery<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM backups WHERE status='success' AND created_at >= to_char(now() - interval '24 hours','YYYY-MM-DD HH24:MI:SS')`,
  ).catch(() => [{ c: 0 }])
  return Number(r[0]?.c ?? 0) > 0
}

async function main() {
  console.log('\n══ BUG-020 data remediation ══')
  console.log(`  mode: ${APPLY ? 'APPLY (writes)' : 'DRY-RUN (no writes)'}\n`)

  // ── 0.1 diagnostic: the exact victim set ──────────────────────────────────
  const victims = await pgQuery<Victim>(
    `SELECT e.id, e.entry_no, e.date, e.memo, e.reference, e.reversed_by, e.total::float AS total
     FROM gl_journal_entries e
     WHERE e.reversed_by IS NOT NULL AND e.status='void'
     ORDER BY e.id`)
  console.log(`  Victim entries (reversed_by NOT NULL AND status='void'): ${victims.length}`)

  if (victims.length === 0) {
    console.log('  ✔ No voided-with-reversal entries exist — nothing to repair. (valid result)\n')
    process.exit(0)
  }

  const ids = victims.map(v => v.id)
  const accounts = await affectedAccounts(ids)
  const before = await balancesOf(accounts)

  console.log('\n  Affected entries:')
  for (const v of victims) {
    const src = /^SAL-/.test(v.reference ?? '') ? 'sales' : /^(PUR|AP)-/.test(v.reference ?? '') ? 'purchase' : /^REV-/.test(v.reference ?? '') ? 'reversal' : 'manual/other'
    console.log(`   #${v.id} ${v.entry_no}  ${v.date}  ${Number(v.total).toLocaleString('en-US')}  ← reversed_by #${v.reversed_by}  [${src}]  ${v.memo ?? ''}`)
  }
  console.log('\n  Account balances (production trialBalance) — WRONG now (reversed original excluded):')
  for (const [id, bal] of before) {
    const acc = (await pgQuery<{ code: string; name: string }>(`SELECT code, name_en AS name FROM gl_accounts WHERE id=$1`, [id]))[0]
    console.log(`   ${acc?.code} ${acc?.name}: ${bal.toLocaleString('en-US')}`)
  }

  if (!APPLY) {
    console.log('\n  DRY-RUN — would restore the above entries to status=\'posted\'.')
    console.log('  Re-run with `--apply --confirm --i-have-a-backup` to write. Nothing changed.\n')
    process.exit(0)
  }

  // ── guards before any write ───────────────────────────────────────────────
  if (!CONFIRM) { console.error('\n  ✗ --apply requires --confirm. Aborted (no write).'); process.exit(2) }
  if (!HAVE_BACKUP && !(await backupIsFresh())) {
    console.error('\n  ✗ No successful backup in the last 24h and --i-have-a-backup not passed.')
    console.error('    Take a fresh backup first (deploy/backup.sh) then re-run. Aborted (no write).')
    process.exit(3)
  }

  // ── 0.2 the repair (idempotent, targeted) ─────────────────────────────────
  const res = await pgQuery<{ id: number }>(
    `UPDATE gl_journal_entries SET status='posted'
     WHERE reversed_by IS NOT NULL AND status='void' RETURNING id`)
  await logAction(null, 'bug020.data.remediation', 'gl_journal_entries', '',
    { restored: res.length, entryIds: res.map(r => r.id) })
  console.log(`\n  ✔ Restored ${res.length} entries to status='posted' + audit logged.`)

  const after = await balancesOf(accounts)
  console.log('\n  Account balances AFTER (production trialBalance) — corrected:')
  let allFixed = true
  for (const [id, bal] of after) {
    const acc = (await pgQuery<{ code: string; name: string }>(`SELECT code, name_en AS name FROM gl_accounts WHERE id=$1`, [id]))[0]
    const b = before.get(id) ?? 0
    console.log(`   ${acc?.code} ${acc?.name}: ${b.toLocaleString('en-US')} → ${bal.toLocaleString('en-US')}`)
  }

  // sanity: trial balance still balanced
  const tb = trialBalance(await loadTallies())
  console.log(`\n  Trial balance balanced: ${tb.balanced} (Dr ${tb.totalDebit.toLocaleString('en-US')} = Cr ${tb.totalCredit.toLocaleString('en-US')})`)
  void allFixed
  console.log('')
}

main().catch(e => { console.error(e); process.exit(1) })
