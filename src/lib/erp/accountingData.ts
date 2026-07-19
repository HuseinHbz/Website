/**
 * Accounting-core data layer (Phase 26.9). Wraps the pure `accountingCore`
 * engine over PostgreSQL: chart-of-accounts hierarchy, fiscal-period lifecycle
 * with posting enforcement, opening balances and year-end closing — all as
 * real posted journal entries reusing the existing GL tables.
 */
import { pgQuery } from '@/lib/db'
import type { AccountType, AccountTally } from './ledger'
import {
  buildAccountTree, canPostDate, canTransitionPeriod, openingBalanceLines,
  yearEndClosingLines, type CoaAccount, type FiscalPeriod, type PeriodStatus,
} from './accountingCore'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const num = (v: unknown) => Number(v ?? 0)

// ── Chart of accounts ────────────────────────────────────────────────────────
export async function chartOfAccounts() {
  const rows = (await pgQuery(
    `SELECT id, code, name_en AS "nameEn", name_fa AS "nameFa", type, parent_id AS "parentId", active
     FROM gl_accounts ORDER BY code`)) as unknown as CoaAccount[]
  return { flat: rows, tree: buildAccountTree(rows) }
}

// ── Fiscal periods ───────────────────────────────────────────────────────────
export async function listPeriods(): Promise<FiscalPeriod[]> {
  return (await pgQuery(
    `SELECT id, name, start_date AS "startDate", end_date AS "endDate", status, kind, parent_id AS "parentId"
     FROM gl_fiscal_periods ORDER BY start_date, kind`)) as unknown as FiscalPeriod[]
}

