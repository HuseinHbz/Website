/**
 * Accounting Validation Engine (Phase 26.15.1) — the external-auditor's
 * integrity checker for the General Ledger. Pure + deterministic (no DB) so it
 * is fully unit-tested and reused by both the scan data-layer and any report.
 *
 * It reuses the same balancing rule as posting (`Σdebit = Σcredit`) but adds the
 * per-line and per-entry structural checks an auditor runs on a trial balance:
 *   - unbalanced        — debits ≠ credits
 *   - empty             — an entry with < 2 lines can never be double-entry
 *   - two_sided_line    — a single line carrying BOTH a debit and a credit
 *   - empty_line        — a line with neither debit nor credit
 *   - negative_amount   — a negative debit/credit (should be on the other side)
 *   - missing_account   — a line whose account id/code did not resolve
 *   - zero_total        — a posted entry whose total is zero
 * The engine never mutates data; callers decide what to do with the findings.
 */

const EPS = 0.001
const round2 = (n: number): number => Math.round(n * 100) / 100

export type IssueCode =
  | 'unbalanced' | 'empty' | 'two_sided_line' | 'empty_line'
  | 'negative_amount' | 'missing_account' | 'zero_total'

export type IssueSeverity = 'critical' | 'warning'

export interface JournalLineInput {
  debit: number
  credit: number
  accountId?: number | null
  accountResolved?: boolean
  lineNo?: number
}

export interface JournalEntryInput {
  id: number
  entryNo?: string | null
  status?: string
  total?: number
  lines: JournalLineInput[]
}

export interface ValidationIssue {
  code: IssueCode
  severity: IssueSeverity
  message: string
  lineNo?: number
}

export interface EntryValidation {
  entryId: number
  entryNo: string | null
  ok: boolean
  totalDebit: number
  totalCredit: number
  difference: number
  issues: ValidationIssue[]
}

const SEVERITY: Record<IssueCode, IssueSeverity> = {
  unbalanced: 'critical',
  empty: 'critical',
  two_sided_line: 'warning',
  empty_line: 'warning',
  negative_amount: 'critical',
  missing_account: 'critical',
  zero_total: 'warning',
}

/** Validate a single journal entry structurally + arithmetically. */
export function validateEntry(entry: JournalEntryInput): EntryValidation {
  const issues: ValidationIssue[] = []
  const lines = entry.lines ?? []
  const add = (code: IssueCode, message: string, lineNo?: number) =>
    issues.push({ code, severity: SEVERITY[code], message, lineNo })

  if (lines.length < 2) add('empty', `Entry has ${lines.length} line(s); double-entry needs at least 2`)

  let totalDebit = 0
  let totalCredit = 0
  for (const l of lines) {
    const d = l.debit || 0
    const c = l.credit || 0
    totalDebit += d
    totalCredit += c
    if (d < 0 || c < 0) add('negative_amount', 'Line has a negative debit/credit', l.lineNo)
    if (d !== 0 && c !== 0) add('two_sided_line', 'Line carries both a debit and a credit', l.lineNo)
    if (d === 0 && c === 0) add('empty_line', 'Line has neither debit nor credit', l.lineNo)
    if (l.accountResolved === false || l.accountId == null) add('missing_account', 'Line has no valid GL account', l.lineNo)
  }

  totalDebit = round2(totalDebit)
  totalCredit = round2(totalCredit)
  const difference = round2(totalDebit - totalCredit)
  if (Math.abs(difference) >= EPS) add('unbalanced', `Debits ${totalDebit} ≠ credits ${totalCredit} (Δ ${difference})`)
  if (entry.status === 'posted' && round2(totalDebit) === 0 && round2(totalCredit) === 0) add('zero_total', 'Posted entry has a zero total')

  return {
    entryId: entry.id,
    entryNo: entry.entryNo ?? null,
    ok: issues.length === 0,
    totalDebit,
    totalCredit,
    difference,
    issues,
  }
}

export interface LedgerIntegritySummary {
  entriesChecked: number
  clean: number
  withIssues: number
  criticalCount: number
  warningCount: number
  byCode: Record<string, number>
  score: number // 0..100 — 100 = every entry clean
  entries: EntryValidation[] // only entries that have issues
}

/** Validate a whole set of entries and roll up an auditor's integrity summary. */
export function validateLedger(entries: JournalEntryInput[]): LedgerIntegritySummary {
  const results = entries.map(validateEntry)
  const withIssues = results.filter(r => !r.ok)
  const byCode: Record<string, number> = {}
  let criticalCount = 0
  let warningCount = 0
  for (const r of withIssues) {
    for (const i of r.issues) {
      byCode[i.code] = (byCode[i.code] ?? 0) + 1
      if (i.severity === 'critical') criticalCount++
      else warningCount++
    }
  }
  const entriesChecked = results.length
  const clean = entriesChecked - withIssues.length
  // Score weights critical issues far more heavily than warnings.
  const penalty = criticalCount * 100 + warningCount * 20
  const denom = entriesChecked * 100 || 1
  const score = Math.max(0, Math.round((1 - Math.min(1, penalty / denom)) * 100))
  return {
    entriesChecked,
    clean,
    withIssues: withIssues.length,
    criticalCount,
    warningCount,
    byCode,
    score,
    entries: withIssues,
  }
}
