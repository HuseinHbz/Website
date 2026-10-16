/**
 * ERPFIX-2 (BUG-ERP-03) — survey + remediation of journal entries posted
 * BEFORE the base-currency fix (lines in the transaction currency, header
 * rate ≠ 1, no fx_amount). Shared by deploy/erp-fx-survey.ts (read-only),
 * deploy/erp-fx-remediate.ts (dry-run by default) and the regression suite.
 *
 * Method (maintainer decision, ERPFIX-2 gate): for each legacy entry in an
 * OPEN period — a reversal of the original (kept posted, BUG-020) PLUS a
 * re-post in base currency, both in ONE transaction through the GL core,
 * and the source row's gl_entry_id re-pointed at the re-post (so a later
 * void reverses the right entry). Closed/locked periods: report only.
 * Sales/purchase invoices, credit notes, customer refunds and direct
 * payments are restated automatically; anything else (Treasury, manual
 * journals, imports) is REPORTED for the accountant — its sub-ledger
 * lineage cannot be re-pointed safely by a script.
 */
import { pgQuery, withTransaction, type TxQuery } from '@/lib/db'
import { insertPostedEntry, reverseEntry, planSettlement, basePrecision, loadGlMap, accountIdsByCodes } from './glPosting'
import { linesToBase } from './money'
import { listPeriods } from './accountingData'
import { periodForDate } from './accountingCore'

export const FX_REMEDIATION_KIND = 'fx-restate'
const num = (v: unknown) => Number(v ?? 0)

export interface LegacyFxEntry {
  entryId: number; entryNo: string; date: string; reference: string | null; currency: string; rate: number
  total: number; companyId: number | null; kind: 'sales_invoice' | 'purchase_invoice' | 'sales_payment' | 'customer_refund' | 'purchase_payment' | 'other'
  sourceId: number | null; periodName: string | null; periodStatus: string | null; action: 'restate' | 'report_only'; reason?: string
}

function classify(reference: string | null): { kind: LegacyFxEntry['kind']; sourceId: number | null } {
  const m = /^(SAL|PUR|SPAY|SREF|PPAY)-(\d+)$/.exec(reference ?? '')
  if (!m) return { kind: 'other', sourceId: null }
  const kind = ({ SAL: 'sales_invoice', PUR: 'purchase_invoice', SPAY: 'sales_payment', SREF: 'customer_refund', PPAY: 'purchase_payment' } as const)[m[1] as 'SAL']
  return { kind, sourceId: Number(m[2]) }
}

