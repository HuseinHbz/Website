/**
 * Purchasing data layer (Phase 26.1) — PostgreSQL access for procure-to-pay.
 * Pure logic lives in `purchasing.ts`; totals/approval/scoring come from there.
 */
import { pgQuery, withTransaction, type TxQuery } from '@/lib/db'
import { nextNumber } from '@/lib/numbering/integrate'
import { rialRateFor } from './currencyData'
import { assertPostable } from './accountingData'
import { loadGlMap, applyGlMap, postPurchasePaymentToGl, reverseEntry } from './glPosting'
import {
  documentTotals, requiredApprovalLevels, isFullyApproved, vendorScore, vendorPayable,
  purchaseInvoiceStatus, purchaseKpis, validateBudget, type LineInput, type PurchaseDocType, type PurchaseStatus,
} from './purchasing'
import { validatePayment } from './sales'
import { matchLine, overallMatchStatus, type MatchStatus } from './threeWayMatch'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const num = (v: unknown) => Number(v ?? 0)

export interface VendorInput {
  code?: string; name: string; kind?: string; email?: string; phone?: string
  taxId?: string; economicCode?: string; address?: string; iban?: string
  currency?: string; paymentTerms?: number
}
export interface LineRow extends LineInput {
  description: string; productId?: number | null
  /** Three-way match lineage (Phase 5) — which PO/receipt line this line was
   * converted from, set by convertDocument. Undefined for a hand-entered or
   * standalone document. */
  poLineId?: number | null; receiptLineId?: number | null
}