export async function createPeriod(p: { name: string; startDate: string; endDate: string; kind: 'year' | 'period'; parentId?: number }) {
  if (p.startDate > p.endDate) throw new Error('Start date must be on or before the end date')
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO gl_fiscal_periods (name, start_date, end_date, kind, parent_id, status, created_at)
     VALUES ($1,$2,$3,$4,$5,'open',${NOW}) RETURNING id`,
    [p.name, p.startDate, p.endDate, p.kind, p.parentId ?? null]))[0]
  return row.id
}

export async function transitionPeriod(id: number, to: PeriodStatus, userId?: string): Promise<{ ok: boolean; error?: string }> {
  const cur = (await pgQuery<{ status: PeriodStatus }>(`SELECT status FROM gl_fiscal_periods WHERE id=$1`, [id]))[0]
  if (!cur) return { ok: false, error: 'Period not found' }
  if (!canTransitionPeriod(cur.status, to)) return { ok: false, error: `Cannot move a ${cur.status} period to ${to}` }
  const stamp = to === 'closed' ? `, closed_at=${NOW}, closed_by=${userId ? `'${userId.replace(/'/g, "''")}'` : 'NULL'}`
    : to === 'locked' ? `, locked_at=${NOW}` : ''
  await pgQuery(`UPDATE gl_fiscal_periods SET status=$2${stamp} WHERE id=$1`, [id, to])
  return { ok: true }
}

/** Enforce the fiscal-period lock on a posting date (used by the journal route). */
export async function assertPostable(date: string): Promise<{ ok: boolean; error?: string; periodId?: number }> {
  const periods = await listPeriods()
  const r = canPostDate(date, periods)
  return r.ok ? { ok: true, periodId: r.period?.id } : { ok: false, error: r.reason }
}

// ── Posted-entry helper ──────────────────────────────────────────────────────
async function postEntry(entryNo: string, date: string, memo: string, reference: string, lines: { accountId: number; debit: number; credit: number }[], userId?: string): Promise<number> {
  const total = lines.reduce((s, l) => s + l.debit, 0)
  const periodId = (await assertPostable(date)).periodId ?? null
  const entry = (await pgQuery<{ id: number }>(
    `INSERT INTO gl_journal_entries (entry_no, date, memo, reference, status, total, created_by, period_id, currency, exchange_rate, posted_at)
     VALUES ($1,$2,$3,$4,'posted',$5,$6,$7,'IRR',1,${NOW}) RETURNING id`,
    [entryNo, date, memo, reference, total, userId ?? null, periodId]))[0]
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    await pgQuery(`INSERT INTO gl_journal_lines (entry_id, account_id, debit, credit, line_no) VALUES ($1,$2,$3,$4,$5)`,
      [entry.id, l.accountId, l.debit, l.credit, i])
  }
  return entry.id
}

// ── Opening balance ──────────────────────────────────────────────────────────
export async function postOpeningBalance(input: { date: string; entries: { accountId: number; amount: number }[] }, userId?: string): Promise<{ entryId: number }> {
  const post = await assertPostable(input.date)
  if (!post.ok) throw new Error(post.error)
  // Resolve each account's type for normal-side placement.
  const ids = input.entries.map(e => e.accountId)
  const accs = await pgQuery<{ id: number; type: AccountType }>(`SELECT id, type FROM gl_accounts WHERE id = ANY($1)`, [ids])
  const typeById = new Map(accs.map(a => [a.id, a.type]))
  const lines = openingBalanceLines(input.entries.map(e => {
    const type = typeById.get(e.accountId)
    if (!type) throw new Error(`Account ${e.accountId} not found`)
    return { accountId: e.accountId, type, amount: e.amount }
  }))
  if (lines.length < 2) throw new Error('An opening balance needs at least two accounts')
  const entryId = await postEntry(`OB-${input.date.slice(0, 4)}-${Date.now().toString().slice(-6)}`, input.date, 'Opening balance', 'opening', lines, userId)
  return { entryId }
}

// ── Year-end closing ─────────────────────────────────────────────────────────
/** Date-bounded revenue/expense tally for the fiscal year (posted only). */
async function closingTallies(startDate: string, endDate: string): Promise<AccountTally[]> {
  return (await pgQuery(
    `SELECT a.id, a.code, a.name_en AS "nameEn", a.name_fa AS "nameFa", a.type,
            COALESCE(SUM(CASE WHEN e.status='posted' AND e.date BETWEEN $1 AND $2 THEN l.debit ELSE 0 END),0)::float AS debit,
            COALESCE(SUM(CASE WHEN e.status='posted' AND e.date BETWEEN $1 AND $2 THEN l.credit ELSE 0 END),0)::float AS credit
     FROM gl_accounts a
     LEFT JOIN gl_journal_lines l ON l.account_id=a.id
     LEFT JOIN gl_journal_entries e ON e.id=l.entry_id
     WHERE a.type IN ('revenue','expense') AND e.reference IS DISTINCT FROM 'year-end-close'
     GROUP BY a.id, a.code, a.name_en, a.name_fa, a.type`, [startDate, endDate])) as unknown as AccountTally[]
}

export async function runYearEndClosing(fiscalPeriodId: number, userId?: string): Promise<{ ok: boolean; error?: string; entryId?: number; netIncome?: number }> {
  const fy = (await pgQuery<{ name: string; start_date: string; end_date: string; status: string }>(
    `SELECT name, start_date, end_date, status FROM gl_fiscal_periods WHERE id=$1`, [fiscalPeriodId]))[0]
  if (!fy) return { ok: false, error: 'Fiscal period not found' }
  const re = (await pgQuery<{ id: number }>(`SELECT id FROM gl_accounts WHERE code='3900' LIMIT 1`))[0]
  if (!re) return { ok: false, error: 'Retained Earnings account (3900) is missing — run migrations' }
  // Idempotent: don't double-close a period.
  const already = (await pgQuery<{ id: number }>(
    `SELECT id FROM gl_journal_entries WHERE reference='year-end-close' AND memo LIKE $1 AND status='posted' LIMIT 1`, [`%${fy.name}%`]))[0]
  if (already) return { ok: false, error: `Year ${fy.name} is already closed (entry #${already.id})` }
  const tallies = await closingTallies(fy.start_date, fy.end_date)
  const closing = yearEndClosingLines(tallies, re.id)
  if (!closing.lines.length) return { ok: false, error: 'No revenue or expense activity to close in this period' }
  const entryId = await postEntry(`YEC-${fy.name}-${Date.now().toString().slice(-4)}`, fy.end_date, `Year-end closing ${fy.name}`, 'year-end-close', closing.lines, userId)
  return { ok: true, entryId, netIncome: closing.netIncome }
}

// ── Account statement (general ledger for one account) ───────────────────────
export async function accountStatement(accountId: number, from?: string, to?: string) {
  const acc = (await pgQuery<{ id: number; code: string; nameEn: string; type: AccountType }>(
    `SELECT id, code, name_en AS "nameEn", type FROM gl_accounts WHERE id=$1`, [accountId]))[0]
  if (!acc) return null
  const params: unknown[] = [accountId]
  let dateFilter = ''
  if (from) { params.push(from); dateFilter += ` AND e.date >= $${params.length}` }
  if (to) { params.push(to); dateFilter += ` AND e.date <= $${params.length}` }
  const rows = (await pgQuery(
    `SELECT e.id AS "entryId", e.entry_no AS "entryNo", e.date, e.memo, e.reference,
            l.debit::float AS debit, l.credit::float AS credit
     FROM gl_journal_lines l JOIN gl_journal_entries e ON e.id=l.entry_id
     WHERE l.account_id=$1 AND e.status='posted'${dateFilter}
     ORDER BY e.date, e.id`, params)) as { entryId: number; entryNo: string; date: string; memo: string | null; reference: string | null; debit: number; credit: number }[]
  const debitNormal = acc.type === 'asset' || acc.type === 'expense'
  let running = 0
  const lines = rows.map(r => {
    running += debitNormal ? (num(r.debit) - num(r.credit)) : (num(r.credit) - num(r.debit))
    return { ...r, balance: Math.round(running * 100) / 100 }
  })
  return {
    account: acc,
    lines,
    totals: {
      debit: Math.round(rows.reduce((s, r) => s + num(r.debit), 0) * 100) / 100,
      credit: Math.round(rows.reduce((s, r) => s + num(r.credit), 0) * 100) / 100,
      balance: Math.round(running * 100) / 100,
    },
  }
}
