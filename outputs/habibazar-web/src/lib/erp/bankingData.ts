/**
 * Banking data layer (Phase 26) — PostgreSQL access for reconciliation, cheques
 * and petty cash. Pure logic lives in `banking.ts`.
 */
import { pgQuery } from '@/lib/db'
import {
  matchStatement, reconciliationSummary, canTransition, chequeStart, chequeKpis, pettyCashSummary,
  cashFlowSeries, type MatchCandidate, type ChequeDirection, type ChequeStatus,
} from './banking'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const num = (v: unknown) => Number(v ?? 0)

// ── Accounts ─────────────────────────────────────────────────────────────────
export async function listAccounts() {
  // Live balance = opening balance + every imported statement movement
  // (excluded lines are still real bank money — exclusion only skips matching).
  return pgQuery(
    `SELECT a.id, a.name, a.bank, a.iban, a.account_no AS "accountNo", a.currency,
            a.opening_balance::float AS "openingBalance",
            (a.opening_balance + COALESCE((SELECT SUM(l.amount) FROM bank_statement_lines l WHERE l.account_id=a.id),0))::float AS balance,
            a.active
     FROM bank_accounts a ORDER BY a.name`)
}
export async function createAccount(a: { name: string; bank?: string; iban?: string; accountNo?: string; currency?: string; openingBalance?: number }) {
  const r = (await pgQuery<{ id: number }>(
    `INSERT INTO bank_accounts (name, bank, iban, account_no, currency, opening_balance, created_at) VALUES ($1,$2,$3,$4,$5,$6,${NOW}) RETURNING id`,
    [a.name, a.bank ?? null, a.iban ?? null, a.accountNo ?? null, a.currency ?? 'IRR', a.openingBalance ?? 0]))[0]
  return r.id
}

// ── Statement import + reconciliation ────────────────────────────────────────
export interface ImportLine { date: string; amount: number; description?: string; reference?: string }
export async function importStatement(accountId: number, lines: ImportLine[]): Promise<number> {
  let n = 0
  for (const l of lines) {
    if (!l.date || !Number.isFinite(l.amount)) continue
    await pgQuery(`INSERT INTO bank_statement_lines (account_id, date, description, amount, reference, created_at) VALUES ($1,$2,$3,$4,$5,${NOW})`,
      [accountId, l.date, l.description ?? null, l.amount, l.reference ?? null])
    n++
  }
  return n
}

export async function statementLines(accountId: number) {
  return pgQuery<{ id: number; date: string; description: string | null; amount: number; reference: string | null; status: string; matched_ref: string | null }>(
    `SELECT id, date, description, amount::float AS amount, reference, status, matched_ref FROM bank_statement_lines WHERE account_id=$1 ORDER BY date DESC, id DESC`, [accountId])
}

/** Payment candidates from both ledgers (sales receipts + purchase payments). */
async function paymentCandidates(): Promise<MatchCandidate[]> {
  const sales = await pgQuery<{ id: number; date: string; amount: number }>(`SELECT id, date, amount::float AS amount FROM sales_payments`)
  const purchase = await pgQuery<{ id: number; date: string; amount: number }>(`SELECT id, date, amount::float AS amount FROM purchase_payments`)
  return [
    ...sales.map(p => ({ id: `sales_payment:${p.id}`, date: p.date, amount: p.amount, label: 'Sales receipt' })),
    ...purchase.map(p => ({ id: `purchase_payment:${p.id}`, date: p.date, amount: -p.amount, label: 'Vendor payment' })),
  ]
}

/** Auto-match unmatched lines against recorded payments; persists the matches. */
export async function autoMatch(accountId: number): Promise<{ matched: number; suggestions: number }> {
  const lines = (await statementLines(accountId)).filter(l => l.status === 'unmatched')
  const candidates = await paymentCandidates()
  // Exclude candidates already consumed by earlier matches.
  const used = new Set((await pgQuery<{ matched_ref: string }>(`SELECT matched_ref FROM bank_statement_lines WHERE matched_ref IS NOT NULL`)).map(r => r.matched_ref))
  const free = candidates.filter(c => !used.has(c.id))
  const result = matchStatement(lines.map(l => ({ id: l.id, date: l.date, amount: num(l.amount) })), free)
  let matched = 0
  for (const s of result.suggestions) {
    await pgQuery(`UPDATE bank_statement_lines SET status='matched', matched_ref=$2 WHERE id=$1 AND status='unmatched'`, [s.lineId, s.candidateId])
    matched++
  }
  return { matched, suggestions: result.suggestions.length }
}