// ── Vendors ──────────────────────────────────────────────────────────────────
export async function listVendors() {
  return pgQuery(`SELECT id, code, name, kind, email, phone, tax_id AS "taxId", currency,
    payment_terms AS "paymentTerms", score, grade, active FROM purchase_vendors ORDER BY name`)
}
export async function createVendor(v: VendorInput, userId?: string): Promise<number> {
  const code = v.code || await nextNumber('vendor', { legacyPrefix: 'VEN' })
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO purchase_vendors (code,name,kind,email,phone,tax_id,economic_code,address,iban,currency,payment_terms,created_by,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,${NOW},${NOW}) RETURNING id`,
    [code, v.name, v.kind ?? 'company', v.email ?? null, v.phone ?? null, v.taxId ?? null, v.economicCode ?? null,
     v.address ?? null, v.iban ?? null, v.currency ?? 'IRR', v.paymentTerms ?? 0, userId ?? null]))[0]
  return row.id
}
export async function updateVendor(id: number, v: Partial<VendorInput>) {
  await pgQuery(
    `UPDATE purchase_vendors SET name=COALESCE($2,name), email=$3, phone=$4, tax_id=$5, address=$6,
       iban=$7, currency=COALESCE($8,currency), payment_terms=COALESCE($9,payment_terms), updated_at=${NOW} WHERE id=$1`,
    [id, v.name ?? null, v.email ?? null, v.phone ?? null, v.taxId ?? null, v.address ?? null, v.iban ?? null, v.currency ?? null, v.paymentTerms ?? null])
}

/** Record an evaluation and roll the vendor's headline score/grade. */
export async function evaluateVendor(vendorId: number, scores: { quality: number; delivery: number; price: number; service: number; compliance: number }, note?: string, evaluatorId?: string) {
  const s = vendorScore(scores)
  await pgQuery(
    `INSERT INTO vendor_evaluations (vendor_id,quality,delivery,price,service,compliance,score,grade,note,evaluator_id,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,${NOW})`,
    [vendorId, scores.quality, scores.delivery, scores.price, scores.service, scores.compliance, s.score, s.grade, note ?? null, evaluatorId ?? null])
  await pgQuery(`UPDATE purchase_vendors SET score=$2, grade=$3, updated_at=${NOW} WHERE id=$1`, [vendorId, s.score, s.grade])
  return s
}

/**
 * 26.32 بند۴ — `vendor_evaluations` was WRITE-ONLY: every 5-criteria review the
 * buyer filled in was stored and then unreachable, so only the latest rolled-up
 * score survived and the trend behind a vendor's grade was invisible. This is
 * the read path that makes the history a real feature.
 */
export async function vendorEvaluationHistory(vendorId: number) {
  return await pgQuery<{
    id: number; quality: number; delivery: number; price: number; service: number
    compliance: number; score: number; grade: string; note: string | null
    evaluatorName: string | null; createdAt: string
  }>(
    `SELECT e.id, e.quality, e.delivery, e.price, e.service, e.compliance,
            e.score, e.grade, e.note, u.name AS "evaluatorName", e.created_at AS "createdAt"
     FROM vendor_evaluations e LEFT JOIN users u ON u.id = e.evaluator_id
     WHERE e.vendor_id = $1 ORDER BY e.created_at DESC LIMIT 50`, [vendorId])
}

export async function vendorPosition(vendorId: number) {
  const inv = num((await pgQuery<{ t: number }>(`SELECT COALESCE(SUM(total*exchange_rate),0) AS t FROM purchase_documents WHERE vendor_id=$1 AND doc_type='invoice' AND status NOT IN ('void','draft')`, [vendorId]))[0]?.t)
  const paid = num((await pgQuery<{ t: number }>(`SELECT COALESCE(SUM(amount*exchange_rate),0) AS t FROM purchase_payments WHERE vendor_id=$1`, [vendorId]))[0]?.t)
  const cn = num((await pgQuery<{ t: number }>(`SELECT COALESCE(SUM(total*exchange_rate),0) AS t FROM purchase_documents WHERE vendor_id=$1 AND doc_type='credit_note' AND status NOT IN ('void','draft')`, [vendorId]))[0]?.t)
  return vendorPayable({ invoicedTotal: inv, paidTotal: paid, creditNotesTotal: cn })
}

// ── Documents ────────────────────────────────────────────────────────────────
interface DocRow { id: number; doc_no: string | null; doc_type: string; vendor_id: number | null; status: string; date: string; total: number; paid_total: number; approval_levels: number; budget: number; gl_entry_id: number | null; priority: string }
export async function listDocuments(docType?: PurchaseDocType) {
  const rows = await pgQuery<DocRow & { vendor_name: string | null }>(
    `SELECT d.*, v.name AS vendor_name FROM purchase_documents d LEFT JOIN purchase_vendors v ON v.id=d.vendor_id
     ${docType ? 'WHERE d.doc_type=$1' : ''} ORDER BY d.created_at DESC`, docType ? [docType] : [])
  return rows.map(r => ({ id: r.id, docNo: r.doc_no, docType: r.doc_type, vendorId: r.vendor_id, vendorName: r.vendor_name, status: r.status, date: r.date, total: num(r.total), paidTotal: num(r.paid_total), approvalLevels: r.approval_levels, budget: num(r.budget), glEntryId: r.gl_entry_id, priority: r.priority }))
}
export async function getDocument(id: number) {
  const d = (await pgQuery<DocRow>(`SELECT * FROM purchase_documents WHERE id=$1`, [id]))[0]
  if (!d) return null
  const lines = await pgQuery(`SELECT id, description, qty::float AS qty, unit_price::float AS "unitPrice", discount_pct::float AS "discountPct", tax_pct::float AS "taxPct", product_id AS "productId", received_qty::float AS "receivedQty",
    po_line_id AS "poLineId", receipt_line_id AS "receiptLineId", match_status AS "matchStatus" FROM purchase_document_lines WHERE document_id=$1 ORDER BY sort_order, id`, [id])
  const approvals = await pgQuery(`SELECT level, decision, approver_id AS "approverId", comment, created_at AS "createdAt" FROM purchase_approvals WHERE document_id=$1 ORDER BY created_at`, [id])
  return { ...d, lines, approvals }
}

/**
 * Phase-4 procurement audit finding: header write (UPDATE or INSERT) +
 * DELETE-old-lines + loop-INSERT-new-lines ran as separate bare pgQuery
 * calls, no transaction — a mid-sequence failure could leave a document
 * with missing/mismatched lines, the identical class already fixed on
 * the sales-document and journal-entry create/update paths. Fixed: the
 * whole header+lines sequence now commits as one transaction.
 */
export async function saveDocument(input: {
  id?: number; docType: PurchaseDocType; vendorId?: number; date: string; currency?: string
  department?: string; budget?: number; sourceId?: number; note?: string; priority?: string; lines: LineRow[]
}, userId?: string): Promise<number> {
  const totals = documentTotals(input.lines)
  const rate = (await rialRateFor(input.currency ?? 'IRR')) ?? 1
  const baseTotal = Math.round(totals.total * rate * 100) / 100
  return withTransaction(async query => {
    if (input.id) {
      await query(
        `UPDATE purchase_documents SET vendor_id=$2, date=$3, currency=COALESCE($4,currency), department=$5, budget=$6,
          note=$7, subtotal=$8, discount_total=$9, tax_total=$10, total=$11, priority=COALESCE($12,priority), exchange_rate=$13, base_total=$14, updated_at=${NOW} WHERE id=$1`,
        [input.id, input.vendorId ?? null, input.date, input.currency ?? null, input.department ?? null, input.budget ?? 0,
         input.note ?? null, totals.subtotal, totals.discountTotal, totals.taxTotal, totals.total, input.priority ?? null, rate, baseTotal])
      await query(`DELETE FROM purchase_document_lines WHERE document_id=$1`, [input.id])
      await insertLines(query, input.id, input.lines)
      return input.id
    }
    const docNo = await nextNumber(`purchase_${input.docType}`, { legacyPrefix: input.docType.toUpperCase().slice(0, 3) })
    const row = (await query<{ id: number }>(
      `INSERT INTO purchase_documents (doc_no,doc_type,vendor_id,date,currency,department,budget,source_id,note,subtotal,discount_total,tax_total,total,priority,created_by,exchange_rate,base_total,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,${NOW},${NOW}) RETURNING id`,
      [docNo, input.docType, input.vendorId ?? null, input.date, input.currency ?? 'IRR', input.department ?? null, input.budget ?? 0,
       input.sourceId ?? null, input.note ?? null, totals.subtotal, totals.discountTotal, totals.taxTotal, totals.total, input.priority ?? 'normal', userId ?? null, rate, baseTotal]))[0]
    await insertLines(query, row.id, input.lines)
    return row.id
  })
}
async function insertLines(query: TxQuery, docId: number, lines: LineRow[]) {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    await query(`INSERT INTO purchase_document_lines (document_id,description,qty,unit_price,discount_pct,tax_pct,sort_order,product_id,po_line_id,receipt_line_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [docId, l.description, l.qty, l.unitPrice, l.discountPct, l.taxPct, i, l.productId ?? null, l.poLineId ?? null, l.receiptLineId ?? null])
  }
}

