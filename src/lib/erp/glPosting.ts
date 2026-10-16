/**
 * GL integration layer (Phase 26.23). One place for:
 *  - the configurable account MAP (erp_settings gl_map_* → seeded chart defaults)
 *  - payment posting (sales receipt: Dr Bank / Cr AR · purchase payment: Dr AP / Cr Bank)
 *  - REVERSAL entries (void on a posted entry books a dated mirror entry with
 *    two-way linkage reversal_of / reversed_by — the audit-safe alternative to
 *    silently flipping status)
 * Invoice posting itself stays in salesData/purchasingData (26.15.1) — this
 * module only feeds them the mapped accounts and adds the missing pieces.
 */
import { pgQuery, withTransaction, type TxQuery } from '@/lib/db'
import { nextNumberInTx } from '@/lib/numbering/integrate'
import { assertPostable, throwPostableError } from './accountingData'
import { isValidPostingDate } from './accountingCore'
import { entryBalanced } from './ledger'
import { throwBusinessError } from '@/lib/errors'
import { COA } from './coaContract'
import { erpSettings } from './settings'
import { linesToBase, settlementLines, documentControlBase, proportionalRelief } from './money'
import type { PostingLine } from './sales'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const num = (v: unknown) => Number(v ?? 0)

export interface GlMap { ar: string; revenue: string; vat: string; ap: string; inventory: string; bank: string }
const DEFAULT_MAP: GlMap = { ar: '1100', revenue: '4000', vat: '2100', ap: '2000', inventory: '1200', bank: '1010' }

/** Load the configurable posting map (falls back to the seeded chart codes). */
export async function loadGlMap(): Promise<GlMap> {
  try {
    const rows = await pgQuery<{ key: string; value: string }>(
      `SELECT key, value FROM erp_settings WHERE key LIKE 'gl_map_%'`)
    const byKey = new Map(rows.map(r => [r.key, r.value]))
    return {
      ar: byKey.get('gl_map_ar') || DEFAULT_MAP.ar,
      revenue: byKey.get('gl_map_revenue') || DEFAULT_MAP.revenue,
      vat: byKey.get('gl_map_vat') || DEFAULT_MAP.vat,
      ap: byKey.get('gl_map_ap') || DEFAULT_MAP.ap,
      inventory: byKey.get('gl_map_inventory') || DEFAULT_MAP.inventory,
      bank: byKey.get('gl_map_bank') || DEFAULT_MAP.bank,
    }
  } catch { return DEFAULT_MAP }
}

/**
 * ERPFIX-1 (BUG-ERP-10): the payroll-expense account as configured
 * (erp_settings.gl_map_payroll_expense), defaulting to the contract's
 * «Salaries Expense». Used by every path that expenses salaries outside the
 * HR module (treasury salary payments) so no module posts salaries by literal.
 */
export async function loadPayrollExpenseCode(query: TxQuery = pgQuery): Promise<string> {
  try {
    const r = (await query<{ value: string }>(`SELECT value FROM erp_settings WHERE key='gl_map_payroll_expense'`))[0]
    return r?.value || COA.payrollExpense
  } catch { return COA.payrollExpense }
}

/** Pure: translate the engine's default account codes through the map. */
export function applyGlMap(lines: PostingLine[], map: GlMap): PostingLine[] {
  const translate: Record<string, string> = {
    [DEFAULT_MAP.ar]: map.ar, [DEFAULT_MAP.revenue]: map.revenue, [DEFAULT_MAP.vat]: map.vat,
    [DEFAULT_MAP.ap]: map.ap, [DEFAULT_MAP.inventory]: map.inventory, [DEFAULT_MAP.bank]: map.bank,
  }
  return lines.map(l => ({ ...l, accountCode: translate[l.accountCode] ?? l.accountCode }))
}

/** Pure: mirror an entry's lines (debit↔credit) for a reversal. */
export function reversalLines(lines: { accountId: number; debit: number; credit: number; memo?: string | null; fxAmount?: number | null; fxCurrency?: string | null }[]): { accountId: number; debit: number; credit: number; memo: string | null; fxAmount: number | null; fxCurrency: string | null }[] {
  // ERPFIX-2: the original transaction-currency amount travels with the line.
  return lines.map(l => ({ accountId: l.accountId, debit: num(l.credit), credit: num(l.debit), memo: l.memo ?? null, fxAmount: l.fxAmount ?? null, fxCurrency: l.fxCurrency ?? null }))
}