/** Posted, un-reversed entries with a non-IRR header, rate ≠ 1 and no fx_amount on any line. */
export async function legacyFxEntries(): Promise<LegacyFxEntry[]> {
  // Works on a copy that has not booted the ERPFIX-1/2 migrations yet (no
  // fx_amount column / links table → every foreign entry is legacy).
  const migrated = (await pgQuery<{ ok: boolean }>(
    `SELECT (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gl_journal_lines' AND column_name='fx_amount')
             AND to_regclass('public.gl_remediation_links') IS NOT NULL) AS ok`))[0]?.ok
  const notDone = migrated
    ? `AND NOT EXISTS (SELECT 1 FROM gl_journal_lines l WHERE l.entry_id=e.id AND l.fx_amount IS NOT NULL)
       AND NOT EXISTS (SELECT 1 FROM gl_remediation_links r WHERE r.source_entry_id=e.id AND r.kind=$1)`
    : `AND $1::text IS NOT NULL`
  // Two shapes of legacy entry: (a) the header names the foreign currency and
  // rate (invoice posters); (b) payment posters wrote an IRR / rate-1 header
  // over raw foreign lines — detectable only through the payment row itself.
  const rows = await pgQuery<{ id: number; entry_no: string; date: string; reference: string | null; currency: string; exchange_rate: number; total: number; company_id: number | null }>(
    `SELECT * FROM (
       SELECT e.id, e.entry_no, e.date, e.reference, e.currency, e.exchange_rate::float AS exchange_rate, e.total::float AS total, e.company_id
       FROM gl_journal_entries e
       WHERE COALESCE(e.currency,'IRR') <> 'IRR' AND COALESCE(e.exchange_rate,1) <> 1
       UNION
       SELECT e.id, e.entry_no, e.date, e.reference, p.currency, p.exchange_rate::float, e.total::float, e.company_id
       FROM gl_journal_entries e JOIN sales_payments p ON e.reference IN ('SPAY-'||p.id, 'SREF-'||p.id)
       WHERE COALESCE(e.currency,'IRR') = 'IRR' AND COALESCE(p.currency,'IRR') <> 'IRR' AND COALESCE(p.exchange_rate,1) <> 1
       UNION
       SELECT e.id, e.entry_no, e.date, e.reference, p.currency, p.exchange_rate::float, e.total::float, e.company_id
       FROM gl_journal_entries e JOIN purchase_payments p ON e.reference = 'PPAY-'||p.id
       WHERE COALESCE(e.currency,'IRR') = 'IRR' AND COALESCE(p.currency,'IRR') <> 'IRR' AND COALESCE(p.exchange_rate,1) <> 1
       UNION
       SELECT e.id, e.entry_no, e.date, e.reference, o.currency, 0::float, e.total::float, e.company_id
       FROM gl_journal_entries e JOIN payment_orders o ON e.reference = 'TRZPAY-'||o.id
       WHERE COALESCE(e.currency,'IRR') = 'IRR' AND COALESCE(o.currency,'IRR') <> 'IRR'
     ) e
     WHERE EXISTS (SELECT 1 FROM gl_journal_entries x WHERE x.id=e.id AND x.status='posted' AND x.reversed_by IS NULL AND x.reversal_of IS NULL)
       ${notDone}
     ORDER BY e.date, e.id`, [FX_REMEDIATION_KIND])
  const periods = await listPeriods()
  return rows.map(r => {
    const { kind, sourceId } = classify(r.reference)
    const p = periodForDate(r.date, periods)
    const open = !p || p.status === 'open'
    const action: LegacyFxEntry['action'] = open && kind !== 'other' && num(r.exchange_rate) > 0 ? 'restate' : 'report_only'
    return {
      entryId: r.id, entryNo: r.entry_no, date: r.date, reference: r.reference, currency: r.currency, rate: num(r.exchange_rate),
      total: num(r.total), companyId: r.company_id, kind, sourceId, periodName: p?.name ?? null, periodStatus: p?.status ?? null, action,
      reason: !open ? `period ${p?.name} is ${p?.status}` : kind === 'other' ? 'not a document/payment posting — the accountant restates it' : undefined,
    }
  })
}

export interface FxSurvey {
  documents: { table: string; currency: string; count: number; total: number; base: number }[]
  invalidDocs: { table: string; id: number; docNo: string | null; currency: string; total: number; exchangeRate: number; baseTotal: number }[]
  legacyEntries: LegacyFxEntry[]
  distortion: { code: string; nameEn: string; rawNet: number; baseNet: number; distortion: number }[]
}