/**
 * Submit a document for approval. Runs the BUDGET CHECK first: when the doc
 * carries a budget envelope, the department's committed spend this year plus
 * this request must fit inside it — over-budget submits are blocked with the
 * exact numbers. Then computes the required approval levels.
 */
export async function submitDocument(id: number): Promise<{ ok: boolean; error?: string; budget?: ReturnType<typeof validateBudget> }> {
  const d = (await pgQuery<{ total: number; budget: number; department: string | null; date: string }>(
    `SELECT total, budget, department, date FROM purchase_documents WHERE id=$1`, [id]))[0]
  if (!d) return { ok: false, error: 'Document not found' }
  if (num(d.budget) > 0) {
    const year = String(d.date ?? '').slice(0, 4) || String(new Date().getFullYear())
    const committed = d.department
      ? num((await pgQuery<{ t: number }>(
          `SELECT COALESCE(SUM(total),0) AS t FROM purchase_documents
           WHERE id<>$1 AND department=$2 AND date LIKE $3 AND status NOT IN ('draft','void','rejected')`,
          [id, d.department, `${year}%`]))[0]?.t)
      : 0
    const budget = validateBudget({ budget: num(d.budget), committed, requested: num(d.total) })
    if (!budget.withinBudget)
      return { ok: false, budget, error: `Over budget: available ${budget.available.toLocaleString()}, requested ${num(d.total).toLocaleString()}` }
  }
  const levels = requiredApprovalLevels(num(d.total))
  await pgQuery(`UPDATE purchase_documents SET status='submitted', approval_levels=$2, updated_at=${NOW} WHERE id=$1`, [id, levels])
  return { ok: true }
}

/**
 * GRN → warehouse update (Phase 26 completion). Receives quantities on a
 * receipt document: writes real `inv_moves` receipt rows for every line linked
 * to a product (at the line's unit price as cost), tracks `received_qty`, and
 * sets the document to `received` (all product lines complete) or `partial`.
 * Lines without a product (services) are ignored by receiving.
 */
/**
 * Phase-4 procurement audit finding: this ran as bare, unlocked pgQuery calls
 * (doc lookup → per-line read-remaining-then-insert-move-then-update-received
 * loop → status recompute) with no transaction — two genuinely concurrent
 * receipts on the same PO line could both read the same `received_qty`,
 * both compute the same `remaining`, and together over-receive past the
 * ordered quantity (the identical TOCTOU class fixed on sales payments and
 * purchase-invoice payments). Fixed: the whole read-decide-write sequence
 * now runs inside one transaction, serialized per document via
 * pg_advisory_xact_lock, so a second concurrent receipt sees the first
 * receipt's committed received_qty before deciding how much it can take.
 */
export async function receiveDocument(
  docId: number, warehouseId: number,
  linesIn?: { lineId: number; qty: number }[], userId?: string,
): Promise<{ ok: boolean; error?: string; received: number; status?: string }> {
  return withTransaction(async query => {
    await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`purchase_receive:${docId}`])
    const doc = (await query<{ doc_type: string; status: string; doc_no: string | null; exchange_rate: number }>(
      `SELECT doc_type, status, doc_no, exchange_rate::float AS exchange_rate FROM purchase_documents WHERE id=$1`, [docId]))[0]
    if (!doc) return { ok: false, error: 'Document not found', received: 0 }
    if (doc.doc_type !== 'receipt') return { ok: false, error: 'Only goods-receipt (GRN) documents can be received', received: 0 }
    if (['void', 'rejected'].includes(doc.status)) return { ok: false, error: 'Document is not receivable', received: 0 }
    const lines = await query<{ id: number; qty: number; unit_price: number; product_id: number | null; received_qty: number }>(
      `SELECT id, qty::float AS qty, unit_price::float AS unit_price, product_id, received_qty::float AS received_qty
       FROM purchase_document_lines WHERE document_id=$1 ORDER BY sort_order, id`, [docId])
    const wanted = new Map((linesIn ?? []).map(l => [l.lineId, Math.max(0, l.qty)]))
    let received = 0
    for (const l of lines) {
      if (!l.product_id) continue
      const remaining = Math.max(0, num(l.qty) - num(l.received_qty))
      const take = Math.min(remaining, linesIn ? (wanted.get(l.id) ?? 0) : remaining)
      if (take <= 0) continue
      await query(
        `INSERT INTO inv_moves (product_id, warehouse_id, type, qty, unit_cost, ref, created_by, created_at)
         VALUES ($1,$2,'receipt',$3,$4,$5,$6,${NOW})`,
        // 26.8: stock ledger costs are kept in the Rial base (line price × the
        // document's registration rate) so FIFO/LIFO/WAVG valuation is uniform.
        [l.product_id, warehouseId, take, num(l.unit_price) * (num(doc.exchange_rate) || 1), `GRN ${doc.doc_no ?? docId}`, userId ?? null])
      await query(`UPDATE purchase_document_lines SET received_qty = received_qty + $2 WHERE id=$1`, [l.id, take])
      received++
    }
    const after = await query<{ qty: number; received_qty: number; product_id: number | null }>(
      `SELECT qty::float AS qty, received_qty::float AS received_qty, product_id FROM purchase_document_lines WHERE document_id=$1`, [docId])
    const productLines = after.filter(l => l.product_id)
    const complete = productLines.length === 0 || productLines.every(l => num(l.received_qty) + 0.0001 >= num(l.qty))
    const status = complete ? 'received' : 'partial'
    await query(`UPDATE purchase_documents SET status=$2, updated_at=${NOW} WHERE id=$1`, [docId, status])
    return { ok: true, received, status }
  })
}

