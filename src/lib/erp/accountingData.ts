/**
 * Accounting-core data layer (Phase 26.9). Wraps the pure `accountingCore`
 * engine over PostgreSQL: chart-of-accounts hierarchy, fiscal-period lifecycle
 * with posting enforcement, opening balances and year-end closing — all as
 * real posted journal entries reusing the existing GL tables.
 */
import { pgQuery, withTransaction, type TxQuery } from '@/lib/db'
import { businessError, throwBusinessError } from '@/lib/errors'
import { insertPostedEntry } from './glPosting'
import type { AccountType, AccountTally } from './ledger'
import {
  buildAccountTree, canPostDate, canTransitionPeriod, openingBalanceLines,
  yearEndClosingLines, type CoaAccount, type FiscalPeriod, type PeriodStatus, type PostDateBlock,
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
  // SEC-FIX-1 BUG-ERP-02 — `userId` used to be manually escaped
  // (`replace(/'/g, "''")`) and spliced into the SQL text. Not reachable
  // with an attacker-controlled value today (userId comes from the server
  // session), but it violated the project's own $n-parametrized rule. Now
  // `$3` carries the real value and a CASE WHEN decides, per `to`, which
  // (already-hardcoded) column set applies — the observable behavior
  // (which columns get stamped, when) is unchanged.
  const stamp = to === 'closed' ? `, closed_at=${NOW}, closed_by=$3`
    : to === 'locked' ? `, locked_at=${NOW}` : ''
  await pgQuery(`UPDATE gl_fiscal_periods SET status=$2${stamp} WHERE id=$1`, to === 'closed' ? [id, to, userId ?? null] : [id, to])
  return { ok: true }
}

/** erp_settings.gl_require_period: 'strict' (default) | 'off'. */
export async function requirePeriodSetting(query: TxQuery = pgQuery): Promise<boolean> {
  try {
    const r = (await query<{ value: string }>(`SELECT value FROM erp_settings WHERE key='gl_require_period'`))[0]
    return (r?.value ?? 'strict') !== 'off'
  } catch { return true }
}

export interface AssertPostableResult { ok: boolean; error?: string; periodId?: number; block?: PostDateBlock; periodName?: string; periodStatus?: string }

/**
 * Enforce the fiscal-period lock on a posting date. ERPFIX-1: also rejects a
 * malformed date and — once any period is defined — a date outside every
 * period (gl_require_period='strict'). `allowClosedPeriod` is for year-end
 * closing / opening balance only; a locked period is never postable.
 */
export async function assertPostable(date: string, opts: { allowClosedPeriod?: boolean; query?: TxQuery } = {}): Promise<AssertPostableResult> {
  const query = opts.query ?? pgQuery
  const periods = (await query(
    `SELECT id, name, start_date AS "startDate", end_date AS "endDate", status, kind, parent_id AS "parentId"
     FROM gl_fiscal_periods ORDER BY start_date, kind`)) as unknown as FiscalPeriod[]
  const r = canPostDate(date, periods, { requirePeriod: await requirePeriodSetting(query), allowClosedPeriod: opts.allowClosedPeriod })
  return r.ok
    ? { ok: true, periodId: r.period?.id }
    : { ok: false, error: r.reason, block: r.block, periodName: r.period?.name, periodStatus: r.period?.status }
}

/** Throw the matching bilingual catalog error for a failed gate. */
export function throwPostableError(date: string, gate: AssertPostableResult): never {
  if (gate.block === 'invalid_date') throwBusinessError('ERP-FINANCE-INVALID-DATE', { date: String(date) })
  if (gate.block === 'outside_periods') throwBusinessError('ERP-FINANCE-DATE-OUTSIDE-PERIODS', { date })
  throwBusinessError('ERP-FINANCE-PERIOD-CLOSED', { name: gate.periodName ?? '', status: gate.periodStatus ?? 'closed' })
}

// ── Opening balance ──────────────────────────────────────────────────────────
/**
 * ERPFIX-1: posted through the single GL entry point (insertPostedEntry) —
 * atomic, balance-checked, numbered by the Numbering Engine (OB-{YEAR}-…)
 * instead of the old Date.now() suffix. Explicitly allowed in a CLOSED period
 * (never a locked one); the route gates it with erp.finance:close_period.
 */
export async function postOpeningBalance(input: { date: string; entries: { accountId: number; amount: number }[] }, userId?: string, opts: { query?: TxQuery; entryNo?: string } = {}): Promise<{ entryId: number; entryNo: string }> {
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
  const post = (query: TxQuery) => insertPostedEntry(query, input.date, 'Opening balance', 'opening', userId, lines,
    { allowClosedPeriod: true, docType: 'gl_opening', legacyPrefix: 'OB', entryNo: opts.entryNo })
  // A caller with its own transaction (the import job) composes the posting into it.
  const r = opts.query ? await post(opts.query) : await withTransaction(post)
  return { entryId: r.id, entryNo: r.entryNo }
}