/** Read-only census of foreign-currency data and the distortion legacy entries put on each account. */
export async function fxSurvey(): Promise<FxSurvey> {
  const documents = await pgQuery<{ table: string; currency: string; count: number; total: number; base: number }>(
    `SELECT 'sales_documents' AS "table", COALESCE(currency,'IRR') AS currency, COUNT(*)::int AS count, COALESCE(SUM(total),0)::float AS total, COALESCE(SUM(total*exchange_rate),0)::float AS base
       FROM sales_documents WHERE COALESCE(currency,'IRR') <> 'IRR' GROUP BY 2
     UNION ALL
     SELECT 'purchase_documents', COALESCE(currency,'IRR'), COUNT(*)::int, COALESCE(SUM(total),0)::float, COALESCE(SUM(total*exchange_rate),0)::float
       FROM purchase_documents WHERE COALESCE(currency,'IRR') <> 'IRR' GROUP BY 2
     UNION ALL
     SELECT 'sales_payments', COALESCE(currency,'IRR'), COUNT(*)::int, COALESCE(SUM(amount),0)::float, COALESCE(SUM(amount*exchange_rate),0)::float
       FROM sales_payments WHERE COALESCE(currency,'IRR') <> 'IRR' GROUP BY 2
     UNION ALL
     SELECT 'purchase_payments', COALESCE(currency,'IRR'), COUNT(*)::int, COALESCE(SUM(amount),0)::float, COALESCE(SUM(amount*exchange_rate),0)::float
       FROM purchase_payments WHERE COALESCE(currency,'IRR') <> 'IRR' GROUP BY 2
     UNION ALL
     SELECT 'payment_orders', COALESCE(currency,'IRR'), COUNT(*)::int, COALESCE(SUM(amount),0)::float, 0::float
       FROM payment_orders WHERE COALESCE(currency,'IRR') <> 'IRR' GROUP BY 2
     UNION ALL
     SELECT 'gl_journal_entries', COALESCE(currency,'IRR'), COUNT(*)::int, COALESCE(SUM(total),0)::float, 0::float
       FROM gl_journal_entries WHERE status='posted' AND COALESCE(currency,'IRR') <> 'IRR' GROUP BY 2
     ORDER BY 1, 2`)
  // Stop condition (ERPFIX-2): a zero base_total or a zero/negative rate is LISTED, never auto-fixed.
  const invalidDocs = await pgQuery<{ table: string; id: number; docNo: string | null; currency: string; total: number; exchangeRate: number; baseTotal: number }>(
    `SELECT 'sales_documents' AS "table", id, doc_no AS "docNo", COALESCE(currency,'IRR') AS currency, total::float AS total, exchange_rate::float AS "exchangeRate", base_total::float AS "baseTotal"
       FROM sales_documents WHERE total <> 0 AND (base_total = 0 OR COALESCE(exchange_rate,0) <= 0)
     UNION ALL
     SELECT 'purchase_documents', id, doc_no, COALESCE(currency,'IRR'), total::float, exchange_rate::float, base_total::float
       FROM purchase_documents WHERE total <> 0 AND (base_total = 0 OR COALESCE(exchange_rate,0) <= 0)
     ORDER BY 1, 2 LIMIT 500`)
  const legacyEntries = await legacyFxEntries()
  // Distortion = what each account would hold at the entry's EFFECTIVE rate
  // (header rate, or the payment row's rate for payment-shaped legacy entries)
  // minus what it holds now (the raw foreign amounts).
  const rateOf = new Map(legacyEntries.map(e => [e.entryId, e.rate]))
  const lines = rateOf.size ? await pgQuery<{ entry_id: number; code: string; nameEn: string; net: number }>(
    `SELECT l.entry_id, a.code, a.name_en AS "nameEn", (l.debit - l.credit)::float AS net
     FROM gl_journal_lines l JOIN gl_accounts a ON a.id=l.account_id WHERE l.entry_id = ANY($1)`, [[...rateOf.keys()]]) : []
  const acc = new Map<string, { code: string; nameEn: string; rawNet: number; baseNet: number }>()
  for (const l of lines) {
    const a = acc.get(l.code) ?? { code: l.code, nameEn: l.nameEn, rawNet: 0, baseNet: 0 }
    a.rawNet += num(l.net); a.baseNet += num(l.net) * (rateOf.get(l.entry_id) || 1)
    acc.set(l.code, a)
  }
  const distortion = [...acc.values()].sort((x, y) => x.code.localeCompare(y.code))
    .map(a => ({ ...a, rawNet: Math.round(a.rawNet * 100) / 100, baseNet: Math.round(a.baseNet * 100) / 100, distortion: Math.round((a.baseNet - a.rawNet) * 100) / 100 }))
  return { documents, invalidDocs, legacyEntries, distortion }
}