/** RFQ quotation comparison: every vendor quotation linked to the RFQ, side by
 * side with vendor rating — the comparison feed for award decisions. */
export async function compareQuotes(rfqId: number) {
  return pgQuery(
    `SELECT d.id, d.doc_no AS "docNo", d.date, d.total::float AS total, d.status,
            v.name AS vendor, v.score::float AS score, v.grade,
            (SELECT COUNT(*)::int FROM purchase_document_lines pl WHERE pl.document_id=d.id) AS lines
     FROM purchase_documents d LEFT JOIN purchase_vendors v ON v.id=d.vendor_id
     WHERE d.doc_type='quotation' AND d.source_id=$1 AND d.status NOT IN ('void')
     ORDER BY d.total ASC`, [rfqId])
}

/**
 * Record an approval decision; advance to 'approved' once every level signs.
 *
 * Phase-4 procurement audit finding: `purchase_approvals` is a genuinely
 * separate approval mechanism from the shared `lib/approval/*` engine (its
 * own table, its own tier math) — migrating it onto the shared engine would
 * be a new architectural feature well beyond this phase's scope, so per the
 * instruction not to create a SECOND approval system, this hardens the
 * existing one in place instead: (1) maker/checker — the document's creator
 * may not approve/reject their own request, matching the separation-of-
 * duties rule already enforced on the shared engine; (2) the whole insert-
 * decide-advance sequence now runs in one transaction serialized per
 * document via pg_advisory_xact_lock, closing the same class of TOCTOU that
 * let two concurrent decisions both read a stale set of approved levels;
 * (3) a duplicate decision from the same approver at the same level is
 * rejected instead of inserting a second row.
 */
export async function decideApproval(id: number, level: number, decision: 'approved' | 'rejected', approverId?: string, comment?: string): Promise<{ ok: boolean; error?: string; status?: PurchaseStatus }> {
  return withTransaction(async query => {
    await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`purchase_approval:${id}`])
    const d = (await query<{ total: number; created_by: string | null; status: string }>(`SELECT total, created_by, status FROM purchase_documents WHERE id=$1`, [id]))[0]
    if (!d) return { ok: false, error: 'Document not found' }
    if (approverId && d.created_by && approverId === d.created_by)
      return { ok: false, error: 'The creator of this document cannot approve or reject it (separation of duties)' }
    const dup = (await query<{ id: number }>(`SELECT id FROM purchase_approvals WHERE document_id=$1 AND level=$2 AND approver_id=$3`, [id, level, approverId ?? null]))[0]
    if (dup) return { ok: false, error: 'This approver has already decided this level' }
    await query(`INSERT INTO purchase_approvals (document_id,level,decision,approver_id,comment,created_at) VALUES ($1,$2,$3,$4,$5,${NOW})`,
      [id, level, decision, approverId ?? null, comment ?? null])
    if (decision === 'rejected') {
      await query(`UPDATE purchase_documents SET status='rejected', updated_at=${NOW} WHERE id=$1`, [id])
      return { ok: true, status: 'rejected' }
    }
    const approved = (await query<{ level: number }>(`SELECT DISTINCT level FROM purchase_approvals WHERE document_id=$1 AND decision='approved'`, [id])).map(r => r.level)
    if (isFullyApproved(num(d.total), approved)) {
      await query(`UPDATE purchase_documents SET status='approved', updated_at=${NOW} WHERE id=$1`, [id])
      return { ok: true, status: 'approved' }
    }
    return { ok: true, status: 'submitted' }
  })
}

/**
 * Record a payment against a purchase invoice and recompute its settle
 * status.
 *
 * Phase-4 procurement audit finding: this had NO overpayment guard at
 * all (unlike the sales side, which at least had one before its own
 * concurrency fix) — purchaseInvoiceStatus() marks 'paid' once
 * paid>=total but never rejects paid>total, so nothing stopped an
 * arbitrary overpayment. It also ran as bare, unlocked pgQuery calls
 * (insert payment, recompute paid, update status) — the identical TOCTOU
 * class fixed on the sales payment route: two concurrent payments could
 * both read the same "already paid" sum and both insert, together
 * exceeding the invoice total. Fixed: reuses sales.ts's validatePayment
 * (no second money-validation implementation) inside one transaction,
 * serialized per document via pg_advisory_xact_lock.
 */