export async function accountIdByCode(code: string, query: TxQuery = pgQuery): Promise<number> {
  const r = (await query<{ id: number }>(`SELECT id FROM gl_accounts WHERE code=$1 LIMIT 1`, [code]))[0]
  if (!r) throw new Error(`GL account ${code} is missing from the chart`)
  return r.id
}

/** Resolve several account codes at once; throws naming the first missing one. */
export async function accountIdsByCodes(codes: string[], query: TxQuery = pgQuery): Promise<Map<string, number>> {
  const uniq = [...new Set(codes)]
  const rows = await query<{ id: number; code: string }>(`SELECT id, code FROM gl_accounts WHERE code = ANY($1)`, [uniq])
  const byCode = new Map(rows.map(r => [r.code, r.id]))
  for (const c of uniq) if (!byCode.has(c)) throw new Error(`GL account ${c} is missing from the chart`)
  return byCode
}

export interface PostedLineInput {
  accountId: number; debit: number; credit: number; memo?: string | null; costCenterId?: number | null
  /** ERPFIX-2: the line's original amount in the transaction currency (null for base-currency lines). */
  fxAmount?: number | null; fxCurrency?: string | null
}
export interface PostedEntryOptions {
  companyId?: number | null
  currency?: string
  exchangeRate?: number
  /** Default cost center stamped on every line that does not carry its own. */
  costCenterId?: number | null
  /** Year-end closing / opening balance ONLY: a closed period is postable, a locked one never. */
  allowClosedPeriod?: boolean
  /** Pre-minted number (import job numbers its groups up-front). Otherwise minted here. */
  entryNo?: string
  /** Numbering Engine doc type; 'journal' by default. */
  docType?: string
  legacyPrefix?: string
}

/**
 * ERPFIX-1 (BUG-ERP-08/21) — THE single place a POSTED journal entry is
 * written. Every automatic and manual posting path in src/ goes through here
 * (enforced by `npm run audit:gl-writes`). In order:
 *   1. the date is a real YYYY-MM-DD calendar date
 *   2. the lines balance (ledger.entryBalanced: ≥2 lines, no negative amount,
 *      no two-sided line, Dr = Cr > 0)
 *   3. the fiscal-period gate (assertPostable) — closed/locked periods and, once
 *      periods exist, dates outside every period are refused. The period row is
 *      re-read FOR SHARE inside the caller's transaction so a concurrent close
 *      cannot slip in between the check and the insert.
 *   4. the number comes from the Numbering Engine (never Date.now())
 *   5./6. header + every line, inside the caller's transaction
 * `query` MUST be a transaction-bound TxQuery (withTransaction) — callers that
 * also link the entry back to a source row do so in the same transaction.
 * The DB backs this up: a deferred constraint trigger rejects any posted entry
 * that does not balance at commit, and entry_no is unique per company.
 *
 * The number is minted on the caller's own connection inside its transaction
 * (nextNumberInTx): no second pool connection is needed while one is held
 * (that starved the pool under concurrency and fell back to Date.now()
 * numbers), and a rolled-back posting rolls its number back too.
 */