async function restatedLines(query: TxQuery, e: LegacyFxEntry, precision: number) {
  if (e.kind === 'sales_payment' || e.kind === 'purchase_payment') {
    const plan = await planSettlement(query, e.kind === 'sales_payment' ? 'receivable' : 'payable', e.sourceId!)
    if (!plan) throw new Error(`Payment ${e.sourceId} not found`)
    return plan.lines
  }
  const map = await loadGlMap()
  const raw = await query<{ code: string; debit: number; credit: number; memo: string | null }>(
    `SELECT a.code, l.debit::float AS debit, l.credit::float AS credit, l.memo
     FROM gl_journal_lines l JOIN gl_accounts a ON a.id=l.account_id WHERE l.entry_id=$1 ORDER BY l.line_no, l.id`, [e.entryId])
  const control = e.kind === 'purchase_invoice' ? map.ap : e.kind === 'customer_refund' ? map.bank : map.ar
  return linesToBase(raw.map(r => ({ accountCode: r.code, debit: r.debit, credit: r.credit, memo: r.memo })), e.rate, e.currency, control, precision)
}

/** Dry run unless `apply`; restates every 'restate' entry, idempotently. */
export async function remediateFx(opts: { apply: boolean; userId?: string | null }): Promise<{ entries: LegacyFxEntry[]; restated: { entryId: number; reversalId: number; newEntryId: number; newEntryNo: string }[] }> {
  const entries = await legacyFxEntries()
  const restated: { entryId: number; reversalId: number; newEntryId: number; newEntryNo: string }[] = []
  if (!opts.apply) return { entries, restated }
  const precision = await basePrecision()
  for (const e of entries) {
    if (e.action !== 'restate') continue
    const r = await withTransaction(async query => {
      await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`fx-restate:${e.entryId}`])
      const done = (await query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM gl_remediation_links WHERE source_entry_id=$1 AND kind=$2`, [e.entryId, FX_REMEDIATION_KIND]))[0]
      if (done?.n) return null
      const lines = await restatedLines(query, e, precision)
      const rev = await reverseEntry(e.entryId, opts.userId ?? undefined, e.date, query)
      const ids = await accountIdsByCodes(lines.map(l => l.accountCode), query)
      const neu = await insertPostedEntry(query, e.date, `Base-currency restatement of ${e.entryNo} (ERPFIX-2)`, e.reference ?? `FX-RESTATE-${e.entryId}`, opts.userId ?? null,
        lines.map(l => ({ accountId: ids.get(l.accountCode)!, debit: l.debit, credit: l.credit, memo: l.memo ?? null, fxAmount: l.fxAmount, fxCurrency: l.fxCurrency })),
        { currency: e.currency, exchangeRate: e.rate, companyId: e.companyId })
      // Re-point the source row so a later void/reversal targets the restated entry.
      const relink = {
        sales_invoice: `UPDATE sales_documents SET gl_entry_id=$2 WHERE id=$1 AND gl_entry_id=$3`,
        purchase_invoice: `UPDATE purchase_documents SET gl_entry_id=$2 WHERE id=$1 AND gl_entry_id=$3`,
        sales_payment: `UPDATE sales_payments SET gl_entry_id=$2 WHERE id=$1 AND gl_entry_id=$3`,
        customer_refund: `UPDATE sales_payments SET gl_entry_id=$2 WHERE id=$1 AND gl_entry_id=$3`,
        purchase_payment: `UPDATE purchase_payments SET gl_entry_id=$2 WHERE id=$1 AND gl_entry_id=$3`,
      } as const
      await query(relink[e.kind as keyof typeof relink], [e.sourceId, neu.id, e.entryId])
      await query(`INSERT INTO gl_remediation_links (source_entry_id, remediation_entry_id, kind, company_id) VALUES ($1,$2,$3,$4)`, [e.entryId, neu.id, FX_REMEDIATION_KIND, e.companyId])
      return { entryId: e.entryId, reversalId: rev.reversalId, newEntryId: neu.id, newEntryNo: neu.entryNo }
    })
    if (r) restated.push(r)
  }
  return { entries, restated }
}