export async function recordPayment(documentId: number, vendorId: number, amount: number, method: string, date: string, reference?: string, userId?: string, currency = 'IRR'): Promise<{ ok: boolean; error?: string; paymentId?: number }> {
  const rate = (await rialRateFor(currency)) ?? 1
  let mismatchReasons: string[] | null = null
  const result = await withTransaction(async query => {
    await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`purchase_invoice_payment:${documentId}`])
    const d = (await query<{ total: number; status: string; doc_type: string; match_override: boolean }>(
      `SELECT total::float AS total, status, doc_type, match_override FROM purchase_documents WHERE id=$1`, [documentId]))[0]
    if (!d) return { ok: false, error: 'Document not found' } as const
    const already = num((await query<{ t: number }>(`SELECT COALESCE(SUM(amount),0)::float AS t FROM purchase_payments WHERE document_id=$1`, [documentId]))[0]?.t)
    const v = validatePayment({ status: d.status, invoiceTotal: num(d.total), alreadyPaid: already, amount })
    if (!v.ok) return { ok: false, error: v.error === 'cannot pay a void/draft invoice' ? 'Cannot record a payment against a void/draft invoice' : `Overpayment: invoice total ${d.total}, already paid ${already}, this ${amount}` } as const
    // Phase-5 three-way match payment gate: re-computed fresh inside this
    // same locked transaction (never trusting a stale persisted status) so
    // the check and the payment insert are atomic against a concurrent
    // receive/invoice-edit. 'pending' (no PO/receipt behind this invoice —
    // the normal case for a standalone invoice) never blocks; only a real
    // 'mismatch' is gated, and only in 'block' mode, and only when an
    // administrator has not already recorded an override.
    if (d.doc_type === 'invoice' && !d.match_override) {
      const mode = (await query<{ value: string }>(`SELECT value FROM erp_settings WHERE key='three_way_match_mode'`))[0]?.value ?? 'warn'
      if (mode !== 'off') {
        const match = await matchPurchaseInvoice(documentId, query)
        await persistMatch(query, documentId, match)
        if (match.status === 'mismatch') {
          const reasons = match.lines.flatMap(l => l.reasons)
          if (mode === 'block') return { ok: false, error: `THREE_WAY_MATCH_FAILED: ${reasons.join('; ')}` } as const
          mismatchReasons = reasons // warn: allow, alert after commit
        }
      }
    }
    const pay = (await query<{ id: number }>(`INSERT INTO purchase_payments (vendor_id,document_id,date,amount,method,reference,created_by,currency,exchange_rate,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,${NOW}) RETURNING id`,
      [vendorId, documentId, date, amount, method, reference ?? null, userId ?? null, currency, rate]))[0]
    const paid = already + amount
    const status = purchaseInvoiceStatus(num(d.total), paid)
    await query(`UPDATE purchase_documents SET paid_total=$2, status=$3, updated_at=${NOW} WHERE id=$1`, [documentId, paid, status])
    return { ok: true, paymentId: pay.id } as const
  })
  if (!result.ok) return result
  // 26.23: every supplier payment books Dr AP / Cr Bank (idempotent, best-effort —
  // a closed period leaves the payment recorded and self-heal/manual can post
  // later). GL posting stays its own transaction, run after the payment commits.
  try { await postPurchasePaymentToGl(result.paymentId!, userId) } catch { /* stays unposted */ }
  // Notification/event ordering (Phase-5 Section rule 17): the alert fires
  // only AFTER the payment transaction has committed, never before/during.
  if (mismatchReasons) await raiseMismatchAlert(documentId, mismatchReasons)
  return result
}

/** Administrator override: allow a mismatched invoice to be paid anyway, with a
 * recorded reason (no silent bypass — this is itself an audited action). */
export async function overrideMatch(invoiceId: number, reason: string, userId?: string): Promise<{ ok: boolean; error?: string }> {
  const d = (await pgQuery<{ doc_type: string }>(`SELECT doc_type FROM purchase_documents WHERE id=$1`, [invoiceId]))[0]
  if (!d) return { ok: false, error: 'Document not found' }
  if (d.doc_type !== 'invoice') return { ok: false, error: 'Only a purchase invoice can have its match overridden' }
  await pgQuery(`UPDATE purchase_documents SET match_override=true, match_override_reason=$2, match_override_by=$3, updated_at=${NOW} WHERE id=$1`, [invoiceId, reason, userId ?? null])
  return { ok: true }
}

/**
 * Three-way match (Phase 5): compares each invoice line against its linked
 * PO line (quantity/price/tax) and receipt line (received quantity), via
 * the po_line_id/receipt_line_id lineage convertDocument records. Pure
 * decision logic lives in threeWayMatch.ts — this only supplies the rows.
 * Runs read-only against whatever query/tx is handed in (defaults to a
 * plain pgQuery call so it can be invoked standalone via the API), and does
 * NOT persist by itself — callers decide whether/when to persist depending
 * on context (see persistMatch, used inside the payment transaction).
 */
