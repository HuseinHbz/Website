/**
 * Accounting validation data layer (Phase 26.15.1) — reads real journal entries
 * from PostgreSQL and runs the pure `validateLedger` engine over them. Read-only:
 * it never mutates the ledger, only reports an auditor's integrity findings.
 */
import { pgQuery } from '@/lib/db'
import { validateLedger, type JournalEntryInput, type LedgerIntegritySummary } from './accountingValidation'

export interface LedgerScanOptions {
  status?: 'posted' | 'all'
  limit?: number
}

/** Scan journal entries + lines and return the integrity summary. */
export async function scanLedgerIntegrity(opts: LedgerScanOptions = {}): Promise<LedgerIntegritySummary> {
  const status = opts.status ?? 'posted'
  const limit = Math.min(5000, Math.max(1, opts.limit ?? 2000))
  const entries = await pgQuery<{ id: number; entry_no: string | null; status: string; total: number }>(
    `SELECT id, entry_no, status, total::float AS total FROM gl_journal_entries
     ${status === 'posted' ? "WHERE status='posted'" : ''}
     ORDER BY id DESC LIMIT $1`, [limit])
  if (entries.length === 0) return validateLedger([])

  const ids = entries.map(e => e.id)
  // LEFT JOIN the chart so an unresolved account_id surfaces as missing_account.
  const lines = await pgQuery<{ entry_id: number; debit: number; credit: number; account_id: number | null; resolved: boolean; line_no: number | null }>(
    `SELECT l.entry_id, l.debit::float AS debit, l.credit::float AS credit, l.account_id,
            (a.id IS NOT NULL) AS resolved, l.line_no
     FROM gl_journal_lines l LEFT JOIN gl_accounts a ON a.id = l.account_id
     WHERE l.entry_id = ANY($1)`, [ids])

  const byEntry = new Map<number, JournalEntryInput>()
  for (const e of entries) byEntry.set(e.id, { id: e.id, entryNo: e.entry_no, status: e.status, total: e.total, lines: [] })
  for (const l of lines) {
    const e = byEntry.get(l.entry_id)
    if (e) e.lines.push({ debit: l.debit, credit: l.credit, accountId: l.account_id, accountResolved: l.resolved, lineNo: l.line_no ?? undefined })
  }
  return validateLedger([...byEntry.values()])
}
