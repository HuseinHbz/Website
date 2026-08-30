/**
 * Treasury bank-ops data layer (Phase 26.14, M1/M2/M3). Bank master CRUD (over
 * the extended `bank_accounts`), statement import (parse → dedupe → persist), and
 * smart reconciliation (candidates from sales/purchase payments + payment_orders
 * → scored suggestions → persisted matches with audit). Reuses the pure engines.
 */
import { pgQuery, withTransaction } from '@/lib/db'
import { parseCsv, parseMt940, parseCamt053, detectDuplicates, lineFingerprint, mapErpType, type ImportedLine, type CsvMapping } from './statementImport'
import { reconcile, reconStats, type StmtLine, type ErpCandidate } from './reconcile'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

// ── Banks (M1) ───────────────────────────────────────────────────────────────
export async function listBanks() {
  return pgQuery(`SELECT id, name, bank, iban, account_no AS "accountNo", swift, branch, country, account_type AS "accountType",
    currency, company_id AS "companyId", status, opening_balance::float AS "openingBalance", active FROM bank_accounts ORDER BY name`)
}
export async function bankBalances(): Promise<{ id: number; name: string; currency: string; balance: number }[]> {
  return (await pgQuery(
    `SELECT a.id, a.name, a.currency, (a.opening_balance + COALESCE((SELECT SUM(amount) FROM bank_statement_lines WHERE account_id=a.id),0))::float AS balance
     FROM bank_accounts a WHERE a.active=true ORDER BY a.name`)) as unknown as { id: number; name: string; currency: string; balance: number }[]
}
export async function upsertBank(input: { id?: number; name: string; bank?: string; iban?: string; accountNo?: string; swift?: string; branch?: string; country?: string; accountType?: string; currency?: string; companyId?: number | null; openingBalance?: number; status?: string }): Promise<{ id: number }> {
  if (input.id) {
    await pgQuery(`UPDATE bank_accounts SET name=$2, bank=$3, iban=$4, account_no=$5, swift=$6, branch=$7, country=$8, account_type=$9, currency=$10, company_id=$11, status=$12 WHERE id=$1`,
      [input.id, input.name, input.bank ?? null, input.iban ?? null, input.accountNo ?? null, input.swift ?? null, input.branch ?? null, input.country ?? null, input.accountType ?? 'current', input.currency ?? 'IRR', input.companyId ?? null, input.status ?? 'active'])
    return { id: input.id }
  }
  return (await pgQuery<{ id: number }>(`INSERT INTO bank_accounts (name, bank, iban, account_no, swift, branch, country, account_type, currency, company_id, opening_balance, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [input.name, input.bank ?? null, input.iban ?? null, input.accountNo ?? null, input.swift ?? null, input.branch ?? null, input.country ?? null, input.accountType ?? 'current', input.currency ?? 'IRR', input.companyId ?? null, input.openingBalance ?? 0, input.status ?? 'active']))[0]
}

// ── Statement import (M2) ────────────────────────────────────────────────────
export function parseStatement(format: string, content: string, mapping?: CsvMapping): ImportedLine[] {
  if (format === 'mt940') return parseMt940(content)
  if (format === 'camt053') return parseCamt053(content)
  return parseCsv(content, mapping ?? { date: 'date', amount: 'amount', description: 'description', reference: 'reference' })
}

export async function importStatement(accountId: number, format: string, content: string, userId: string, mapping?: CsvMapping): Promise<{ statementId: number; imported: number; duplicates: number }> {
  const parsed = parseStatement(format, content, mapping)
  const existing = (await pgQuery<{ date: string; amount: number; reference: string | null }>(`SELECT date, amount::float AS amount, reference FROM bank_statement_lines WHERE account_id=$1`, [accountId]))
    .map(r => ({ date: r.date, amount: Number(r.amount), reference: r.reference ?? '' }))
  const { fresh, duplicates } = detectDuplicates(existing, parsed)
  const dates = parsed.map(p => p.date).sort()
  const stmt = (await pgQuery<{ id: number }>(`INSERT INTO bank_statements (account_id, format, period_from, period_to, line_count, imported_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [accountId, format, dates[0] ?? null, dates[dates.length - 1] ?? null, fresh.length, userId]))[0]
  for (const l of fresh) {
    await pgQuery(`INSERT INTO bank_statement_lines (account_id, statement_id, date, description, amount, reference, erp_type, fingerprint) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [accountId, stmt.id, l.date, l.description, l.amount, l.reference, mapErpType(l), lineFingerprint(l)])
  }
  return { statementId: stmt.id, imported: fresh.length, duplicates: duplicates.length }
}

export async function listStatementLines(accountId: number, status = 'unmatched') {
  return pgQuery(`SELECT id, date, description, amount::float AS amount, reference, erp_type AS "erpType", status, matched_ref AS "matchedRef" FROM bank_statement_lines WHERE account_id=$1 AND ($2='all' OR status=$2) ORDER BY date DESC, id DESC LIMIT 500`, [accountId, status])
}

// ── Reconciliation (M3) ──────────────────────────────────────────────────────
/** ERP candidates for matching: unreconciled sales/purchase payments + payment orders. */
async function erpCandidates(): Promise<ErpCandidate[]> {
  const sales = await pgQuery<{ id: number; date: string; amount: number; party: string }>(
    `SELECT p.id, p.date, p.amount::float AS amount, COALESCE(c.name,'?') AS party FROM sales_payments p LEFT JOIN sales_customers c ON c.id=p.customer_id ORDER BY p.date DESC LIMIT 500`).catch(() => [])
  const purch = await pgQuery<{ id: number; date: string; amount: number; party: string }>(
    `SELECT p.id, p.date, p.amount::float AS amount, COALESCE(v.name,'?') AS party FROM purchase_payments p LEFT JOIN purchase_vendors v ON v.id=p.vendor_id ORDER BY p.date DESC LIMIT 500`).catch(() => [])
  return [
    ...sales.map(s => ({ id: `sales_payment:${s.id}`, date: s.date, amount: Number(s.amount), party: s.party })),
    ...purch.map(p => ({ id: `purchase_payment:${p.id}`, date: p.date, amount: -Number(p.amount), party: p.party })),
  ]
}

export async function suggestMatches(accountId: number): Promise<{ suggestions: ReturnType<typeof reconcile>; stats: ReturnType<typeof reconStats> }> {
  const lines = (await pgQuery<{ id: number; date: string; amount: number; description: string | null; reference: string | null }>(
    `SELECT id, date, amount::float AS amount, description, reference FROM bank_statement_lines WHERE account_id=$1 AND status='unmatched'`, [accountId]))
    .map(l => ({ id: l.id, date: l.date, amount: Number(l.amount), description: l.description ?? '', reference: l.reference ?? '' })) as StmtLine[]
  const suggestions = reconcile(lines, await erpCandidates())
  return { suggestions, stats: reconStats(suggestions) }
}

/**
 * Confirm a match (or reject) — persists to bank_matches + flips the line.
 *
 * Phase-9 audit finding: this ran as two bare, unlocked statements (INSERT
 * bank_matches, then UPDATE bank_statement_lines) with NO transaction and NO
 * "already matched" guard. Two concurrent confirmMatch calls on the SAME
 * line — or a retried request — could both insert a match row and both
 * flip the line, and a line already matched to one ERP reference could be
 * silently RE-matched to a different one (a contradictory final state: the
 * line's `matched_ref` would end up pointing at whichever call won the
 * race, not the one an operator actually reviewed). Fixed: the whole
 * check-insert-update sequence now runs inside one transaction locked per
 * statement-line id — a line already `matched` or `rejected` returns the
 * EXISTING match deterministically (idempotent) instead of creating a
 * second, possibly-contradictory one.
 */
export async function confirmMatch(lineId: number, erpRef: string, confidence: number, status: 'matched' | 'rejected', reasons: string[], userId: string): Promise<{ alreadyReconciled: boolean; matchedRef: string | null }> {
  return withTransaction(async query => {
    await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`bank_stmt_line_match:${lineId}`])
    const line = (await query<{ status: string; matched_ref: string | null }>(`SELECT status, matched_ref FROM bank_statement_lines WHERE id=$1`, [lineId]))[0]
    if (!line) throw new Error('Statement line not found')
    // A line already MATCHED is settled — never silently re-matched to a
    // different reference. A 'rejected' STATUS doesn't exist on this column
    // (rejecting a suggestion intentionally leaves the line 'unmatched' so
    // it can still be matched later — only the bank_matches audit trail
    // remembers the rejection, established behavior, unchanged here).
    if (line.status === 'matched') {
      return { alreadyReconciled: true, matchedRef: line.matched_ref }
    }
    await query(`INSERT INTO bank_matches (statement_line_id, erp_ref, confidence, status, reasons, matched_by) VALUES ($1,$2,$3,$4,$5,$6)`,
      [lineId, erpRef, confidence, status, reasons.join('; '), userId])
    if (status === 'matched') await query(`UPDATE bank_statement_lines SET status='matched', matched_ref=$2 WHERE id=$1`, [lineId, erpRef])
    return { alreadyReconciled: false, matchedRef: status === 'matched' ? erpRef : null }
  })
}

/**
 * 26.32 بند۴ — `bank_matches` was WRITE-ONLY. It is the reconciliation AUDIT
 * TRAIL: who matched which statement line to which ERP reference, at what
 * confidence, and which suggestions were REJECTED. Without a read path an
 * auditor could not answer "why is this line considered reconciled?", and a
 * rejected suggestion silently reappeared on every rescan.
 */
export async function matchHistory(accountId: number) {
  return await pgQuery<{
    id: number; lineId: number; date: string; amount: number; description: string | null
    erpRef: string; confidence: number; status: string; reasons: string | null
    matchedByName: string | null; createdAt: string
  }>(
    `SELECT m.id, m.statement_line_id AS "lineId", l.date, l.amount::float AS amount,
            l.description, m.erp_ref AS "erpRef", m.confidence, m.status, m.reasons,
            u.name AS "matchedByName", m.created_at AS "createdAt"
     FROM bank_matches m
     JOIN bank_statement_lines l ON l.id = m.statement_line_id
     LEFT JOIN users u ON u.id = m.matched_by
     WHERE l.account_id = $1
     ORDER BY m.created_at DESC LIMIT 200`, [accountId])
}

export { NOW as TREASURY_NOW }