export async function matchPurchaseInvoice(invoiceId: number, query: TxQuery = pgQuery): Promise<{ status: MatchStatus; lines: { lineId: number; status: MatchStatus; reasons: string[] }[] }> {
  const rows = await query<{
    lineId: number; invoiceQty: number; invoicePrice: number; invoiceTaxPct: number
    poQty: number | null; poPrice: number | null; poTaxPct: number | null; receiptReceivedQty: number | null
  }>(
    `SELECT il.id AS "lineId", il.qty::float AS "invoiceQty", il.unit_price::float AS "invoicePrice", il.tax_pct::float AS "invoiceTaxPct",
            po.qty::float AS "poQty", po.unit_price::float AS "poPrice", po.tax_pct::float AS "poTaxPct",
            rc.received_qty::float AS "receiptReceivedQty"
     FROM purchase_document_lines il
     LEFT JOIN purchase_document_lines po ON po.id = il.po_line_id
     LEFT JOIN purchase_document_lines rc ON rc.id = il.receipt_line_id
     WHERE il.document_id=$1 ORDER BY il.sort_order, il.id`, [invoiceId])
  const lines = rows.map(r => ({
    lineId: r.lineId,
    ...matchLine({
      poQty: r.poQty, poPrice: r.poPrice, poTaxPct: r.poTaxPct,
      receivedQty: r.receiptReceivedQty,
      invoiceQty: num(r.invoiceQty), invoicePrice: num(r.invoicePrice), invoiceTaxPct: num(r.invoiceTaxPct),
    }),
  }))
  return { status: overallMatchStatus(lines.map(l => l.status)), lines }
}

async function persistMatch(query: TxQuery, invoiceId: number, match: { status: MatchStatus; lines: { lineId: number; status: MatchStatus; reasons: string[] }[] }) {
  await query(`UPDATE purchase_documents SET match_status=$2, match_checked_at=${NOW} WHERE id=$1`, [invoiceId, match.status])
  for (const l of match.lines) await query(`UPDATE purchase_document_lines SET match_status=$2 WHERE id=$1`, [l.lineId, l.status])
}

/** Best-effort business_alert on a genuine mismatch (warn mode / block-then-overridden). */
async function raiseMismatchAlert(invoiceId: number, reasons: string[]) {
  try {
    await pgQuery(
      `INSERT INTO business_alerts (kind, domain, severity, title_en, title_fa, detail, ref_type, ref_id, fingerprint, updated_at)
       VALUES ('three_way_match_mismatch','financial','warning','Purchase invoice does not match its PO/receipt','فاکتور خرید با سفارش/رسید مطابقت ندارد',$1,'purchase_documents',$2,$3,${NOW})
       ON CONFLICT (fingerprint) DO UPDATE SET updated_at=${NOW}, status='open'`,
      [reasons.join('; '), invoiceId, `three_way_match:${invoiceId}`])
  } catch { /* alert is best-effort */ }
}

