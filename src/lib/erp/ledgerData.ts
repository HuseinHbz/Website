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
  type AccountTally,
} from './ledger'

/**
 * Tally debit/credit totals per account across POSTED entries. `companyId`
 * scopes to one company (entries with NULL company_id belong to the default
 * company); omit it for the consolidated group-wide books.
 */
export async function loadTallies(companyId?: number): Promise<AccountTally[]> {
  // Only POSTED entries hit the books. The status gate must be on the SUMMED
  // amount (CASE), not the JOIN — a filtered LEFT JOIN still counts the line.
  const companyGate = companyId != null
    ? `AND (e.company_id = $1 OR (e.company_id IS NULL AND EXISTS (SELECT 1 FROM erp_companies dc WHERE dc.id = $1 AND dc.is_default)))`
    : ''
  return (await pgQuery(
    `SELECT a.id, a.code, a.name_en AS "nameEn", a.name_fa AS "nameFa", a.type,
            COALESCE(SUM(CASE WHEN e.status = 'posted' ${companyGate} THEN l.debit ELSE 0 END),0)::float AS debit,
            COALESCE(SUM(CASE WHEN e.status = 'posted' ${companyGate} THEN l.credit ELSE 0 END),0)::float AS credit
     FROM gl_accounts a
     LEFT JOIN gl_journal_lines l ON l.account_id = a.id
     LEFT JOIN gl_journal_entries e ON e.id = l.entry_id
     WHERE a.active = 1
     GROUP BY a.id, a.code, a.name_en, a.name_fa, a.type
     ORDER BY a.code`, companyId != null ? [companyId] : [],
  )) as unknown as AccountTally[]
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

  const NOW_SQL = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
  // Full-remediation RULE-001/RULE-006: BOTH companies' entries (and every
  // line of each) now commit as ONE transaction. This function's own
  // contract is "both books stay balanced" — the old bare-pgQuery loop
  // could post company A's complete entry, then fail on company B's header
  // or lines, leaving one side of the intercompany transfer posted and the
  // other missing (an unbalanced pair spanning two separate companies'
  // books, the worst version of this defect class).
  const { entryIds, entryNos } = await withTransaction(async query => {
    const ids: number[] = []
    const nos: string[] = []
    for (const e of pair) {
      const total = e.lines.reduce((s, l) => s + l.debit, 0)
      const entryNo = `IC-${input.date.slice(0, 4)}-${Date.now().toString().slice(-6)}${e.companyId}`
      const row = (await query<{ id: number }>(
        `INSERT INTO gl_journal_entries (entry_no, date, memo, reference, status, total, created_by, company_id, posted_at)
         VALUES ($1,$2,$3,$4,'posted',$5,$6,$7,${NOW_SQL}) RETURNING id`,
        [entryNo, input.date, e.memo, `intercompany:${input.kind}`, total, userId ?? null, e.companyId]))[0]
      for (let i = 0; i < e.lines.length; i++) {
        const l = e.lines[i]
        await query(`INSERT INTO gl_journal_lines (entry_id, account_id, debit, credit, memo, line_no) VALUES ($1,$2,$3,$4,$5,$6)`,
          [row.id, byCode.get(l.accountCode), l.debit, l.credit, l.memo, i])
      }
      ids.push(row.id); nos.push(entryNo)
    }
    return { entryIds: ids, entryNos: nos }
  })
  return { entryIds, entryNos }
}
