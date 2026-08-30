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
import { nextNumber } from '@/lib/numbering/integrate'
import { assertPostable } from './accountingData'
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

/** Pure: translate the engine's default account codes through the map. */
export function applyGlMap(lines: PostingLine[], map: GlMap): PostingLine[] {
  const translate: Record<string, string> = {
    [DEFAULT_MAP.ar]: map.ar, [DEFAULT_MAP.revenue]: map.revenue, [DEFAULT_MAP.vat]: map.vat,
    [DEFAULT_MAP.ap]: map.ap, [DEFAULT_MAP.inventory]: map.inventory, [DEFAULT_MAP.bank]: map.bank,
  }
  return lines.map(l => ({ ...l, accountCode: translate[l.accountCode] ?? l.accountCode }))
}

/** Pure: mirror an entry's lines (debit↔credit) for a reversal. */
export function reversalLines(lines: { accountId: number; debit: number; credit: number; memo?: string | null }[]): { accountId: number; debit: number; credit: number; memo: string | null }[] {
  return lines.map(l => ({ accountId: l.accountId, debit: num(l.credit), credit: num(l.debit), memo: l.memo ?? null }))
}

export async function accountIdByCode(code: string, query: TxQuery = pgQuery): Promise<number> {
  const r = (await query<{ id: number }>(`SELECT id FROM gl_accounts WHERE code=$1 LIMIT 1`, [code]))[0]
  if (!r) throw new Error(`GL account ${code} is missing from the chart`)
  return r.id
}

/**
 * Full-remediation RULE-001/RULE-006: financial posting must be atomic and
 * never leave a partial entry. This used to insert the journal header then
 * loop-insert lines with bare pgQuery — no transaction — so a failure on
 * any line insert (network blip, constraint violation) left a POSTED,
 * UNBALANCED journal entry on the books. `query` lets a caller compose
 * this insert into a larger transaction (e.g. together with the
 * gl_entry_id update on the source payment row, closing the same
 * failure mode one level up) — always inside withTransaction, header
 * and every line commit together or none do.
 *
 * Known boundary: `nextNumber` mints its own number via its own dedicated
 * transaction/advisory-lock (numbering/service.ts) BEFORE this function's
 * transaction opens — if this transaction then rolls back, that specific
 * number is never reused (burned, not duplicated). This matches the
 * numbering engine's own documented reserve/release tradeoff and is safe
 * (gaps in a sequence are acceptable; duplicates are not) — not a new gap
 * introduced here.
 */
export async function insertPostedEntry(
  query: TxQuery,
  date: string, memo: string, reference: string, total: number, userId: string | undefined,
  lines: { accountId: number; debit: number; credit: number; memo?: string | null }[],
): Promise<{ id: number; entryNo: string }> {
  const gate = await assertPostable(date)
  if (!gate.ok) throw new Error(gate.error ?? 'Fiscal period is closed for this date')
  const entryNo = await nextNumber('journal', { legacyPrefix: 'JE' })
  const e = (await query<{ id: number }>(
    `INSERT INTO gl_journal_entries (entry_no, date, memo, reference, status, total, currency, exchange_rate, created_by, period_id, created_at, posted_at)
     VALUES ($1,$2,$3,$4,'posted',$5,'IRR',1,$6,$7,${NOW},${NOW}) RETURNING id`,
    [entryNo, date, memo, reference, total, userId ?? null, gate.periodId ?? null]))[0]
  for (let i = 0; i < lines.length; i++)
    await query(`INSERT INTO gl_journal_lines (entry_id, account_id, debit, credit, memo, line_no) VALUES ($1,$2,$3,$4,$5,$6)`,
      [e.id, lines[i].accountId, num(lines[i].debit), num(lines[i].credit), lines[i].memo ?? null, i])
  return { id: e.id, entryNo }
}

/** Sales receipt → Dr Bank / Cr AR (idempotent per payment). */
export async function postSalesPaymentToGl(paymentId: number, userId?: string): Promise<{ entryId: number; alreadyPosted: boolean }> {
  const p = (await pgQuery<{ amount: number; date: string; gl_entry_id: number | null; customer: string | null }>(
    `SELECT p.amount::float AS amount, p.date, p.gl_entry_id, c.name AS customer
     FROM sales_payments p LEFT JOIN sales_customers c ON c.id=p.customer_id WHERE p.id=$1`, [paymentId]))[0]
  if (!p) throw new Error('Payment not found')
  if (p.gl_entry_id) return { entryId: p.gl_entry_id, alreadyPosted: true }
  const map = await loadGlMap()
  const [bank, ar] = await Promise.all([accountIdByCode(map.bank), accountIdByCode(map.ar)])
  const entryId = await withTransaction(async query => {
    const e = await insertPostedEntry(query, p.date, `Customer receipt${p.customer ? ` — ${p.customer}` : ''}`, `SPAY-${paymentId}`, num(p.amount), userId,
      [{ accountId: bank, debit: num(p.amount), credit: 0 }, { accountId: ar, debit: 0, credit: num(p.amount) }])
    await query(`UPDATE sales_payments SET gl_entry_id=$2 WHERE id=$1`, [paymentId, e.id])
    return e.id
  })
  return { entryId, alreadyPosted: false }
}

/**
 * Customer refund (sales-return settlement, 26.26 BUG-013) → Dr AR / Cr Bank for
 * the ABS amount (money returned to the customer brings AR back to 0). The refund
 * is stored as a NEGATIVE sales_payment so the sub-ledger `paid` drops; here we
 * post its GL. Idempotent per payment via gl_entry_id.
 */