/** Convert an upstream doc (e.g. PR→PO, PO→GRN, GRN→invoice) copying its lines. */
export async function convertDocument(sourceId: number, toType: PurchaseDocType, userId?: string): Promise<number> {
  const src = await getDocument(sourceId)
  if (!src) throw new Error('Source not found')
  // BUG-013 sibling (26.26): a purchase return/credit_note against an invoice must
  // be guarded exactly like the sales side — only a confirmed/posted invoice, and
  // the cumulative return may not exceed the invoice total (else AP goes negative).
  if ((toType === 'credit_note' || toType === 'return') && src.doc_type === 'invoice') {
    if (['draft', 'void'].includes(String(src.status))) throw new Error('Only a confirmed purchase invoice can be returned')
    // convertDocument copies the FULL invoice, so any prior non-void return means
    // the invoice is already fully returned → block the duplicate (idempotency).
    const prior = num((await pgQuery<{ s: number }>(
      `SELECT COALESCE(SUM(total),0)::float AS s FROM purchase_documents WHERE source_id=$1 AND doc_type IN ('credit_note','return') AND status<>'void'`, [sourceId]))[0]?.s)
    if (prior > 0.001) throw new Error('This invoice has already been returned')
    // If the invoice was already paid, the vendor owes us back — flag until settled.
    const paid = num((await pgQuery<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE vendor_id=$1`, [src.vendor_id ?? 0]))[0]?.s)
    if (paid > 0) {
      await pgQuery(
        `INSERT INTO business_alerts (kind, domain, severity, title_en, title_fa, detail, ref_type, ref_id, channels, fingerprint, updated_at)
         VALUES ('purchase_return_pending','financial','warning','Purchase return awaiting vendor settlement','برگشت خرید در انتظار تسویه فروشنده',$1,'purchase_documents',$2,'["inapp"]',$3,to_char(now(),'YYYY-MM-DD HH24:MI:SS'))
         ON CONFLICT (fingerprint) DO UPDATE SET updated_at=to_char(now(),'YYYY-MM-DD HH24:MI:SS')`,
        [`Vendor credit of ${num(src.total)} — apply to a future PO or record a refund receipt.`, sourceId, `purchase_return_pending:${sourceId}`])
    }
  }
  // Three-way match lineage (Phase 5): order→receipt records the PO line
  // each receipt line came from; receipt→invoice records the receipt line
  // AND propagates the PO line it already carries, so an invoice converted
  // straight from a receipt can be matched against both ancestors. A PO
  // converted directly to an invoice (skipping receipt) still records the
  // PO line — matchLine correctly reports 'pending' with no receivedQty to
  // compare against, rather than fabricating a pass.
  const srcLines = src.lines as unknown as (LineRow & { id: number })[]
  const lines = srcLines.map(l => {
    const row: LineRow = { description: l.description, qty: num(l.qty), unitPrice: num(l.unitPrice), discountPct: num(l.discountPct), taxPct: num(l.taxPct), productId: l.productId ?? null }
    if (toType === 'receipt' && src.doc_type === 'order') row.poLineId = l.id
    else if (toType === 'invoice' && src.doc_type === 'receipt') { row.receiptLineId = l.id; row.poLineId = l.poLineId ?? null }
    else if (toType === 'invoice' && src.doc_type === 'order') row.poLineId = l.id
    return row
  })
  return saveDocument({ docType: toType, vendorId: src.vendor_id ?? undefined, date: new Date().toISOString().slice(0, 10), currency: 'IRR', sourceId, lines }, userId)
}

// ── GL posting ───────────────────────────────────────────────────────────────
import { purchaseInvoicePostingLines, postingBalanced } from './purchasing'

/**
 * Post a confirmed purchase invoice into the double-entry GL (idempotent).
 * Dr Inventory (net) + Dr Taxes Payable (VAT) / Cr Accounts Payable (total).
 * Returns the created journal entry id, or the existing one if already posted.
 */
export async function postPurchaseInvoiceToGl(docId: number, userId?: string): Promise<{ entryId: number; alreadyPosted: boolean }> {
  const d = (await pgQuery<{ doc_type: string; status: string; subtotal: number; discount_total: number; tax_total: number; total: number; gl_entry_id: number | null; doc_no: string | null; date: string | null; company_id: number | null; cost_center_id: number | null; currency: string | null; exchange_rate: number | null }>(
    `SELECT doc_type, status, subtotal, discount_total, tax_total, total, gl_entry_id, doc_no, date, company_id, cost_center_id, currency, exchange_rate FROM purchase_documents WHERE id=$1`, [docId]))[0]
  if (!d) throw new Error('Document not found')
  if (d.gl_entry_id) return { entryId: d.gl_entry_id, alreadyPosted: true }
  if (d.doc_type !== 'invoice') throw new Error('Only purchase invoices post to the GL')
  if (['draft', 'void'].includes(d.status)) throw new Error('Confirm the invoice before posting')

  const net = num(d.subtotal) - num(d.discount_total)
  // 26.23: account codes flow through the configurable erp_settings map.
  const lines = applyGlMap(purchaseInvoicePostingLines(net, num(d.tax_total), num(d.total)), await loadGlMap())
  if (!postingBalanced(lines)) throw new Error('Posting does not balance')

  // Resolve account ids by code (seeded standard chart).
  const codes = [...new Set(lines.map(l => l.accountCode))]
  const accs = await pgQuery<{ id: number; code: string }>(`SELECT id, code FROM gl_accounts WHERE code = ANY($1)`, [codes])
  const idOf = new Map(accs.map(a => [a.code, a.id]))
  for (const c of codes) if (!idOf.has(c)) throw new Error(`GL account ${c} is missing from the chart`)

  // Post ON THE DOCUMENT DATE (26.21 audit fix — mirrors sales): a now()-dated
  // entry lands outside the invoice's fiscal period and breaks period reports.
  const glDate = (d.date ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10)
  const gate = await assertPostable(glDate)
  if (!gate.ok) throw new Error(gate.error ?? 'Fiscal period is closed for this document date')
  const entryNo = await nextNumber('journal', { legacyPrefix: 'JV' })
  // Full-remediation RULE-001/RULE-006: header insert, every line insert and
  // the source-document gl_entry_id link now commit as ONE transaction — the
  // old bare-pgQuery loop could leave a POSTED, UNBALANCED entry on the
  // books if any line insert failed mid-loop (mirrors the sales-invoice fix).
  const entryId = await withTransaction(async query => {
    // Carry the document's company + currency onto the entry (tenancy + multi-currency).
    const entry = (await query<{ id: number }>(
      `INSERT INTO gl_journal_entries (entry_no, date, memo, reference, status, total, created_by, period_id, company_id, currency, exchange_rate, created_at, posted_at)
       VALUES ($1, $2, $3, $4, 'posted', $5, $6, $7, $8, $9, $10, ${NOW}, ${NOW}) RETURNING id`,
      [entryNo, glDate, `Purchase invoice ${d.doc_no ?? docId}`, `PUR-${docId}`, num(d.total), userId ?? null, gate.periodId ?? null,
       d.company_id ?? null, d.currency ?? 'IRR', num(d.exchange_rate) || 1]))[0]
    let ln = 0
    for (const l of lines) {
      // Cost-center from the document flows onto every posting line (26.11 analytics).
      await query(`INSERT INTO gl_journal_lines (entry_id, account_id, debit, credit, memo, line_no, cost_center_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [entry.id, idOf.get(l.accountCode), l.debit, l.credit, l.memo, ln++, d.cost_center_id ?? null])
    }
    await query(`UPDATE purchase_documents SET gl_entry_id=$2, updated_at=${NOW} WHERE id=$1`, [docId, entry.id])
    return entry.id
  })
  return { entryId, alreadyPosted: false }
}

