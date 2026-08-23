/**
 * Revaluation data layer (Phase 26.8) — collects live FX positions, previews
 * the revaluation via the pure engine, and books the DELTA as a posted journal
 * entry. Original documents are never mutated; repeated runs only book the
 * change since the last revaluation (cumulative recognition).
 */
import { pgQuery, withTransaction } from '@/lib/db'
import { latestRates } from './currencyData'
import { revaluate, revaluationEntryLines, exposureByCurrency, REVAL_ACCOUNTS, type FxPosition } from './revaluation'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const num = (v: unknown) => Number(v ?? 0)
const FX = `NOT IN ('IRR','IRT')`

/** Live foreign-currency positions with their immutable booked rates. */
export async function fxPositions(): Promise<FxPosition[]> {
  const assets = await pgQuery<{ id: number; name: string; currency: string; purchase_price: number; exchange_rate: number }>(
    `SELECT id, name, currency, purchase_price::float AS purchase_price, exchange_rate::float AS exchange_rate
     FROM assets WHERE currency ${FX} AND purchase_price > 0 AND status <> 'retired'`)
  const ar = await pgQuery<{ id: number; doc_no: string; currency: string; open_amount: number; exchange_rate: number }>(
    `SELECT d.id, d.doc_no, d.currency, d.exchange_rate::float AS exchange_rate,
            (d.total - COALESCE((SELECT SUM(p.amount) FROM sales_payments p WHERE p.document_id = d.id), 0))::float AS open_amount
     FROM sales_documents d
     WHERE d.doc_type='invoice' AND d.status IN ('sent','confirmed','partial') AND d.deleted_at IS NULL AND d.currency ${FX}`)
  const ap = await pgQuery<{ id: number; doc_no: string | null; currency: string; open_amount: number; exchange_rate: number }>(
    `SELECT id, doc_no, currency, exchange_rate::float AS exchange_rate, (total - paid_total)::float AS open_amount
     FROM purchase_documents WHERE doc_type='invoice' AND status IN ('confirmed','partial') AND currency ${FX}`)
  return [
    ...assets.map(a => ({ key: `asset:${a.id}`, label: a.name, kind: 'asset' as const, currency: a.currency, amountForeign: num(a.purchase_price), bookedRate: num(a.exchange_rate) })),
    ...ar.filter(r => num(r.open_amount) > 0).map(r => ({ key: `ar:${r.id}`, label: `AR ${r.doc_no}`, kind: 'receivable' as const, currency: r.currency, amountForeign: num(r.open_amount), bookedRate: num(r.exchange_rate) })),
    ...ap.filter(r => num(r.open_amount) > 0).map(r => ({ key: `ap:${r.id}`, label: `AP ${r.doc_no ?? r.id}`, kind: 'payable' as const, currency: r.currency, amountForeign: num(r.open_amount), bookedRate: num(r.exchange_rate) })),
  ]
}

/** Net gain(−loss) already recognised by previous revaluation entries. */
async function alreadyBooked(): Promise<number> {
  const r = (await pgQuery<{ g: number; l: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN a.code='${REVAL_ACCOUNTS.gain}' THEN l.credit - l.debit ELSE 0 END),0)::float AS g,
       COALESCE(SUM(CASE WHEN a.code='${REVAL_ACCOUNTS.loss}' THEN l.debit - l.credit ELSE 0 END),0)::float AS l
     FROM gl_journal_lines l
     JOIN gl_journal_entries e ON e.id = l.entry_id AND e.status='posted' AND e.reference LIKE 'fx-reval%'
     JOIN gl_accounts a ON a.id = l.account_id`))[0]
  return Math.round(num(r?.g) - num(r?.l))
}

export async function previewRevaluation() {
  const rates = await latestRates()
  const result = revaluate(await fxPositions(), rates)
  const booked = await alreadyBooked()
  return {
    ...result,
    exposure: exposureByCurrency(result.positions),
    alreadyBooked: booked,
    /** What a booking run would post now. */
    deltaToBook: Math.round(result.net - booked),
    rates,
  }
}

/** Book the outstanding delta as ONE posted, balanced journal entry. */
export async function bookRevaluation(userId?: string): Promise<{ booked: boolean; entryId?: number; entryNo?: string; delta: number }> {
  const preview = await previewRevaluation()
  const lines = revaluationEntryLines(preview.deltaToBook)
  if (!lines) return { booked: false, delta: 0 }
  const codes = lines.map(l => l.accountCode)
  const accounts = await pgQuery<{ id: number; code: string }>(`SELECT id, code FROM gl_accounts WHERE code = ANY($1)`, [codes])
  const byCode = new Map(accounts.map(a => [a.code, a.id]))
  for (const c of codes) if (!byCode.has(c)) throw new Error(`GL account ${c} is missing — run migrations`)
  const total = lines.reduce((s, l) => s + l.debit, 0)
  const entryNo = `FXR-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`
  // Full-remediation RULE-001/RULE-006 (same class as sales/purchase invoice
  // GL posting): header + every line now commit as one transaction — a
  // failure mid-loop used to leave a posted, unbalanced revaluation entry.
  const entryId = await withTransaction(async query => {
    const entry = (await query<{ id: number }>(
      `INSERT INTO gl_journal_entries (entry_no, date, memo, reference, status, total, created_by, currency, exchange_rate, posted_at)
       VALUES ($1, to_char(now(),'YYYY-MM-DD'), $2, $3, 'posted', $4, $5, 'IRR', 1, ${NOW}) RETURNING id`,
      [entryNo, `Currency revaluation (${preview.deltaToBook > 0 ? 'gain' : 'loss'})`, `fx-reval:${new Date().toISOString().slice(0, 10)}`, total, userId ?? null]))[0]
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      await query(`INSERT INTO gl_journal_lines (entry_id, account_id, debit, credit, memo, line_no) VALUES ($1,$2,$3,$4,$5,$6)`,
        [entry.id, byCode.get(l.accountCode), l.debit, l.credit, l.memo, i])
    }
    return entry.id
  })
  return { booked: true, entryId, entryNo, delta: preview.deltaToBook }
}

/** History of booked revaluation entries (gain/loss report feed). */
export async function revaluationHistory(limit = 50) {
  return pgQuery(
    `SELECT e.id, e.entry_no AS "entryNo", e.date, e.memo, e.total::float AS total,
            COALESCE(SUM(CASE WHEN a.code='${REVAL_ACCOUNTS.gain}' THEN l.credit - l.debit ELSE 0 END),0)::float AS gain,
            COALESCE(SUM(CASE WHEN a.code='${REVAL_ACCOUNTS.loss}' THEN l.debit - l.credit ELSE 0 END),0)::float AS loss
     FROM gl_journal_entries e
     JOIN gl_journal_lines l ON l.entry_id = e.id
     JOIN gl_accounts a ON a.id = l.account_id
     WHERE e.reference LIKE 'fx-reval%' AND e.status='posted'
     GROUP BY e.id ORDER BY e.date DESC, e.id DESC LIMIT $1`, [limit])
}
