/**
 * General Ledger server data layer — reads posted journal lines from PostgreSQL,
 * tallies debits/credits per account, and derives the trial balance and
 * statements via the pure engine (lib/erp/ledger.ts). Only POSTED entries hit
 * the books; drafts and voided entries are excluded. One computation path,
 * shared by the reports API and the finance dashboard.
 */
import { pgQuery, withTransaction } from '@/lib/db'
import {
  trialBalance, incomeStatement, balanceSheet, financialKpis,
  classifiedBalanceSheet, cashFlowIndirect,
  type AccountTally, type ClassifiedTally,
} from './ledger'
import { resolvedClassification, resolvedCashFlowCategory, needsClassificationQueue, type ClassifiableAccount } from './classification'

export interface TalliesOpts {
  /** Inclusive posting-date range (YYYY-MM-DD). Omit either/both for the
   * all-time cumulative tally (the historical, backward-compatible shape —
   * BUG-ERP-19: before this phase there was no way to ask for a period at
   * all, so closing a fiscal year's revenue/expense accounts to zero via a
   * posted closing entry made that YEAR's P&L invisible the moment someone
   * re-ran the all-time query afterwards). Passing `{from,to}` bounds the sum
   * to that window only — used for period statements and the indirect
   * cash-flow statement's period activity.
   */
  from?: string
  to?: string
}

/**
 * Tally debit/credit totals per account across POSTED entries. `companyId`
 * scopes to one company (entries with NULL company_id belong to the default
 * company); omit it for the consolidated group-wide books.
 *
 * BUG-ERP-19 fix: no longer filters `WHERE a.active = 1` — a deactivated
 * account that still carries a real posted balance used to silently vanish
 * from the trial balance (and therefore from every statement derived from
 * it), which can hide a balance that still needs to tie out. Inactive
 * accounts with a zero balance are still dropped downstream by
 * `trialBalance`'s own nonzero filter, so nothing extra clutters the report.
 */
export async function loadTallies(companyId?: number, opts: TalliesOpts = {}): Promise<AccountTally[]> {
  // Only POSTED entries hit the books. The status gate must be on the SUMMED
  // amount (CASE), not the JOIN — a filtered LEFT JOIN still counts the line.
  const params: unknown[] = []
  let companyGate = ''
  if (companyId != null) { params.push(companyId); companyGate = `AND (e.company_id = $${params.length} OR (e.company_id IS NULL AND EXISTS (SELECT 1 FROM erp_companies dc WHERE dc.id = $${params.length} AND dc.is_default)))` }
  let dateGate = ''
  if (opts.from) { params.push(opts.from); dateGate += ` AND e.date >= $${params.length}` }
  if (opts.to) { params.push(opts.to); dateGate += ` AND e.date <= $${params.length}` }
  return (await pgQuery(
    `SELECT a.id, a.code, a.name_en AS "nameEn", a.name_fa AS "nameFa", a.type,
            COALESCE(SUM(CASE WHEN e.status = 'posted' ${companyGate}${dateGate} THEN l.debit ELSE 0 END),0)::float AS debit,
            COALESCE(SUM(CASE WHEN e.status = 'posted' ${companyGate}${dateGate} THEN l.credit ELSE 0 END),0)::float AS credit
     FROM gl_accounts a
     LEFT JOIN gl_journal_lines l ON l.account_id = a.id
     LEFT JOIN gl_journal_entries e ON e.id = l.entry_id
     GROUP BY a.id, a.code, a.name_en, a.name_fa, a.type
     ORDER BY a.code`, params,
  )) as unknown as AccountTally[]
}

/** Accounts with their stored classification columns (ERPFIX-7). */
async function loadClassifiableAccounts(): Promise<Map<number, ClassifiableAccount>> {
  const rows = await pgQuery<{ id: number; code: string; type: ClassifiableAccount['type']; classification: string | null; cash_flow_category: string | null; classification_verified: boolean }>(
    `SELECT id, code, type, classification, cash_flow_category, classification_verified FROM gl_accounts`)
  return new Map(rows.map(r => [r.id, {
    id: r.id, code: r.code, type: r.type,
    classification: (r.classification as ClassifiableAccount['classification']) ?? null,
    cashFlowCategory: (r.cash_flow_category as ClassifiableAccount['cashFlowCategory']) ?? null,
    classificationVerified: r.classification_verified,
  }]))
}

function toClassified(tallies: AccountTally[], byId: Map<number, ClassifiableAccount>): ClassifiedTally[] {
  return tallies.map(t => {
    const acc = byId.get(t.id)
    const stub: ClassifiableAccount = acc ?? { id: t.id, code: t.code, type: t.type }
    return { ...t, classification: resolvedClassification(stub), cashFlowCategory: resolvedCashFlowCategory(stub) }
  })
}