/**
 * Confirm a draft purchase invoice and auto-post it to the GL (26.24b BUG-008).
 * Mirrors the sales confirm→auto-post path: a closed fiscal period fails loudly
 * and the status is rolled back so the invoice never ends up "confirmed but
 * never credited to AP" (the asymmetry that let AP drift negative on payment).
 * Idempotent via the gl_entry_id guard inside postPurchaseInvoiceToGl.
 */
export async function confirmPurchaseInvoice(docId: number, userId?: string): Promise<{ status: PurchaseStatus; entryId: number | null }> {
  const d = (await pgQuery<{ doc_type: string; status: string }>(`SELECT doc_type, status FROM purchase_documents WHERE id=$1`, [docId]))[0]
  if (!d) throw new Error('Document not found')
  if (d.doc_type !== 'invoice') throw new Error('Only purchase invoices can be confirmed to the GL')
  if (d.status === 'void') throw new Error('Voided documents cannot be confirmed')
  const prev = d.status
  await pgQuery(`UPDATE purchase_documents SET status='confirmed', updated_at=${NOW} WHERE id=$1`, [docId])
  try {
    const res = await postPurchaseInvoiceToGl(docId, userId)
    return { status: 'confirmed', entryId: res.entryId }
  } catch (err) {
    await pgQuery(`UPDATE purchase_documents SET status=$2, updated_at=${NOW} WHERE id=$1`, [docId, prev])
    throw err
  }
}

/**
 * Void a purchase invoice. If it was posted to the GL, book a balanced REVERSAL
 * entry (reuses the 26.23 reverseEntry mechanism → two-way reversal_of/reversed_by
 * linkage). Idempotent — re-voiding a posted+reversed doc books nothing new.
 */
export async function voidPurchaseInvoice(docId: number, userId?: string): Promise<{ status: PurchaseStatus; reversalId: number | null }> {
  const d = (await pgQuery<{ status: string; gl_entry_id: number | null }>(`SELECT status, gl_entry_id FROM purchase_documents WHERE id=$1`, [docId]))[0]
  if (!d) throw new Error('Document not found')
  let reversalId: number | null = null
  if (d.gl_entry_id) reversalId = (await reverseEntry(Number(d.gl_entry_id), userId)).reversalId
  await pgQuery(`UPDATE purchase_documents SET status='void', updated_at=${NOW} WHERE id=$1`, [docId])
  return { status: 'void', reversalId }
}

// ── Analytics ────────────────────────────────────────────────────────────────
import { purchaseAnalytics, type PurchaseDocFact } from './purchasing'

/** Purchasing analytics — one query, the pure engine does the aggregation. */
export async function analytics(months = 12) {
  const rows = await pgQuery<{ doc_type: string; status: string; total: number; date: string; vendor_name: string | null }>(
    `SELECT d.doc_type, d.status, (d.total*d.exchange_rate) AS total, d.date, v.name AS vendor_name
     FROM purchase_documents d LEFT JOIN purchase_vendors v ON v.id = d.vendor_id`)
  const facts: PurchaseDocFact[] = rows.map(r => ({
    docType: r.doc_type as PurchaseDocFact['docType'], status: r.status,
    total: num(r.total), date: r.date, vendorName: r.vendor_name,
  }))
  return purchaseAnalytics(facts, months)
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export async function overview() {
  const orders = (await pgQuery<{ status: string; total: number }>(`SELECT status, (total*exchange_rate) AS total FROM purchase_documents WHERE doc_type='order'`)).map(o => ({ status: o.status as PurchaseStatus, total: num(o.total) }))
  const pendingApproval = num((await pgQuery<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_documents WHERE status='submitted'`))[0]?.c)
  const payables = num((await pgQuery<{ t: number }>(`SELECT COALESCE(SUM((total-paid_total)*exchange_rate),0) AS t FROM purchase_documents WHERE doc_type='invoice' AND status IN ('confirmed','partial')`))[0]?.t)
  const vendors = num((await pgQuery<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_vendors WHERE active=true`))[0]?.c)
  const kpis = purchaseKpis({ orders, pendingApproval, payables, vendors })
  const topVendors = await pgQuery(`SELECT name, score, grade FROM purchase_vendors WHERE active=true ORDER BY score DESC LIMIT 5`)
  const recent = await listDocuments()
  return { kpis, topVendors, recent: recent.slice(0, 8) }
}