export async function postCustomerRefundToGl(paymentId: number, userId?: string): Promise<{ entryId: number; alreadyPosted: boolean }> {
  const p = (await pgQuery<{ amount: number; date: string; gl_entry_id: number | null; customer: string | null }>(
    `SELECT p.amount::float AS amount, p.date, p.gl_entry_id, c.name AS customer
     FROM sales_payments p LEFT JOIN sales_customers c ON c.id=p.customer_id WHERE p.id=$1`, [paymentId]))[0]
  if (!p) throw new Error('Payment not found')
  if (p.gl_entry_id) return { entryId: p.gl_entry_id, alreadyPosted: true }
  const amt = Math.abs(num(p.amount))
  const map = await loadGlMap()
  const [ar, bank] = await Promise.all([accountIdByCode(map.ar), accountIdByCode(map.bank)])
  const entryId = await withTransaction(async query => {
    const e = await insertPostedEntry(query, p.date, `Customer refund${p.customer ? ` — ${p.customer}` : ''}`, `SREF-${paymentId}`, amt, userId,
      [{ accountId: ar, debit: amt, credit: 0 }, { accountId: bank, debit: 0, credit: amt }])
    await query(`UPDATE sales_payments SET gl_entry_id=$2 WHERE id=$1`, [paymentId, e.id])
    return e.id
  })
  return { entryId, alreadyPosted: false }
}

/** Purchase payment → Dr AP / Cr Bank (idempotent per payment). */
export async function postPurchasePaymentToGl(paymentId: number, userId?: string): Promise<{ entryId: number; alreadyPosted: boolean }> {
  const p = (await pgQuery<{ amount: number; date: string; gl_entry_id: number | null; vendor: string | null }>(
    `SELECT p.amount::float AS amount, p.date, p.gl_entry_id, v.name AS vendor
     FROM purchase_payments p LEFT JOIN purchase_vendors v ON v.id=p.vendor_id WHERE p.id=$1`, [paymentId]))[0]
  if (!p) throw new Error('Payment not found')
  if (p.gl_entry_id) return { entryId: p.gl_entry_id, alreadyPosted: true }
  const map = await loadGlMap()
  const [ap, bank] = await Promise.all([accountIdByCode(map.ap), accountIdByCode(map.bank)])
  const entryId = await withTransaction(async query => {
    const e = await insertPostedEntry(query, p.date, `Supplier payment${p.vendor ? ` — ${p.vendor}` : ''}`, `PPAY-${paymentId}`, num(p.amount), userId,
      [{ accountId: ap, debit: num(p.amount), credit: 0 }, { accountId: bank, debit: 0, credit: num(p.amount) }])
    await query(`UPDATE purchase_payments SET gl_entry_id=$2 WHERE id=$1`, [paymentId, e.id])
    return e.id
  })
  return { entryId, alreadyPosted: false }
}

/** Shared posting path (journal route + approval hook): balance + period gate → posted. */
export async function postEntryById(id: number): Promise<{ ok: boolean; error?: string }> {
  const e = (await pgQuery<{ status: string; date: string }>(`SELECT status, date FROM gl_journal_entries WHERE id=$1`, [id]))[0]
  if (!e) return { ok: false, error: 'Not found' }
  if (e.status !== 'draft') return { ok: false, error: 'Only draft entries can be posted' }
  const lines = await pgQuery<{ debit: number; credit: number }>(
    `SELECT debit::float AS debit, credit::float AS credit FROM gl_journal_lines WHERE entry_id=$1`, [id])
  const dr = lines.reduce((s, l) => s + num(l.debit), 0), cr = lines.reduce((s, l) => s + num(l.credit), 0)
  if (lines.length < 2 || Math.abs(dr - cr) > 0.001) return { ok: false, error: 'Entry is not balanced' }
  const gate = await assertPostable(e.date)
  if (!gate.ok) return { ok: false, error: gate.error }
  await pgQuery(`UPDATE gl_journal_entries SET status='posted', posted_at=${NOW}, period_id=COALESCE(period_id,$2) WHERE id=$1`, [id, gate.periodId ?? null])
  return { ok: true }
}

/**
 * Reverse a posted entry: books a posted mirror entry dated `asOf` (default:
 * today), marks the source void and links both directions. Idempotent — an
 * already-reversed entry returns the existing reversal.
 */
export async function reverseEntry(entryId: number, userId?: string, asOf?: string): Promise<{ reversalId: number; alreadyReversed: boolean }> {
  const e = (await pgQuery<{ status: string; entry_no: string; total: number; reversed_by: number | null; reversal_of: number | null }>(
    `SELECT status, entry_no, total::float AS total, reversed_by, reversal_of FROM gl_journal_entries WHERE id=$1`, [entryId]))[0]
  if (!e) throw new Error('Entry not found')
  if (e.reversed_by) return { reversalId: e.reversed_by, alreadyReversed: true }
  // 26.26c بند ۱.۲: a reversal entry can never itself be reversed — that would
  // un-reverse the original and re-apply its (already-cancelled) balance effect.
  if (e.reversal_of) throw new Error('A reversal entry cannot itself be reversed')
  if (e.status !== 'posted') throw new Error('Only posted entries can be reversed')
  const lines = await pgQuery<{ account_id: number; debit: number; credit: number; memo: string | null }>(
    `SELECT account_id, debit::float AS debit, credit::float AS credit, memo FROM gl_journal_lines WHERE entry_id=$1 ORDER BY line_no, id`, [entryId])
  const date = asOf ?? new Date().toISOString().slice(0, 10)
  const revId = await withTransaction(async query => {
    const rev = await insertPostedEntry(query, date, `Reversal of ${e.entry_no}`, `REV-${entryId}`, num(e.total), userId,
      reversalLines(lines.map(l => ({ accountId: l.account_id, debit: l.debit, credit: l.credit, memo: l.memo }))))
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
    return rev.id
  })
  return { reversalId: revId, alreadyReversed: false }
}