/** Classified balance sheet (current/non-current, BUG-ERP-19) as of `asOf`
 * (or all-time cumulative when omitted). */
export async function classifiedBalanceSheetAsOf(companyId?: number, asOf?: string) {
  const [tallies, byId] = await Promise.all([loadTallies(companyId, { to: asOf }), loadClassifiableAccounts()])
  const classified = toClassified(tallies, byId)
  const unverifiedCount = needsClassificationQueue([...byId.values()]).length
  return classifiedBalanceSheet(classified, unverifiedCount)
}

/** Indirect-method cash-flow statement for one date range. */
export async function cashFlowStatementFor(companyId: number | undefined, from: string, to: string) {
  const byId = await loadClassifiableAccounts()
  const [periodTallies, beginTallies] = await Promise.all([
    loadTallies(companyId, { from, to }),
    loadTallies(companyId, { to: from }),
  ])
  const classifiedPeriod = toClassified(periodTallies, byId)
  const classifiedBegin = toClassified(beginTallies, byId)
  const cashBegin = round2(classifiedBegin.filter(t => t.cashFlowCategory === 'cash').reduce((s, t) => s + accountBalanceLocal(t), 0))
  return cashFlowIndirect(classifiedPeriod, cashBegin)
}
function accountBalanceLocal(t: ClassifiedTally): number {
  const net = (t.debit || 0) - (t.credit || 0)
  return t.type === 'asset' || t.type === 'expense' ? round2(net) : round2(-net)
}
function round2(n: number): number { return Math.round(n * 100) / 100 }

/** The "needs classification" queue (BUG-ERP-19) — accounts whose
 * classification is still only the code-range default, never confirmed. */
export async function classificationQueue() {
  const byId = await loadClassifiableAccounts()
  return needsClassificationQueue([...byId.values()])
}

/** Active companies (default first). */
export async function listCompanies() {
  return pgQuery(`SELECT id, code, name_en AS "nameEn", name_fa AS "nameFa", is_default AS "isDefault", active,
          reg_no AS "regNo", national_id AS "nationalId", economic_code AS "economicCode", tax_no AS "taxNo", address, phone
     FROM erp_companies ORDER BY is_default DESC, code`)
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

// ── Intercompany (Phase 26.5) ────────────────────────────────────────────────
import { intercompanyEntries, icBalanced, type IcTransferInput } from './intercompany'
import { insertPostedEntry } from './glPosting'

/**
 * Book a mirrored intercompany transfer/settlement: two POSTED company-scoped
 * journal entries built by the pure engine (1150/2150 clearing + 1010 bank).
 * Both books stay balanced and the clearing accounts offset in consolidation.
 */
export async function bookIntercompany(input: IcTransferInput & { date: string }, userId?: string): Promise<{ entryIds: number[]; entryNos: string[] }> {
  const pair = intercompanyEntries(input)
  if (!icBalanced(pair)) throw new Error('Intercompany entries are unbalanced') // defensive; engine guarantees this
  const codes = [...new Set(pair.flatMap(e => e.lines.map(l => l.accountCode)))]
  const accounts = await pgQuery<{ id: number; code: string }>(
    `SELECT id, code FROM gl_accounts WHERE code = ANY($1)`, [codes])
  const byCode = new Map(accounts.map(a => [a.code, a.id]))
  for (const c of codes) if (!byCode.has(c)) throw new Error(`GL account ${c} is missing — run migrations`)
  const companies = await pgQuery<{ id: number }>(`SELECT id FROM erp_companies WHERE id = ANY($1)`, [[input.fromCompanyId, input.toCompanyId]])
  if (companies.length !== 2) throw new Error('Both companies must exist')

  // ERPFIX-1 BUG-ERP-08/BUG-ERP-21 — this used to bare-pgQuery an entry_no
  // built from Date.now() with NO fiscal-period-lock check at all (one of
  // the 5 bypass paths). Both companies' entries now go through the one
  // shared `insertPostedEntry` (gate + real numbering + atomic insert),
  // still inside ONE transaction so neither side can post without the
  // other.
  const { entryIds, entryNos } = await withTransaction(async query => {
    const ids: number[] = []
    const nos: string[] = []
    for (const e of pair) {
      const total = e.lines.reduce((s, l) => s + l.debit, 0)
      const lines = e.lines.map(l => ({ accountId: byCode.get(l.accountCode)!, debit: l.debit, credit: l.credit, memo: l.memo }))
      const posted = await insertPostedEntry(query, input.date, e.memo, `intercompany:${input.kind}`, total, userId, lines, { companyId: e.companyId })
      ids.push(posted.id); nos.push(posted.entryNo)
    }
    return { entryIds: ids, entryNos: nos }
  })
  return { entryIds, entryNos }
}