export async function insertPostedEntry(
  query: TxQuery,
  date: string, memo: string, reference: string, userId: string | undefined | null,
  lines: PostedLineInput[],
  options: PostedEntryOptions = {},
): Promise<{ id: number; entryNo: string; total: number }> {
  if (!isValidPostingDate(date)) throwBusinessError('ERP-FINANCE-INVALID-DATE', { date: String(date) })
  const check = entryBalanced(lines.map(l => ({ accountId: l.accountId, debit: num(l.debit), credit: num(l.credit) })))
  if (!check.ok) throwBusinessError('ERP-FINANCE-JOURNAL-UNBALANCED', { reason: check.reason ?? '' })
  const gate = await assertPostable(date, { allowClosedPeriod: options.allowClosedPeriod, query })
  if (!gate.ok) throwPostableError(date, gate)
  if (gate.periodId != null) {
    const p = (await query<{ status: string; name: string }>(`SELECT status, name FROM gl_fiscal_periods WHERE id=$1 FOR SHARE`, [gate.periodId]))[0]
    if (p && !(p.status === 'open' || (p.status === 'closed' && options.allowClosedPeriod))) {
      throwBusinessError('ERP-FINANCE-PERIOD-CLOSED', { name: p.name, status: p.status })
    }
  }
  const entryNo = options.entryNo ?? await nextNumberInTx(query, options.docType ?? 'journal', { legacyPrefix: options.legacyPrefix ?? 'JE', userId: userId ?? null })
  const e = (await query<{ id: number }>(
    `INSERT INTO gl_journal_entries (entry_no, date, memo, reference, status, total, currency, exchange_rate, created_by, period_id, company_id, created_at, posted_at)
     VALUES ($1,$2,$3,$4,'posted',$5,$6,$7,$8,$9,$10,${NOW},${NOW}) RETURNING id`,
    [entryNo, date, memo, reference, check.totalDebit, options.currency ?? 'IRR', num(options.exchangeRate) || 1,
      userId ?? null, gate.periodId ?? null, options.companyId ?? null]))[0]
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    await query(`INSERT INTO gl_journal_lines (entry_id, account_id, debit, credit, memo, line_no, cost_center_id, fx_amount, fx_currency) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [e.id, l.accountId, num(l.debit), num(l.credit), l.memo ?? null, i, l.costCenterId ?? options.costCenterId ?? null,
        l.fxAmount ?? null, l.fxAmount != null ? (l.fxCurrency ?? null) : null])
  }
  return { id: e.id, entryNo, total: check.totalDebit }
}

/** ERPFIX-2: base-currency rounding precision (erp_settings.decimal_precision, default 0). */
export async function basePrecision(): Promise<number> {
  try { return (await erpSettings()).decimalPrecision } catch { return 0 }
}

interface PaymentRow { amount: number; date: string; gl_entry_id: number | null; party: string | null; currency: string | null; exchange_rate: number | null; document_id: number | null }
interface DocRow { subtotal: number; discount_total: number; tax_total: number; total: number; exchange_rate: number | null; currency: string | null }

/**
 * Booked-rate relief of the control account for one settlement (ERPFIX-2).
 * null when the payment is not tied to a document, or is in a different
 * currency than the document (then it is relieved at the payment rate).
 */
async function bookedRelief(query: TxQuery, docTable: 'sales_documents' | 'purchase_documents', payTable: 'sales_payments' | 'purchase_payments', payId: number, p: PaymentRow, precision: number): Promise<number | null> {
  if (!p.document_id) return null
  const d = (await query<DocRow>(
    docTable === 'sales_documents'
      ? `SELECT subtotal::float AS subtotal, discount_total::float AS discount_total, tax_total::float AS tax_total, total::float AS total, exchange_rate::float AS exchange_rate, currency FROM sales_documents WHERE id=$1`
      : `SELECT subtotal::float AS subtotal, discount_total::float AS discount_total, tax_total::float AS tax_total, total::float AS total, exchange_rate::float AS exchange_rate, currency FROM purchase_documents WHERE id=$1`,
    [p.document_id]))[0]
  if (!d || (d.currency ?? 'IRR') !== (p.currency ?? 'IRR')) return null
  const before = (await query<{ s: number }>(
    payTable === 'sales_payments'
      ? `SELECT COALESCE(SUM(amount),0)::float AS s FROM sales_payments WHERE document_id=$1 AND id < $2`
      : `SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE document_id=$1 AND id < $2`,
    [p.document_id, payId]))[0]
  const controlBase = documentControlBase(num(d.subtotal) - num(d.discount_total), num(d.tax_total), num(d.exchange_rate) || 1, precision)
  return proportionalRelief(controlBase, num(d.total), num(before?.s), num(p.amount), precision)
}

/** ERPFIX-2: the settlement lines a payment row posts (also used by the FX remediation). */
export async function planSettlement(query: TxQuery, kind: 'receivable' | 'payable', payId: number): Promise<{ lines: ReturnType<typeof settlementLines>['lines']; currency: string; rate: number; date: string; party: string | null; glEntryId: number | null } | null> {
  const payTable = kind === 'receivable' ? 'sales_payments' : 'purchase_payments'
  const p = (await query<PaymentRow>(
    payTable === 'sales_payments'
      ? `SELECT p.amount::float AS amount, p.date, p.gl_entry_id, c.name AS party, p.currency, p.exchange_rate::float AS exchange_rate, p.document_id
         FROM sales_payments p LEFT JOIN sales_customers c ON c.id=p.customer_id WHERE p.id=$1`
      : `SELECT p.amount::float AS amount, p.date, p.gl_entry_id, v.name AS party, p.currency, p.exchange_rate::float AS exchange_rate, p.document_id
         FROM purchase_payments p LEFT JOIN purchase_vendors v ON v.id=p.vendor_id WHERE p.id=$1`,
    [payId]))[0]
  if (!p) return null
  const map = await loadGlMap()
  const precision = await basePrecision()
  const currency = p.currency ?? 'IRR'
  const rate = num(p.exchange_rate) || 1
  const relief = await bookedRelief(query, kind === 'receivable' ? 'sales_documents' : 'purchase_documents', payTable, payId, p, precision)
  const s = settlementLines({ kind, currency, paymentRate: rate, amount: num(p.amount), relief, precision,
    accounts: { bank: map.bank, control: kind === 'receivable' ? map.ar : map.ap, gain: COA.fxGain, loss: COA.fxLoss } })
  return { lines: s.lines, currency, rate, date: p.date, party: p.party, glEntryId: p.gl_entry_id }
}

async function postSettlement(
  kind: 'receivable' | 'payable', payId: number, userId: string | undefined,
  cfg: { payTable: 'sales_payments' | 'purchase_payments'; lockKey: string; refPrefix: string; memo: string },
): Promise<{ entryId: number; alreadyPosted: boolean }> {
  return withTransaction(async query => {
    await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`${cfg.lockKey}:${payId}`])
    const plan = await planSettlement(query, kind, payId)
    if (!plan) throw new Error('Payment not found')
    if (plan.glEntryId) return { entryId: plan.glEntryId, alreadyPosted: true }
    const ids = await accountIdsByCodes(plan.lines.map(l => l.accountCode), query)
    const e = await insertPostedEntry(query, plan.date, `${cfg.memo}${plan.party ? ` — ${plan.party}` : ''}`, `${cfg.refPrefix}-${payId}`, userId,
      plan.lines.map(l => ({ accountId: ids.get(l.accountCode)!, debit: l.debit, credit: l.credit, memo: l.memo, fxAmount: l.fxAmount, fxCurrency: l.fxCurrency })),
      { currency: plan.currency, exchangeRate: plan.rate })
    await query(cfg.payTable === 'sales_payments'
      ? `UPDATE sales_payments SET gl_entry_id=$2 WHERE id=$1`
      : `UPDATE purchase_payments SET gl_entry_id=$2 WHERE id=$1`, [payId, e.id])
    return { entryId: e.id, alreadyPosted: false }
  })
}

/**
 * Sales receipt → Dr Bank / Cr AR (idempotent per payment).
 * Phase-7 finance audit: the gl_entry_id pre-check re-verifies inside a
 * per-payment advisory lock. ERPFIX-2: bank at the payment's own rate, AR at
 * the invoice's BOOKED rate (proportional to the share settled), the
 * difference to realized FX gain 4900 / loss 6980.
 */
export async function postSalesPaymentToGl(paymentId: number, userId?: string): Promise<{ entryId: number; alreadyPosted: boolean }> {
  return postSettlement('receivable', paymentId, userId, { payTable: 'sales_payments', lockKey: 'sales_payment_gl_post', refPrefix: 'SPAY', memo: 'Customer receipt' })
}

/**
 * Customer refund (sales-return settlement, 26.26 BUG-013) → Dr AR / Cr Bank for
 * the ABS amount (money returned to the customer brings AR back to 0). The refund
 * is stored as a NEGATIVE sales_payment so the sub-ledger `paid` drops; here we
 * post its GL. Idempotent per payment via gl_entry_id. ERPFIX-2: converted to
 * base at the refund's own rate (the credit note's booked rate).
 */
export async function postCustomerRefundToGl(paymentId: number, userId?: string): Promise<{ entryId: number; alreadyPosted: boolean }> {
  const map = await loadGlMap()
  const precision = await basePrecision()
  return withTransaction(async query => {
    await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`sales_payment_gl_post:${paymentId}`])
    const p = (await query<PaymentRow>(
      `SELECT p.amount::float AS amount, p.date, p.gl_entry_id, c.name AS party, p.currency, p.exchange_rate::float AS exchange_rate, p.document_id
       FROM sales_payments p LEFT JOIN sales_customers c ON c.id=p.customer_id WHERE p.id=$1`, [paymentId]))[0]
    if (!p) throw new Error('Payment not found')
    if (p.gl_entry_id) return { entryId: p.gl_entry_id, alreadyPosted: true }
    const amt = Math.abs(num(p.amount))
    const currency = p.currency ?? 'IRR'
    const rate = num(p.exchange_rate) || 1
    const lines = linesToBase([
      { accountCode: map.ar, debit: amt, credit: 0, memo: 'Refund — AR' },
      { accountCode: map.bank, debit: 0, credit: amt, memo: 'Refund — bank out' },
    ], rate, currency, map.bank, precision)
    const ids = await accountIdsByCodes(lines.map(l => l.accountCode), query)
    const e = await insertPostedEntry(query, p.date, `Customer refund${p.party ? ` — ${p.party}` : ''}`, `SREF-${paymentId}`, userId,
      lines.map(l => ({ accountId: ids.get(l.accountCode)!, debit: l.debit, credit: l.credit, memo: l.memo, fxAmount: l.fxAmount, fxCurrency: l.fxCurrency })),
      { currency, exchangeRate: rate })
    await query(`UPDATE sales_payments SET gl_entry_id=$2 WHERE id=$1`, [paymentId, e.id])
    return { entryId: e.id, alreadyPosted: false }
  })
}

/** Purchase payment → Dr AP / Cr Bank (idempotent per payment); ERPFIX-2 FX as for receipts, mirrored. */
export async function postPurchasePaymentToGl(paymentId: number, userId?: string): Promise<{ entryId: number; alreadyPosted: boolean }> {
  return postSettlement('payable', paymentId, userId, { payTable: 'purchase_payments', lockKey: 'purchase_payment_gl_post', refPrefix: 'PPAY', memo: 'Supplier payment' })
}

/**
 * Shared posting path (journal route + approval hook): balance + period
 * gate → posted. Phase-7 finance audit: locked + transactional so two
 * concurrent "post" calls on the same draft can't both pass the
 * status==='draft' check and both run makerCheckerGate/audit at the route
 * layer as if each were the real transition — the second now correctly
 * sees the already-posted status and reports the same non-error outcome
 * (posting is inherently a single status transition, not a duplicatable
 * financial event, but the check-then-act race itself is closed here).
 */
export async function postEntryById(id: number): Promise<{ ok: boolean; error?: string; alreadyPosted?: boolean }> {
  return withTransaction(async query => {
    await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`gl_entry_post:${id}`])
    const e = (await query<{ status: string; date: string }>(`SELECT status, date FROM gl_journal_entries WHERE id=$1`, [id]))[0]
    if (!e) return { ok: false, error: 'Not found' }
    if (e.status === 'posted') return { ok: true, alreadyPosted: true }
    if (e.status !== 'draft') return { ok: false, error: 'Only draft entries can be posted' }
    const lines = await query<{ account_id: number; debit: number; credit: number }>(
      `SELECT account_id, debit::float AS debit, credit::float AS credit FROM gl_journal_lines WHERE entry_id=$1`, [id])
    // ERPFIX-1: the same validation as insertPostedEntry (no negative or
    // two-sided line, Dr = Cr), not just a sum comparison.
    const check = entryBalanced(lines.map(l => ({ accountId: l.account_id, debit: num(l.debit), credit: num(l.credit) })))
    if (!check.ok) return { ok: false, error: 'Entry is not balanced' }
    const gate = await assertPostable(e.date, { query })
    if (!gate.ok) return { ok: false, error: gate.error }
    if (gate.periodId != null) {
      const p = (await query<{ status: string; name: string }>(`SELECT status, name FROM gl_fiscal_periods WHERE id=$1 FOR SHARE`, [gate.periodId]))[0]
      if (p && p.status !== 'open') return { ok: false, error: `Fiscal period "${p.name}" is ${p.status}; postings are not allowed.` }
    }
    await query(`UPDATE gl_journal_entries SET status='posted', posted_at=${NOW}, period_id=COALESCE(period_id,$2) WHERE id=$1`, [id, gate.periodId ?? null])
    return { ok: true, alreadyPosted: false }
  })
}

/**
 * Reverse a posted entry: books a posted mirror entry dated `asOf` (default:
 * today), marks the source void and links both directions. Idempotent — an
 * already-reversed entry returns the existing reversal.
 *
 * Phase-7 finance audit finding: the idempotency check (`e.reversed_by`)
 * and every subsequent guard ran as a bare pre-transaction read — two
 * genuinely concurrent void/reverse calls on the SAME posted entry (e.g.
 * a double-click, or two callers racing on the same invoice) could both
 * read `reversed_by=null`, both pass every guard, and both post a full
 * balanced reversal entry, with the second `UPDATE ... SET reversed_by`
 * simply overwriting the first's link — leaving TWO real reversal entries
 * posted on the books (double-reversing the original's financial effect)
 * while only one stayed linked, breaking this function's OWN idempotency
 * check on any future retry. Fixed: the whole read-check-insert-link
 * sequence now runs inside one transaction serialized per entry id via
 * pg_advisory_xact_lock — the second concurrent call blocks until the
 * first commits, then correctly re-reads the now-populated `reversed_by`
 * and returns the EXISTING reversal instead of creating a second one.
 */
export async function reverseEntry(entryId: number, userId?: string, asOf?: string, outerQuery?: TxQuery): Promise<{ reversalId: number; alreadyReversed: boolean }> {
  const date = asOf ?? new Date().toISOString().slice(0, 10)
  // ERPFIX-2: `outerQuery` lets a caller compose the reversal into its own
  // transaction (the FX remediation reverses + re-posts atomically).
  const run = async (query: TxQuery) => {
    await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`gl_entry_reversal:${entryId}`])
    const e = (await query<{ status: string; entry_no: string; total: number; reversed_by: number | null; reversal_of: number | null; currency: string | null; exchange_rate: number | null; company_id: number | null }>(
      `SELECT status, entry_no, total::float AS total, reversed_by, reversal_of, currency, exchange_rate::float AS exchange_rate, company_id FROM gl_journal_entries WHERE id=$1`, [entryId]))[0]
    if (!e) throw new Error('Entry not found')
    if (e.reversed_by) return { reversalId: e.reversed_by, alreadyReversed: true }
    // 26.26c بند ۱.۲: a reversal entry can never itself be reversed — that would
    // un-reverse the original and re-apply its (already-cancelled) balance effect.
    if (e.reversal_of) throw new Error('A reversal entry cannot itself be reversed')
    if (e.status !== 'posted') throw new Error('Only posted entries can be reversed')
    const lines = await query<{ account_id: number; debit: number; credit: number; memo: string | null; fx_amount: number | null; fx_currency: string | null; cost_center_id: number | null }>(
      `SELECT account_id, debit::float AS debit, credit::float AS credit, memo, fx_amount::float AS fx_amount, fx_currency, cost_center_id FROM gl_journal_lines WHERE entry_id=$1 ORDER BY line_no, id`, [entryId])
    // ERPFIX-2: the reversal mirrors the original's base amounts AND carries its
    // transaction currency/rate, foreign amounts, company and cost centers — a
    // reversal of a company-B or USD entry used to land in the default company
    // as IRR with no foreign amount.
    const mirrored = reversalLines(lines.map(l => ({ accountId: l.account_id, debit: l.debit, credit: l.credit, memo: l.memo, fxAmount: l.fx_amount, fxCurrency: l.fx_currency })))
    const rev = await insertPostedEntry(query, date, `Reversal of ${e.entry_no}`, `REV-${entryId}`, userId,
      mirrored.map((l, i) => ({ ...l, costCenterId: lines[i].cost_center_id })),
      { currency: e.currency ?? 'IRR', exchangeRate: num(e.exchange_rate) || 1, companyId: e.company_id })
    await query(`UPDATE gl_journal_entries SET reversal_of=$2 WHERE id=$1`, [rev.id, entryId])
    // 26.26b BUG-020: a reversing entry must KEEP the original posted so the two
    // balanced entries (original + reversal) net to zero on the ledger. The old
    // code also set the original to status='void', excluding it from posted-only
    // balance sums — so with the reversal still posted, every account netted to
    // −original instead of 0 (e.g. voiding a 100 payment left bank at −100). The
    // "reversed" state is carried by reversed_by (two-way link) alone; status
    // stays 'posted' (standard reversing-entry accounting, full audit trail).
    // Full-remediation RULE-006: both link updates and the reversal entry now
    // commit together — the old code could post a reversal entry, then fail to
    // link it back to the original on a crash, breaking reverseEntry's own
    // idempotency check (e.reversed_by) on a retry.
    await query(`UPDATE gl_journal_entries SET reversed_by=$2 WHERE id=$1`, [entryId, rev.id])
    return { reversalId: rev.id, alreadyReversed: false }
  }
  return outerQuery ? run(outerQuery) : withTransaction(run)
}