// ── Year-end closing ─────────────────────────────────────────────────────────
/** Structured idempotency key for one fiscal period's closing entry. */
export const yearEndReference = (fiscalPeriodId: number) => `year-end-close:${fiscalPeriodId}`

/**
 * Date-bounded revenue/expense tally for the fiscal year (posted only),
 * scoped to ONE company (NULL company_id = the default company, same rule as
 * loadTallies). Prior closing entries (legacy 'year-end-close' and the new
 * 'year-end-close:<id>') are excluded so a re-close never closes a closing.
 */
async function closingTallies(query: TxQuery, startDate: string, endDate: string, companyId: number | null): Promise<AccountTally[]> {
  return (await query(
    `SELECT a.id, a.code, a.name_en AS "nameEn", a.name_fa AS "nameFa", a.type,
            COALESCE(SUM(l.debit),0)::float AS debit, COALESCE(SUM(l.credit),0)::float AS credit
     FROM gl_accounts a
     JOIN gl_journal_lines l ON l.account_id=a.id
     JOIN gl_journal_entries e ON e.id=l.entry_id
     WHERE a.type IN ('revenue','expense')
       AND e.status='posted' AND e.date BETWEEN $1 AND $2
       AND (e.reference IS NULL OR e.reference NOT LIKE 'year-end-close%')
       AND (CASE WHEN $3::int IS NULL THEN TRUE
                 ELSE (e.company_id = $3::int OR (e.company_id IS NULL AND EXISTS (SELECT 1 FROM erp_companies dc WHERE dc.id = $3::int AND dc.is_default))) END)
     GROUP BY a.id, a.code, a.name_en, a.name_fa, a.type`, [startDate, endDate, companyId])) as unknown as AccountTally[]
}

/**
 * Close a fiscal year: revenue/expense → retained earnings (3900), dated the
 * period's end date. ERPFIX-1:
 *  - posted through insertPostedEntry with allowClosedPeriod (a closed period
 *    may be closed; a LOCKED one is refused) — the old path ignored the gate
 *  - idempotent on a structured reference 'year-end-close:<fiscal_period_id>'
 *    backed by a partial unique index, re-checked under an advisory lock, so
 *    two concurrent runs book exactly one entry and «25» never blocks «2025»
 *    (the old check was memo LIKE '%name%')
 *  - scoped to one company (default company when none is given)
 */
export async function runYearEndClosing(fiscalPeriodId: number, userId?: string, companyId?: number): Promise<{ ok: boolean; error?: string; errorFa?: string; code?: string; entryId?: number; netIncome?: number }> {
  const fy = (await pgQuery<{ name: string; start_date: string; end_date: string; status: string }>(
    `SELECT name, start_date, end_date, status FROM gl_fiscal_periods WHERE id=$1`, [fiscalPeriodId]))[0]
  if (!fy) return { ok: false, error: 'Fiscal period not found' }
  const re = (await pgQuery<{ id: number }>(`SELECT id FROM gl_accounts WHERE code='3900' LIMIT 1`))[0]
  if (!re) return { ok: false, error: 'Retained Earnings account (3900) is missing — run migrations' }
  const defaultCo = (await pgQuery<{ id: number }>(`SELECT id FROM erp_companies WHERE is_default LIMIT 1`))[0]?.id ?? null
  const company = companyId ?? defaultCo
  const isDefault = company === defaultCo
  const reference = yearEndReference(fiscalPeriodId)
  return withTransaction(async query => {
    await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`${reference}:${company ?? 0}`])
    // Structured key first; the legacy scheme (reference 'year-end-close' +
    // memo) is matched EXACTLY so a year closed before this fix is still seen.
    // NULL company_id belongs to the default company (loadTallies rule).
    const already = (await query<{ id: number }>(
      `SELECT id FROM gl_journal_entries
       WHERE status='posted' AND reversed_by IS NULL
         AND (reference=$1 OR (reference='year-end-close' AND memo=$2))
         AND (company_id IS NOT DISTINCT FROM $3::int OR (company_id IS NULL AND $4::boolean))
       LIMIT 1`,
      [reference, `Year-end closing ${fy.name}`, company, isDefault]))[0]
    if (already) {
      const be = businessError('ERP-FINANCE-YEAR-ALREADY-CLOSED', { name: fy.name, entryId: already.id })
      return { ok: false, error: be.en, errorFa: be.fa, code: be.code }
    }
    const tallies = await closingTallies(query, fy.start_date, fy.end_date, company)
    const closing = yearEndClosingLines(tallies, re.id)
    if (!closing.lines.length) return { ok: false, error: 'No revenue or expense activity to close in this period' }
    const e = await insertPostedEntry(query, fy.end_date, `Year-end closing ${fy.name}`, reference, userId, closing.lines,
      { allowClosedPeriod: true, companyId: company, docType: 'gl_year_end', legacyPrefix: 'YEC' })
    return { ok: true, entryId: e.id, netIncome: closing.netIncome }
  })
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