export async function setLineStatus(lineId: number, status: 'unmatched' | 'matched' | 'excluded', matchedRef?: string) {
  await pgQuery(`UPDATE bank_statement_lines SET status=$2, matched_ref=$3 WHERE id=$1`, [lineId, status, matchedRef ?? null])
}

export async function reconSummary(accountId: number) {
  const lines = await statementLines(accountId)
  return reconciliationSummary(lines.map(l => ({ amount: num(l.amount), status: l.status })))
}

// ── Cheques ──────────────────────────────────────────────────────────────────
export async function listCheques() {
  return pgQuery(`SELECT id, direction, number, party, amount::float AS amount, currency, due_date AS "dueDate", bank_account_id AS "bankAccountId", status, note FROM cheques ORDER BY due_date NULLS LAST, id DESC`)
}
export async function createCheque(c: { direction: ChequeDirection; number: string; party: string; amount: number; currency?: string; dueDate?: string; bankAccountId?: number; note?: string }, userId?: string) {
  const r = (await pgQuery<{ id: number }>(
    `INSERT INTO cheques (direction, number, party, amount, currency, due_date, bank_account_id, status, note, created_by, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,${NOW},${NOW}) RETURNING id`,
    [c.direction, c.number, c.party, c.amount, c.currency ?? 'IRR', c.dueDate ?? null, c.bankAccountId ?? null, chequeStart(c.direction), c.note ?? null, userId ?? null]))[0]
  return r.id
}
export async function transitionCheque(id: number, to: ChequeStatus): Promise<{ ok: boolean; error?: string }> {
  const c = (await pgQuery<{ direction: ChequeDirection; status: ChequeStatus }>(`SELECT direction, status FROM cheques WHERE id=$1`, [id]))[0]
  if (!c) return { ok: false, error: 'Cheque not found' }
  if (!canTransition(c.direction, c.status, to)) return { ok: false, error: `Cannot move a ${c.direction} cheque from ${c.status} to ${to}` }
  await pgQuery(`UPDATE cheques SET status=$2, updated_at=${NOW} WHERE id=$1`, [id, to])
  return { ok: true }
}
export async function chequeOverview() {
  const rows = await pgQuery<{ status: ChequeStatus; amount: number; due_date: string | null }>(`SELECT status, amount::float AS amount, due_date FROM cheques`)
  return chequeKpis(rows.map(r => ({ status: r.status, amount: num(r.amount), dueDate: r.due_date })))
}

// ── Petty cash ───────────────────────────────────────────────────────────────
export async function listPetty(limit = 100) {
  return pgQuery(`SELECT id, kind, date, amount::float AS amount, category, note FROM petty_cash_entries ORDER BY date DESC, id DESC LIMIT $1`, [limit])
}
export async function addPetty(e: { kind: 'float' | 'expense' | 'replenish'; date: string; amount: number; category?: string; note?: string }, userId?: string) {
  const r = (await pgQuery<{ id: number }>(
    `INSERT INTO petty_cash_entries (kind, date, amount, category, note, created_by, created_at) VALUES ($1,$2,$3,$4,$5,$6,${NOW}) RETURNING id`,
    [e.kind, e.date, e.amount, e.category ?? null, e.note ?? null, userId ?? null]))[0]
  return r.id
}
export async function pettyOverview() {
  const rows = await pgQuery<{ kind: 'float' | 'expense' | 'replenish'; amount: number }>(`SELECT kind, amount::float AS amount FROM petty_cash_entries`)
  return pettyCashSummary(rows.map(r => ({ kind: r.kind, amount: num(r.amount) })))
}

// ── Cash flow (Phase 26.3) ───────────────────────────────────────────────────
/** Treasury dashboard: monthly in/out/net + forecast + live bank position. */
export async function cashFlow(months = 12) {
  const receipts = await pgQuery<{ date: string; amount: number }>(`SELECT date, amount::float AS amount FROM sales_payments`)
  const payments = await pgQuery<{ date: string; amount: number }>(`SELECT date, amount::float AS amount FROM purchase_payments`)
  const series = cashFlowSeries(receipts, payments, { months })
  const accounts = (await listAccounts()) as { id: number; name: string; currency: string; balance: number }[]
  // 26.8: consolidate FX accounts in the Rial base (per-account balances stay original).
  const { rialRateFor } = await import('./currencyData')
  let bankBalance = 0
  for (const a of accounts) bankBalance += num(a.balance) * ((await rialRateFor(a.currency)) ?? 1)
  return { ...series, accounts: accounts.map(a => ({ id: a.id, name: a.name, currency: a.currency, balance: num(a.balance) })), bankBalance: Math.round(bankBalance) }
}
