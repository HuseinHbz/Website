/**
 * General Ledger server data layer — reads posted journal lines from PostgreSQL,
 * tallies debits/credits per account, and derives the trial balance and
 * statements via the pure engine (lib/erp/ledger.ts). Only POSTED entries hit
 * the books; drafts and voided entries are excluded. One computation path,
 * shared by the reports API and the finance dashboard.
 */
import { pgQuery } from '@/lib/db'
import {
  trialBalance, incomeStatement, balanceSheet, financialKpis,
  type AccountTally,
} from './ledger'

/** Tally debit/credit totals per account across all POSTED entries. */
export async function loadTallies(): Promise<AccountTally[]> {
  // Only POSTED entries hit the books. The status gate must be on the SUMMED
  // amount (CASE), not the JOIN — a filtered LEFT JOIN still counts the line.
  return (await pgQuery(
    `SELECT a.id, a.code, a.name_en AS "nameEn", a.name_fa AS "nameFa", a.type,
            COALESCE(SUM(CASE WHEN e.status = 'posted' THEN l.debit ELSE 0 END),0)::float AS debit,
            COALESCE(SUM(CASE WHEN e.status = 'posted' THEN l.credit ELSE 0 END),0)::float AS credit
     FROM gl_accounts a
     LEFT JOIN gl_journal_lines l ON l.account_id = a.id
     LEFT JOIN gl_journal_entries e ON e.id = l.entry_id
     WHERE a.active = 1
     GROUP BY a.id, a.code, a.name_en, a.name_fa, a.type
     ORDER BY a.code`, [],
  )) as unknown as AccountTally[]
}

const isCashCode = (code: string) => code.startsWith('10')

export async function financeReports() {
  const tallies = await loadTallies()
  return {
    trialBalance: trialBalance(tallies),
    incomeStatement: incomeStatement(tallies),
    balanceSheet: balanceSheet(tallies),
  }
}

export async function financeOverview() {
  const tallies = await loadTallies()
  const kpis = financialKpis(tallies, isCashCode)
  const is = incomeStatement(tallies)
  const bs = balanceSheet(tallies)
  const recent = await pgQuery(
    `SELECT id, entry_no AS "entryNo", date, memo, status, total::float AS total, posted_at AS "postedAt", created_at AS "createdAt"
     FROM gl_journal_entries ORDER BY created_at DESC LIMIT 12`, [],
  )
  const counts = (await pgQuery(
    `SELECT status, COUNT(*)::int AS n FROM gl_journal_entries GROUP BY status`, [],
  )) as { status: string; n: number }[]
  const byStatus = Object.fromEntries(counts.map(c => [c.status, c.n])) as Record<string, number>
  return { kpis, income: is, balance: bs, recent, byStatus }
}
