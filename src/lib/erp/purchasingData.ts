/**
 * Purchasing data layer (Phase 26.1) — PostgreSQL access for procure-to-pay.
 * Pure logic lives in `purchasing.ts`; totals/approval/scoring come from there.
 */
import { pgQuery, withTransaction, type TxQuery } from '@/lib/db'
import { nextNumber } from '@/lib/numbering/integrate'
import { rialRateFor } from './currencyData'
import { assertPostable } from './accountingData'
import { loadGlMap, applyGlMap, postPurchasePaymentToGl, reverseEntry, raisePaymentUnpostedAlert } from './glPosting'
import { toBase } from './money'
import {
  documentTotals, requiredApprovalLevels, isFullyApproved, vendorScore, vendorPayable,
  purchaseInvoiceStatus, purchaseKpis, validateBudget, DEFAULT_APPROVAL_MATRIX, type LineInput, type PurchaseDocType, type PurchaseStatus, type ApprovalTier,
} from './purchasing'
import { validatePayment } from './sales'
import { matchLine, overallMatchStatus, type MatchStatus } from './threeWayMatch'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const num = (v: unknown) => Number(v ?? 0)

export interface VendorInput {
  code?: string; name: string; kind?: string; email?: string; phone?: string
  taxId?: string; economicCode?: string; address?: string; iban?: string
  currency?: string; paymentTerms?: number
  nationalId?: string; regNo?: string; contactName?: string; contactPhone?: string
  bankName?: string; city?: string; postalCode?: string; website?: string
  category?: string; notes?: string
}
export interface LineRow extends LineInput {
  description: string; productId?: number | null
  /** Three-way match lineage (Phase 5) — which PO/receipt line this line was
   * converted from, set by convertDocument. Undefined for a hand-entered or
   * standalone document. */
  poLineId?: number | null; receiptLineId?: number | null
  /** ERPFIX-5 (BUG-ERP-11): which GL account family this line posts to.
   * Optional — derived if omitted: a line with a product_id defaults to
   * 'stock' (unchanged behavior); a line with no product_id defaults to
   * 'expense' (previously silently went to inventory too — the bug). An
   * operator may explicitly mark a no-product line as 'fixed_asset'. */
  lineClass?: 'stock' | 'expense' | 'fixed_asset' | null
}

// ── Vendors ──────────────────────────────────────────────────────────────────
export async function listVendors() {
  return pgQuery(`SELECT id, code, name, kind, email, phone, tax_id AS "taxId", economic_code AS "economicCode",
    national_id AS "nationalId", reg_no AS "regNo", address, iban, bank_name AS "bankName",
    contact_name AS "contactName", contact_phone AS "contactPhone", city, postal_code AS "postalCode",
    website, category, notes, currency,
    payment_terms AS "paymentTerms", score, grade, active FROM purchase_vendors ORDER BY name`)
}
export async function createVendor(v: VendorInput, userId?: string): Promise<number> {
  const code = v.code || await nextNumber('vendor', { legacyPrefix: 'VEN' })
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO purchase_vendors (code,name,kind,email,phone,tax_id,economic_code,address,iban,currency,payment_terms,
       national_id,reg_no,contact_name,contact_phone,bank_name,city,postal_code,website,category,notes,
       created_by,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,${NOW},${NOW}) RETURNING id`,
    [code, v.name, v.kind ?? 'company', v.email ?? null, v.phone ?? null, v.taxId ?? null, v.economicCode ?? null,
     v.address ?? null, v.iban ?? null, v.currency ?? 'IRR', v.paymentTerms ?? 0,
     v.nationalId ?? null, v.regNo ?? null, v.contactName ?? null, v.contactPhone ?? null,
     v.bankName ?? null, v.city ?? null, v.postalCode ?? null, v.website ?? null, v.category ?? null, v.notes ?? null,
     userId ?? null]))[0]
  return row.id
}
export async function updateVendor(id: number, v: Partial<VendorInput>) {
  await pgQuery(
    `UPDATE purchase_vendors SET name=COALESCE($2,name), email=$3, phone=$4, tax_id=$5, address=$6,
       iban=$7, currency=COALESCE($8,currency), payment_terms=COALESCE($9,payment_terms),
       economic_code=$10, national_id=$11, reg_no=$12, contact_name=$13, contact_phone=$14,
       bank_name=$15, city=$16, postal_code=$17, website=$18, category=$19, notes=$20, updated_at=${NOW} WHERE id=$1`,
    [id, v.name ?? null, v.email ?? null, v.phone ?? null, v.taxId ?? null, v.address ?? null, v.iban ?? null,
     v.currency ?? null, v.paymentTerms ?? null, v.economicCode ?? null, v.nationalId ?? null, v.regNo ?? null,
     v.contactName ?? null, v.contactPhone ?? null, v.bankName ?? null, v.city ?? null, v.postalCode ?? null,
     v.website ?? null, v.category ?? null, v.notes ?? null])
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
interface DocRow { id: number; doc_no: string | null; doc_type: string; vendor_id: number | null; status: string; date: string; total: number; paid_total: number; approval_levels: number; budget: number; gl_entry_id: number | null; priority: string; currency: string; exchange_rate: number; department: string | null; cost_center_id: number | null; company_id: number | null }
/**
 * ERPFIX-8 (BUG-ERP-22): this used to run `SELECT d.*` with no LIMIT at all
 * — on a realistic volume (measured: 50k documents) it returns every row
 * over the wire regardless of how many the caller actually shows. Now
 * server-side paginated (default 100, capped 500) — the return shape stays
 * backward-compatible (a plain array) for every existing caller that never
 * passed `opts`; `opts.withMeta` opts a caller into `{rows, total}` when it
 * actually needs the total count for a pager UI.
 */
export async function listDocuments(docType?: PurchaseDocType, opts: { limit?: number; offset?: number; withMeta?: boolean } = {}) {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500)
  const offset = Math.max(opts.offset ?? 0, 0)
  const params: unknown[] = []
  let where = ''
  if (docType) { params.push(docType); where = `WHERE d.doc_type=$${params.length}` }
  params.push(limit, offset)
  const rows = await pgQuery<DocRow & { vendor_name: string | null }>(
    `SELECT d.*, v.name AS vendor_name FROM purchase_documents d LEFT JOIN purchase_vendors v ON v.id=d.vendor_id
     ${where} ORDER BY d.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params)
  const mapped = rows.map(r => ({ id: r.id, docNo: r.doc_no, docType: r.doc_type, vendorId: r.vendor_id, vendorName: r.vendor_name, status: r.status, date: r.date, total: num(r.total), paidTotal: num(r.paid_total), approvalLevels: r.approval_levels, budget: num(r.budget), glEntryId: r.gl_entry_id, priority: r.priority }))
  if (!opts.withMeta) return mapped
  const countParams = docType ? [docType] : []
  const total = num((await pgQuery<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM purchase_documents d ${docType ? 'WHERE d.doc_type=$1' : ''}`, countParams))[0]?.n)
  return { rows: mapped, total, limit, offset }
}
export async function getDocument(id: number) {
  const d = (await pgQuery<DocRow>(`SELECT * FROM purchase_documents WHERE id=$1`, [id]))[0]
  if (!d) return null
  const lines = await pgQuery(`SELECT id, description, qty::float AS qty, unit_price::float AS "unitPrice", discount_pct::float AS "discountPct", tax_pct::float AS "taxPct", product_id AS "productId", received_qty::float AS "receivedQty",
    po_line_id AS "poLineId", receipt_line_id AS "receiptLineId", match_status AS "matchStatus", line_class AS "lineClass" FROM purchase_document_lines WHERE document_id=$1 ORDER BY sort_order, id`, [id])
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
  // ERPFIX-3 (BUG-ERP-04): costCenterId/companyId/exchangeRate are additive —
  // a caller (e.g. convertDocument) can now carry these through a
  // conversion instead of a document silently losing them. exchangeRate is
  // an EXPLICIT override (used when copying a source document's own
  // registered rate verbatim); otherwise it's resolved live via rialRateFor.
  costCenterId?: number | null; companyId?: number | null; exchangeRate?: number
}, userId?: string, externalQuery?: TxQuery): Promise<number> {
  const totals = documentTotals(input.lines)
  const rate = input.exchangeRate ?? (await rialRateFor(input.currency ?? 'IRR')) ?? 1
  const baseTotal = Math.round(totals.total * rate * 100) / 100
  const run = async (query: TxQuery) => {
    if (input.id) {
      // ERPFIX-4 (BUG-ERP-15): a submitted/approved/received/invoiced
      // document is LOCKED — saveDocument previously had no status guard
      // at all, so editing an approved PO's price, or a GRN-linked order's
      // lines, silently rewrote it and orphaned every po_line_id/
      // receipt_line_id downstream pointer (the old lines were deleted and
      // reinserted with new ids). Only 'draft' and 'rejected' (sent back
      // for changes) may still be edited — both are guaranteed to have no
      // downstream document referencing their lines yet.
      const cur = (await query<{ status: string }>(`SELECT status FROM purchase_documents WHERE id=$1 FOR UPDATE`, [input.id]))[0]
      if (!cur) throw new Error('Document not found')
      if (!['draft', 'rejected'].includes(cur.status)) {
        throw new PurchaseDocLockedError(`a purchase document in status "${cur.status}" cannot be edited — only draft/rejected`)
      }
      await query(
        `UPDATE purchase_documents SET vendor_id=$2, date=$3, currency=COALESCE($4,currency), department=$5, budget=$6,
          note=$7, subtotal=$8, discount_total=$9, tax_total=$10, total=$11, priority=COALESCE($12,priority), exchange_rate=$13, base_total=$14,
          cost_center_id=COALESCE($15,cost_center_id), company_id=COALESCE($16,company_id), updated_at=${NOW} WHERE id=$1`,
        [input.id, input.vendorId ?? null, input.date, input.currency ?? null, input.department ?? null, input.budget ?? 0,
         input.note ?? null, totals.subtotal, totals.discountTotal, totals.taxTotal, totals.total, input.priority ?? null, rate, baseTotal,
         input.costCenterId ?? null, input.companyId ?? null])
      await query(`DELETE FROM purchase_document_lines WHERE document_id=$1`, [input.id])
      await insertLines(query, input.id, input.lines)
      return input.id
    }
    const docNo = await nextNumber(`purchase_${input.docType}`, { legacyPrefix: input.docType.toUpperCase().slice(0, 3) })
    const row = (await query<{ id: number }>(
      `INSERT INTO purchase_documents (doc_no,doc_type,vendor_id,date,currency,department,budget,source_id,note,subtotal,discount_total,tax_total,total,priority,created_by,exchange_rate,base_total,cost_center_id,company_id,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,${NOW},${NOW}) RETURNING id`,
      [docNo, input.docType, input.vendorId ?? null, input.date, input.currency ?? 'IRR', input.department ?? null, input.budget ?? 0,
       input.sourceId ?? null, input.note ?? null, totals.subtotal, totals.discountTotal, totals.taxTotal, totals.total, input.priority ?? 'normal', userId ?? null, rate, baseTotal,
       input.costCenterId ?? null, input.companyId ?? null]))[0]
    await insertLines(query, row.id, input.lines)
    return row.id
  }
  // Phase-8 returns audit: callers guarding a compound invariant (e.g.
  // convertDocument's "this invoice hasn't already been returned" check
  // for purchase returns) need saveDocument's insert to join THEIR
  // already-locked transaction — otherwise the check and the write are
  // two separate transactions and the same race can slip through between
  // them. Self-transactional when called standalone (every other caller).
  if (externalQuery) return run(externalQuery)
  return withTransaction(run)
}
async function insertLines(query: TxQuery, docId: number, lines: LineRow[]) {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    // ERPFIX-5 (BUG-ERP-11): line_class defaults from product_id when the
    // caller doesn't pass one explicitly — a product line is 'stock', a
    // service line is 'expense'; 'fixed_asset' is only ever explicit.
    const lineClass = l.lineClass ?? (l.productId != null ? 'stock' : 'expense')
    await query(`INSERT INTO purchase_document_lines (document_id,description,qty,unit_price,discount_pct,tax_pct,sort_order,product_id,po_line_id,receipt_line_id,line_class) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [docId, l.description, l.qty, l.unitPrice, l.discountPct, l.taxPct, i, l.productId ?? null, l.poLineId ?? null, l.receiptLineId ?? null, lineClass])
  }
}

/**
 * ERPFIX-4 (BUG-ERP-17, decision_gate answered — ب): the single source of
 * truth for how many approval levels a purchase document needs. Reads the
 * SAME `approval_matrix` table the Approval Center uses (doc_type
 * 'purchase_order', the one seeded matrix for purchasing) and picks the
 * active row whose [min_amount, max_amount] band contains the amount,
 * highest-priority first; the level count is the length of that row's
 * `levels` JSON plan. Only when no matching row exists at all (a doc_type
 * the matrix doesn't cover, or an empty/mid-migration matrix) does this
 * fall back to the hardcoded `DEFAULT_APPROVAL_MATRIX` — never silently
 * diverging from a matrix an operator has actually configured.
 */
export async function purchaseApprovalLevels(baseAmount: number, docType: string): Promise<number> {
  const matrixDocType = docType === 'order' ? 'purchase_order' : docType === 'request' ? 'purchase_request' : null
  if (matrixDocType) {
    const row = (await pgQuery<{ levels: string }>(
      `SELECT levels FROM approval_matrix
       WHERE doc_type=$1 AND active=1 AND min_amount<=$2 AND (max_amount IS NULL OR max_amount>=$2)
       ORDER BY priority DESC, min_amount DESC LIMIT 1`, [matrixDocType, baseAmount]))[0]
    if (row) {
      try { const plan = JSON.parse(row.levels); if (Array.isArray(plan) && plan.length > 0) return plan.length } catch { /* fall through to default */ }
    }
  }
  return requiredApprovalLevels(baseAmount)
}

/**
 * Submit a document for approval. Runs the BUDGET CHECK first: when the doc
 * carries a budget envelope, the department's committed spend this year plus
 * this request must fit inside it — over-budget submits are blocked with the
 * exact numbers. Then computes the required approval levels.
 */
export async function submitDocument(id: number): Promise<{ ok: boolean; error?: string; budget?: ReturnType<typeof validateBudget> }> {
  // ERPFIX-2 (BUG-ERP-03): budget/approval thresholds compare base_total
  // (Rial base) — a raw `total` read lets a 1,000 USD request slip under a
  // Rial-denominated threshold meant for 1,000 Rial.
  const d = (await pgQuery<{ total: number; base_total: number; budget: number; department: string | null; date: string; doc_type: string }>(
    `SELECT total, base_total, budget, department, date, doc_type FROM purchase_documents WHERE id=$1`, [id]))[0]
  if (!d) return { ok: false, error: 'Document not found' }
  const baseTotal = num(d.base_total) || num(d.total)
  if (num(d.budget) > 0) {
    // ERPFIX-4 (BUG-ERP-17): department is now validated against the real
    // registry (erp_cost_centers kind='department') instead of free text —
    // a typo'd department silently created its own, never-aggregated bucket.
    if (d.department) {
      const known = (await pgQuery<{ id: number }>(
        `SELECT id FROM erp_cost_centers WHERE kind='department' AND active=1 AND (code=$1 OR name_en=$1 OR name_fa=$1)`, [d.department]))[0]
      if (!known) return { ok: false, error: `Unknown department: ${d.department}` }
    }
    // ERPFIX-4 (BUG-ERP-17): the fiscal year is the real gl_fiscal_periods
    // row (kind='year') covering this document's date — a LIKE 'YYYY%' on
    // the Gregorian string broke for any fiscal year that doesn't align to
    // the calendar year and is a string hack where a real table exists.
    const period = (await pgQuery<{ id: number; start_date: string; end_date: string }>(
      `SELECT id, start_date, end_date FROM gl_fiscal_periods WHERE kind='year' AND $1 BETWEEN start_date AND end_date LIMIT 1`, [d.date]))[0]
    // ERPFIX-4 (BUG-ERP-17): committed spend now counts only the HEAD of
    // each document chain (the one with no non-void child via source_id) —
    // a PR→PO→invoice chain for the SAME purchase previously counted its
    // total THREE times (once per stage), inflating "committed" 3x and
    // blocking submits that were actually well within budget.
    const committed = d.department && period
      ? num((await pgQuery<{ t: number }>(
          `SELECT COALESCE(SUM(COALESCE(p.base_total, p.total)),0) AS t FROM purchase_documents p
           WHERE p.id<>$1 AND p.department=$2 AND p.date BETWEEN $3 AND $4
             AND p.status NOT IN ('draft','void','rejected')
             AND NOT EXISTS (SELECT 1 FROM purchase_documents c WHERE c.source_id=p.id AND c.status<>'void')`,
          [id, d.department, period.start_date, period.end_date]))[0]?.t)
      : 0
    const budget = validateBudget({ budget: num(d.budget), committed, requested: baseTotal })
    if (!budget.withinBudget)
      return { ok: false, budget, error: `Over budget: available ${budget.available.toLocaleString()}, requested ${baseTotal.toLocaleString()}` }
  }
  // ERPFIX-4 (BUG-ERP-17, decision_gate answered — ب): requiredApprovalLevels
  // now consults the SAME configurable approval_matrix the Approval Center
  // uses, falling back to the hardcoded DEFAULT_APPROVAL_MATRIX only when no
  // matrix row exists for this doc_type — one source of truth for the
  // threshold, no second hardcoded matrix silently diverging from it.
  const levels = await purchaseApprovalLevels(baseTotal, d.doc_type)
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
      // ERPFIX-6 (BUG-ERP-12): last_cost is purely informational (never a
      // COGS source — issueCost reads inv_moves, not this column) — the
      // most recent price actually paid, updated at the moment stock
      // physically enters the warehouse.
      await query(`UPDATE inv_products SET last_cost=$2, updated_at=${NOW} WHERE id=$1`, [l.product_id, num(l.unit_price) * (num(doc.exchange_rate) || 1)])
      await query(`UPDATE purchase_document_lines SET received_qty = received_qty + $2 WHERE id=$1`, [l.id, take])
      received++
    }
    const after = await query<{ qty: number; received_qty: number; product_id: number | null }>(
      `SELECT qty::float AS qty, received_qty::float AS received_qty, product_id FROM purchase_document_lines WHERE document_id=$1`, [docId])
    const productLines = after.filter(l => l.product_id)
    const complete = productLines.length === 0 || productLines.every(l => num(l.received_qty) + 0.0001 >= num(l.qty))
    const status = complete ? 'received' : 'partial'
    await query(`UPDATE purchase_documents SET status=$2, updated_at=${NOW} WHERE id=$1`, [docId, status])
    // PROC-FLOW-1 بند۳.۱.۴ — a goods-request route into this SAME chain
    // (via a supply note → convertDocument's request→…→receipt lineage,
    // chained by source_id) auto-closes once the chain it fed is fully
    // received. Walks source_id up to the root request; a no-op for any
    // document that was never fed by a supply note (the common case).
    if (status === 'received') {
      const root = await query<{ id: number }>(
        `WITH RECURSIVE up(id, source_id, depth) AS (
           SELECT id, source_id, 0 FROM purchase_documents WHERE id=$1
           UNION ALL
           SELECT p.id, p.source_id, u.depth+1 FROM purchase_documents p JOIN up u ON p.id=u.source_id WHERE u.depth < 10
         ) SELECT id FROM up ORDER BY depth DESC LIMIT 1`, [docId])
      if (root[0]) {
        await query(
          `UPDATE inv_supply_notes SET status='closed', updated_at=${NOW}
           WHERE linked_purchase_document_id=$1 AND status NOT IN ('closed','cancelled')`, [root[0].id])
      }
    }
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
/**
 * ERPFIX-4 (BUG-ERP-16, decision_gate answered): doc.payment ("record a
 * direct purchase payment") bypasses the Treasury payment-order approval
 * flow entirely. `erp_settings.direct_payment_mode` ('off'|'warn'|'block',
 * default 'warn') decides whether an amount above the FIRST tier of the
 * (purchasing) approval matrix is silently allowed, allowed-with-alert, or
 * rejected outright. The threshold and the amount are BOTH Rial — this
 * system's base currency throughout (a stray "Toman tiers" comment
 * elsewhere in migrate.ts is just a wrong label, not a real unit change).
 */
export async function directPaymentGate(amountRial: number): Promise<{ blocked: boolean; warn: boolean }> {
  const modeRow = (await pgQuery<{ value: string }>(`SELECT value FROM erp_settings WHERE key='direct_payment_mode'`))[0]
  const mode = modeRow?.value === 'off' || modeRow?.value === 'block' ? modeRow.value : 'warn'
  if (mode === 'off') return { blocked: false, warn: false }
  const ceiling = DEFAULT_APPROVAL_MATRIX[0]?.upTo ?? Infinity
  const over = amountRial > ceiling
  if (!over) return { blocked: false, warn: false }
  return { blocked: mode === 'block', warn: mode === 'warn' }
}

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
  try { await postPurchasePaymentToGl(result.paymentId!, userId) } catch (err) { await raisePaymentUnpostedAlert('purchase', result.paymentId!, err) }
  // Notification/event ordering (Phase-5 Section rule 17): the alert fires
  // only AFTER the payment transaction has committed, never before/during.
  if (mismatchReasons) await raiseMismatchAlert(documentId, mismatchReasons)
  return result
}

// ── Phase 15: direct AP payment reversal ─────────────────────────────────────
/**
 * Phase 15: reverses a single direct AP payment created via `recordPayment` —
 * the reversal gap Phase 14 explicitly left open (a direct payment has no
 * `payment_orders` row, so Treasury's `reversePayment` cannot target it).
 *
 * Structurally simpler than Phase 14's Treasury reversal: `recordPayment`
 * always writes exactly ONE `purchase_payments` row per call, always with a
 * real `document_id` (never NULL — there is no "unapplied" concept on this
 * path, `validatePayment` already rejects overpayment beyond the invoice
 * total), and that row is never itself the source of any derived row the way
 * a Treasury unapplied row can be (Phase 12 `consumeUnappliedForVendor` only
 * ever reads `document_id IS NULL` rows, which `recordPayment` never
 * creates). So reversing a direct payment is one exact-negation row, not a
 * gl_entry_id-tagged group — the `paymentId` (the `purchase_payments.id`
 * itself) is both the stable identifier (Q4) and the whole "lineage".
 *
 * One real structural difference from every other payment path in this
 * codebase: `recordPayment` posts to the GL as a SEPARATE, best-effort step
 * AFTER its own transaction commits (`postPurchasePaymentToGl`, wrapped in
 * try/catch — a closed period at recording time leaves the row correctly
 * unposted rather than blocking the payment). So `gl_entry_id` may
 * legitimately be NULL forever on a direct-payment row. This function
 * reverses the `purchase_payments` row and recomputes the invoice
 * regardless; it only calls `reverseEntry` when `gl_entry_id` is actually
 * set — there is no GL entry to reverse for a payment that was never posted.
 *
 * Idempotent via the same `reference NOT LIKE`/`NOT EXISTS` pattern Phase
 * 12-14 established (`AP-DIRECT-REVERSE:<paymentId>`), locked on the SAME
 * `treasury_ap_allocate:vendor:${vendorId}` advisory key Phases 11-14 all
 * share, so this can never interleave with a concurrent Treasury payment,
 * unapplied-cash consumption, another direct payment, or an invoice void for
 * the same vendor.
 */
export async function reverseDirectPayment(paymentId: number, userId?: string): Promise<{ reversalId: number | null; alreadyReversed: boolean; amountReversed: number }> {
  const p = (await pgQuery<{ vendor_id: number; document_id: number | null; amount: number; gl_entry_id: number | null; reference: string | null }>(
    `SELECT vendor_id, document_id, amount::float AS amount, gl_entry_id, reference FROM purchase_payments WHERE id=$1`, [paymentId]))[0]
  if (!p) throw new Error('Payment not found')
  if (p.document_id == null) throw new Error('Not a direct AP payment against an invoice — nothing to reverse this way')
  const ref = p.reference ?? ''
  if (ref.startsWith('AP-DIRECT-REVERSE:') || ref.startsWith('AP-CONSUME:') || ref.startsWith('AP-VOID:') || ref.startsWith('TRZPAY-REVERSE:')) {
    throw new Error('This row is itself a reversal/consumption adjustment, not an original direct payment — nothing to reverse')
  }
  if (ref.startsWith('TRZPAY-')) {
    throw new Error('This row was created by a Treasury payment — reverse it with reversePayment(paymentOrderId), not reverseDirectPayment')
  }

  let reversalId: number | null = null
  if (p.gl_entry_id) {
    const rev = await reverseEntry(p.gl_entry_id, userId)
    reversalId = rev.reversalId
  }

  const vendorId = p.vendor_id
  const invId = p.document_id
  const today = new Date().toISOString().slice(0, 10)
  const revReference = `AP-DIRECT-REVERSE:${paymentId}`

  const amountReversed = await withTransaction(async query => {
    await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`treasury_ap_allocate:vendor:${vendorId}`])
    const already = (await query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_payments WHERE reference=$1`, [revReference]))[0]
    if (already.c > 0) return 0

    const amt = Math.round(Number(p.amount) * 100) / 100
    await query(
      `INSERT INTO purchase_payments (vendor_id, document_id, date, amount, method, reference, created_by, gl_entry_id, note, created_at) VALUES ($1,$2,$3,$4,'bank',$5,$6,$7,$8,${NOW})`,
      [vendorId, invId, today, -amt, revReference, userId ?? null, p.gl_entry_id, `Reversed direct AP payment #${paymentId}`])

    const row = (await query<{ s: number; total: number; status: string }>(
      `SELECT COALESCE((SELECT SUM(amount) FROM purchase_payments WHERE document_id=$1),0)::float AS s, total::float AS total, status
       FROM purchase_documents WHERE id=$1`, [invId]))[0]
    const paid = Math.max(0, Math.round(Number(row.s) * 100) / 100)
    if (row.status !== 'void') {
      const status = purchaseInvoiceStatus(Number(row.total), paid)
      await query(`UPDATE purchase_documents SET paid_total=$2, status=$3, updated_at=${NOW} WHERE id=$1`, [invId, paid, status])
    } else {
      await query(`UPDATE purchase_documents SET paid_total=$2, updated_at=${NOW} WHERE id=$1`, [invId, paid])
    }
    return amt
  })

  return { reversalId, alreadyReversed: amountReversed === 0, amountReversed }
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

/**
 * Convert an upstream doc (e.g. PR→PO, PO→GRN, GRN→invoice) copying its lines.
 *
 * Phase-8 returns audit finding: the "this invoice hasn't already been
 * returned" check (`prior`) and the actual return-document insert
 * (`saveDocument`) ran as two SEPARATE, unlocked operations — two genuinely
 * concurrent `convertDocument(invoiceId, 'return', ...)` calls on the same
 * purchase invoice could both read `prior=0` and both create a full return,
 * a real double-return (200% of the invoice credited, not merely over an
 * amount cap — purchase returns in this codebase copy the FULL invoice).
 * Fixed for the return/credit_note-against-invoice path specifically (every
 * other conversion — PR→PO, PO→GRN, GRN→invoice — has no such duplicate-
 * return invariant to protect and is left as a plain, unlocked read + a
 * self-transactional saveDocument call, matching prior behavior exactly):
 * the prior-return check and the saveDocument insert now share ONE
 * transaction locked per source invoice id, via saveDocument's
 * externalQuery parameter.
 */
// ERPFIX-3 (BUG-ERP-04): the status GUARD a conversion's SOURCE must be in.
// `request->order/rfq/quotation` genuinely requires the request's own
// approval (live-proven: every real procurement cycle approves the PR
// before converting it — see verify-erpfix-3.ts and sim-2621.ts).
// `order->receipt`/`order->invoice`/`receipt->invoice` do NOT have a
// separate "order approval" status in this codebase's real lifecycle — an
// order created by converting an already-approved request stays `draft`
// and is received/invoiced directly from there (confirmed live against
// sim-2621.ts, the 24-month CFO simulation, per the master prompt's own
// stop_condition: a guard that breaks an already-verified real workflow is
// a guess, not a fact, and must not ship). Those three only exclude the
// terminal bad states a conversion must never start from.
const PURCHASE_CONVERT_STATUS_GUARD: Record<string, readonly string[]> = {
  'request->order': ['approved'],
  'request->rfq': ['approved'],
  'request->quotation': ['approved'],
}
const PURCHASE_CONVERT_DENY_STATUS: Record<string, readonly string[]> = {
  'order->receipt': ['void', 'rejected'],
  'order->invoice': ['void', 'rejected'],
  'receipt->invoice': ['void', 'rejected', 'draft'],
}
// Which source-line column downstream lines reference, for the value-based
// duplicate-conversion guard below (BUG-ERP-04) — only the three relations
// that already exist on purchase_document_lines.
const PURCHASE_CONVERT_RELATION: Record<string, 'po_line_id' | 'receipt_line_id'> = {
  'order->receipt': 'po_line_id',
  'order->invoice': 'po_line_id',
  'receipt->invoice': 'receipt_line_id',
}
/** Thrown by convertDocument for a caller-facing business rule (not a bug) —
 * the route maps this prefix to a proper bilingual 409, exactly like the
 * existing THREE_WAY_MATCH_FAILED convention on the payment path. */
export class PurchaseConvertError extends Error {
  constructor(message: string) { super(`PURCHASE_CONVERT_BLOCKED: ${message}`) }
}
/** ERPFIX-4 (BUG-ERP-15): same stable-prefix convention, for saveDocument's
 * post-lock edit guard. */
export class PurchaseDocLockedError extends Error {
  constructor(message: string) { super(`PURCHASE_DOC_LOCKED: ${message}`) }
}

export async function convertDocument(sourceId: number, toType: PurchaseDocType, userId?: string): Promise<number> {
  const src = await getDocument(sourceId)
  if (!src) throw new Error('Source not found')
  const isReturn = (toType === 'credit_note' || toType === 'return') && src.doc_type === 'invoice'
  const guardKey = `${src.doc_type}->${toType}`
  const allowedStatuses = PURCHASE_CONVERT_STATUS_GUARD[guardKey]
  if (allowedStatuses && !allowedStatuses.includes(String(src.status))) {
    throw new PurchaseConvertError(`a ${src.doc_type} in status "${src.status}" cannot convert to ${toType}`)
  }
  const deniedStatuses = PURCHASE_CONVERT_DENY_STATUS[guardKey]
  if (deniedStatuses && deniedStatuses.includes(String(src.status))) {
    throw new PurchaseConvertError(`a ${src.doc_type} in status "${src.status}" cannot convert to ${toType}`)
  }
  const srcLines = src.lines as unknown as (LineRow & { id: number })[]
  const relationCol = PURCHASE_CONVERT_RELATION[guardKey]
  // ERPFIX-3 (BUG-ERP-04): value-based duplicate-conversion guard. For the
  // three relations purchase_document_lines actually tracks, the qty
  // already converted downstream (summed over every non-void child line
  // referencing this source line) is subtracted — a second FULL conversion
  // of an already-fully-converted line now carries ZERO remaining qty
  // instead of silently duplicating the whole line again (the exact shape
  // of "a PO converted to invoice twice = two invoices").
  const remainingByLineId = new Map<number, number>()
  if (relationCol) {
    for (const l of srcLines) {
      const already = num((await pgQuery<{ s: number }>(
        `SELECT COALESCE(SUM(pl.qty),0)::float AS s FROM purchase_document_lines pl
         JOIN purchase_documents d ON d.id = pl.document_id
         WHERE pl.${relationCol} = $1 AND d.status <> 'void'`, [l.id]))[0]?.s)
      remainingByLineId.set(l.id, Math.max(0, num(l.qty) - already))
    }
  }
  const lines = srcLines
    .map(l => {
      const qty = relationCol ? (remainingByLineId.get(l.id) ?? num(l.qty)) : num(l.qty)
      const row: LineRow = { description: l.description, qty, unitPrice: num(l.unitPrice), discountPct: num(l.discountPct), taxPct: num(l.taxPct), productId: l.productId ?? null }
      if (toType === 'receipt' && src.doc_type === 'order') row.poLineId = l.id
      else if (toType === 'invoice' && src.doc_type === 'receipt') { row.receiptLineId = l.id; row.poLineId = l.poLineId ?? null }
      else if (toType === 'invoice' && src.doc_type === 'order') row.poLineId = l.id
      return row
    })
    .filter(l => l.qty > 0.0001)
  if (relationCol && lines.length === 0) {
    throw new PurchaseConvertError('this document has already been fully converted — no remaining quantity')
  }
  if (!isReturn) {
    // ERPFIX-3 (BUG-ERP-04): the full set of financial/organizational
    // columns now travels with the conversion — a USD purchase order used
    // to become an IRR receipt/invoice with the SAME numeric total.
    return saveDocument({
      docType: toType, vendorId: src.vendor_id ?? undefined, date: new Date().toISOString().slice(0, 10),
      currency: src.currency ?? 'IRR', exchangeRate: num(src.exchange_rate) || 1, department: src.department ?? undefined,
      budget: num(src.budget) || undefined, priority: src.priority ?? undefined,
      costCenterId: src.cost_center_id ?? null, companyId: src.company_id ?? null, sourceId, lines,
    }, userId)
  }
  // BUG-013 sibling (26.26): a purchase return/credit_note against an invoice must
  // be guarded exactly like the sales side — only a confirmed/posted invoice, and
  // the cumulative return may not exceed the invoice total (else AP goes negative).
  if (['draft', 'void'].includes(String(src.status))) throw new Error('Only a confirmed purchase invoice can be returned')
  const newId = await withTransaction(async query => {
    await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`purchase_invoice_return:${sourceId}`])
    // convertDocument copies the FULL invoice, so any prior non-void return means
    // the invoice is already fully returned → block the duplicate (idempotency).
    const prior = num((await query<{ s: number }>(
      `SELECT COALESCE(SUM(total),0)::float AS s FROM purchase_documents WHERE source_id=$1 AND doc_type IN ('credit_note','return') AND status<>'void'`, [sourceId]))[0]?.s)
    if (prior > 0.001) throw new Error('This invoice has already been returned')
    return saveDocument({
      docType: toType, vendorId: src.vendor_id ?? undefined, date: new Date().toISOString().slice(0, 10),
      currency: src.currency ?? 'IRR', exchangeRate: num(src.exchange_rate) || 1, costCenterId: src.cost_center_id ?? null,
      companyId: src.company_id ?? null, sourceId, lines,
    }, userId, query)
  })
  // If the invoice was already paid, the vendor owes us back — flag until settled.
  // Best-effort, after commit (never blocks the return itself).
  const paid = num((await pgQuery<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE vendor_id=$1`, [src.vendor_id ?? 0]))[0]?.s)
  if (paid > 0) {
    try {
      await pgQuery(
        `INSERT INTO business_alerts (kind, domain, severity, title_en, title_fa, detail, ref_type, ref_id, channels, fingerprint, updated_at)
         VALUES ('purchase_return_pending','financial','warning','Purchase return awaiting vendor settlement','برگشت خرید در انتظار تسویه فروشنده',$1,'purchase_documents',$2,'["inapp"]',$3,to_char(now(),'YYYY-MM-DD HH24:MI:SS'))
         ON CONFLICT (fingerprint) DO UPDATE SET updated_at=to_char(now(),'YYYY-MM-DD HH24:MI:SS')`,
        [`Vendor credit of ${num(src.total)} — apply to a future PO or record a refund receipt.`, sourceId, `purchase_return_pending:${sourceId}`])
    } catch { /* alert is best-effort */ }
  }
  return newId
}

// ── GL posting ───────────────────────────────────────────────────────────────
import { purchaseInvoicePostingLinesByClass, postingBalanced, type ClassifiedPurchaseLine, type PurchaseLineClass } from './purchasing'

/**
 * Post a confirmed purchase invoice — OR a purchase return/credit_note
 * against one — into the double-entry GL (idempotent).
 *
 * ERPFIX-5 (BUG-ERP-11): lines are classified ('stock'→1200, 'expense'→6300,
 * 'fixed_asset'→1500) instead of always debiting inventory — a service or
 * fixed-asset invoice no longer silently inflates inventory value.
 * ERPFIX-5 (BUG-ERP-13): a credit_note/return against an invoice now ALSO
 * posts — the SAME classified lines, with debit/credit mirrored (Dr AP /
 * Cr the original class account + Cr VAT input) — closing the gap where a
 * confirmed purchase return left AP financially untouched on the books.
 * Returns the created journal entry id, or the existing one if already posted.
 */
export async function postPurchaseInvoiceToGl(docId: number, userId?: string): Promise<{ entryId: number; alreadyPosted: boolean }> {
  const d = (await pgQuery<{ doc_type: string; status: string; subtotal: number; discount_total: number; tax_total: number; total: number; gl_entry_id: number | null; doc_no: string | null; date: string | null; company_id: number | null; cost_center_id: number | null; currency: string | null; exchange_rate: number | null }>(
    `SELECT doc_type, status, subtotal, discount_total, tax_total, total, gl_entry_id, doc_no, date, company_id, cost_center_id, currency, exchange_rate FROM purchase_documents WHERE id=$1`, [docId]))[0]
  if (!d) throw new Error('Document not found')
  if (d.gl_entry_id) return { entryId: d.gl_entry_id, alreadyPosted: true }
  const isReturn = d.doc_type === 'credit_note' || d.doc_type === 'return'
  if (d.doc_type !== 'invoice' && !isReturn) throw new Error('Only purchase invoices or credit notes/returns post to the GL')
  if (['draft', 'void'].includes(d.status)) throw new Error('Confirm the document before posting')

  const rate = num(d.exchange_rate) || 1
  const fxCurrency = d.currency && d.currency !== 'IRR' ? d.currency : null

  // ERPFIX-5 (BUG-ERP-11): classify each line (defaults to the derived
  // class saved at insertLines time — a document with NO lines at all, the
  // shape every pre-existing fixture/regression that inserts a
  // purchase_documents row directly uses, falls back to a single 'stock'
  // line of the WHOLE net/tax — byte-for-byte the historical behavior, so
  // every prior regression that never touches purchase_document_lines
  // keeps posting to 1200 exactly as before this fix.
  const lineRows = await pgQuery<{ qty: number; unit_price: number; discount_pct: number; tax_pct: number; line_class: PurchaseLineClass | null }>(
    `SELECT qty::float AS qty, unit_price::float AS unit_price, discount_pct::float AS discount_pct, tax_pct::float AS tax_pct, line_class
     FROM purchase_document_lines WHERE document_id=$1`, [docId])
  const classified: ClassifiedPurchaseLine[] = lineRows.length
    ? lineRows.map(l => {
        const gross = num(l.qty) * num(l.unit_price)
        const net = gross * (1 - num(l.discount_pct) / 100)
        const tax = net * (num(l.tax_pct) / 100)
        return { amount: toBase(net, rate), taxAmount: toBase(tax, rate), lineClass: l.line_class ?? 'stock' }
      })
    : [{ amount: toBase(num(d.subtotal) - num(d.discount_total), rate), taxAmount: toBase(num(d.tax_total), rate), lineClass: 'stock' as const }]

  const baseTotal = Math.round(classified.reduce((s, c) => s + c.amount + c.taxAmount, 0) * 100) / 100
  // 26.23: account codes flow through the configurable erp_settings map.
  let lines = applyGlMap(purchaseInvoicePostingLinesByClass(classified), await loadGlMap())
  if (isReturn) lines = lines.map(l => ({ ...l, debit: l.credit, credit: l.debit }))
  if (!postingBalanced(lines)) throw new Error('Posting does not balance')
  const net = num(d.subtotal) - num(d.discount_total)
  const tax = num(d.tax_total)
  const fxByCode: Record<string, number> = fxCurrency ? { '1200': net, '2100': tax, '2000': num(d.total) } : {}

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
  // Phase-7 finance audit finding: same class as the sales-invoice fix — the
  // gl_entry_id-null pre-check ran outside any lock, so two concurrent posts
  // for the same invoice could both post a duplicate GL entry. Re-verified
  // inside the lock before inserting.
  const result = await withTransaction(async query => {
    await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`purchase_doc_gl_post:${docId}`])
    const already = (await query<{ gl_entry_id: number | null }>(`SELECT gl_entry_id FROM purchase_documents WHERE id=$1`, [docId]))[0]
    if (already?.gl_entry_id) return { entryId: already.gl_entry_id, alreadyPosted: true }
    // Carry the document's company + currency onto the entry (tenancy + multi-currency).
    const entry = (await query<{ id: number }>(
      `INSERT INTO gl_journal_entries (entry_no, date, memo, reference, status, total, created_by, period_id, company_id, currency, exchange_rate, created_at, posted_at)
       VALUES ($1, $2, $3, $4, 'posted', $5, $6, $7, $8, $9, $10, ${NOW}, ${NOW}) RETURNING id`,
      [entryNo, glDate, isReturn ? `Purchase credit note ${d.doc_no ?? docId}` : `Purchase invoice ${d.doc_no ?? docId}`,
       isReturn ? `PURCN-${docId}` : `PUR-${docId}`, baseTotal, userId ?? null, gate.periodId ?? null,
       d.company_id ?? null, d.currency ?? 'IRR', rate]))[0]
    let ln = 0
    for (const l of lines) {
      // Cost-center from the document flows onto every posting line (26.11 analytics).
      const fx = fxByCode[l.accountCode]
      await query(`INSERT INTO gl_journal_lines (entry_id, account_id, debit, credit, memo, line_no, cost_center_id, fx_amount, fx_currency) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [entry.id, idOf.get(l.accountCode), l.debit, l.credit, l.memo, ln++, d.cost_center_id ?? null, fx !== undefined ? fx : null, fx !== undefined ? fxCurrency : null])
    }
    await query(`UPDATE purchase_documents SET gl_entry_id=$2, updated_at=${NOW} WHERE id=$1`, [docId, entry.id])
    return { entryId: entry.id, alreadyPosted: false }
  })
  return result
}

/**
 * Confirm a draft purchase invoice and auto-post it to the GL (26.24b BUG-008).
 * Mirrors the sales confirm→auto-post path: a closed fiscal period fails loudly
 * and the status is rolled back so the invoice never ends up "confirmed but
 * never credited to AP" (the asymmetry that let AP drift negative on payment).
 * Idempotent via the gl_entry_id guard inside postPurchaseInvoiceToGl.
 */
/**
 * Item 5 (bug-fix pack): confirming a purchase invoice adds the invoiced
 * quantities to warehouse stock, the same way GRN receiving already does —
 * for the common workflow where an operator records the vendor's invoice
 * directly, with no separate goods-receipt step in between.
 *
 * Guarded against double-stocking: if the invoice's immediate source
 * document is itself a 'receipt' (GRN), the goods were already moved into
 * the warehouse by `receiveDocument` at receiving time, so confirming the
 * invoice must NOT move stock a second time. Idempotent via a `ref` marker
 * check (`PINV <docNo>`) — a retried confirm never double-stocks.
 */
async function stockPurchaseInvoice(docId: number, warehouseId: number | undefined, userId?: string): Promise<void> {
  const doc = (await pgQuery<{ doc_no: string | null; source_id: number | null; exchange_rate: number | null }>(
    `SELECT doc_no, source_id, exchange_rate::float AS exchange_rate FROM purchase_documents WHERE id=$1`, [docId]))[0]
  if (!doc) return
  const lines = await pgQuery<{ id: number; qty: number; unit_price: number; product_id: number | null }>(
    `SELECT id, qty::float AS qty, unit_price::float AS unit_price, product_id FROM purchase_document_lines WHERE document_id=$1 ORDER BY sort_order, id`, [docId])
  const productLines = lines.filter(l => l.product_id != null)
  if (productLines.length === 0) return // service-only invoice — nothing to stock

  if (doc.source_id != null) {
    const src = (await pgQuery<{ doc_type: string }>(`SELECT doc_type FROM purchase_documents WHERE id=$1`, [doc.source_id]))[0]
    if (src?.doc_type === 'receipt') return // already moved into the warehouse at GRN time
  }

  const ref = `PINV ${doc.doc_no ?? docId}`
  const already = (await pgQuery<{ id: number }>(`SELECT id FROM inv_moves WHERE ref=$1 LIMIT 1`, [ref]))[0]
  if (already) return // idempotent — a retried confirm never double-stocks

  let wh = warehouseId
  if (!wh) {
    const w = (await pgQuery<{ id: number }>(`SELECT id FROM inv_warehouses WHERE active=1 ORDER BY id LIMIT 1`))[0]
    if (!w) throw new Error('No active warehouse exists — create one before confirming a stocked invoice')
    wh = w.id
  }
  const rate = num(doc.exchange_rate) || 1
  for (const l of productLines) {
    await pgQuery(
      `INSERT INTO inv_moves (product_id, warehouse_id, type, qty, unit_cost, ref, created_by, created_at)
       VALUES ($1,$2,'receipt',$3,$4,$5,$6,${NOW})`,
      [l.product_id, wh, num(l.qty), num(l.unit_price) * rate, ref, userId ?? null])
    // ERPFIX-6 (BUG-ERP-12): informational last-price tracking — see the
    // identical note at the GRN receive path above.
    await pgQuery(`UPDATE inv_products SET last_cost=$2, updated_at=${NOW} WHERE id=$1`, [l.product_id, num(l.unit_price) * rate])
  }
}

/**
 * ERPFIX-5 (BUG-ERP-13, decision_gate answered): a purchase return/credit_note
 * is ALWAYS fully recorded financially (never blocked by a stock shortfall —
 * the warehouse keeper issues the full document regardless). Physically,
 * each product line is returned out of stock up to whatever is actually on
 * hand; any shortfall (the item was already sold/consumed elsewhere) is
 * reported via a business_alert rather than silently dropped or blocking the
 * document. A line with no product_id (a service credit) has nothing to
 * deduct. Idempotent via the same `ref` marker pattern as stockPurchaseInvoice.
 */
async function deductReturnedStock(docId: number, userId?: string): Promise<{ shortfalls: { productId: number; requested: number; deducted: number }[] }> {
  const doc = (await pgQuery<{ doc_no: string | null }>(`SELECT doc_no FROM purchase_documents WHERE id=$1`, [docId]))[0]
  if (!doc) return { shortfalls: [] }
  const ref = `PRET ${doc.doc_no ?? docId}`
  const already = (await pgQuery<{ id: number }>(`SELECT id FROM inv_moves WHERE ref=$1 LIMIT 1`, [ref]))[0]
  if (already) return { shortfalls: [] } // idempotent — a retried confirm never double-deducts
  const lines = await pgQuery<{ qty: number; unit_price: number; product_id: number | null }>(
    `SELECT qty::float AS qty, unit_price::float AS unit_price, product_id FROM purchase_document_lines WHERE document_id=$1 ORDER BY sort_order, id`, [docId])
  const shortfalls: { productId: number; requested: number; deducted: number }[] = []
  for (const l of lines) {
    if (l.product_id == null) continue
    const onHand = num((await pgQuery<{ s: number }>(
      `SELECT COALESCE(SUM(qty),0)::float AS s FROM inv_moves WHERE product_id=$1`, [l.product_id]))[0]?.s)
    const requested = num(l.qty)
    const deducted = Math.max(0, Math.min(requested, onHand))
    if (deducted > 0) {
      const wh = (await pgQuery<{ id: number }>(
        `SELECT warehouse_id AS id FROM inv_moves WHERE product_id=$1 GROUP BY warehouse_id ORDER BY SUM(qty) DESC LIMIT 1`, [l.product_id]))[0]
      await pgQuery(
        `INSERT INTO inv_moves (product_id, warehouse_id, type, qty, unit_cost, ref, created_by, created_at)
         VALUES ($1,$2,'return',$3,$4,$5,$6,${NOW})`,
        [l.product_id, wh?.id ?? null, -deducted, num(l.unit_price), ref, userId ?? null])
    }
    if (deducted < requested) shortfalls.push({ productId: l.product_id, requested, deducted })
  }
  if (shortfalls.length) {
    try {
      await pgQuery(
        `INSERT INTO business_alerts (kind, domain, severity, title_en, title_fa, detail, ref_type, ref_id, fingerprint, updated_at)
         VALUES ('insufficient_stock_for_return','operational','warning','Purchase return exceeds on-hand stock','موجودی برگشت خرید کافی نیست',$1,'purchase_documents',$2,$3,${NOW})
         ON CONFLICT (fingerprint) DO UPDATE SET updated_at=${NOW}, detail=$1`,
        [shortfalls.map(s => `product #${s.productId}: requested ${s.requested}, only ${s.deducted} deducted`).join('; '),
         docId, `insufficient_stock_for_return:${docId}`])
    } catch { /* alert is best-effort */ }
  }
  return { shortfalls }
}

export async function confirmPurchaseInvoice(docId: number, userId?: string, warehouseId?: number): Promise<{ status: PurchaseStatus; entryId: number | null; stockShortfalls?: { productId: number; requested: number; deducted: number }[] }> {
  const d = (await pgQuery<{ doc_type: string; status: string; vendor_id: number | null }>(`SELECT doc_type, status, vendor_id FROM purchase_documents WHERE id=$1`, [docId]))[0]
  if (!d) throw new Error('Document not found')
  const isReturn = d.doc_type === 'credit_note' || d.doc_type === 'return'
  if (d.doc_type !== 'invoice' && !isReturn) throw new Error('Only purchase invoices or credit notes/returns can be confirmed to the GL')
  if (d.status === 'void') throw new Error('Voided documents cannot be confirmed')
  const prev = d.status
  await pgQuery(`UPDATE purchase_documents SET status='confirmed', updated_at=${NOW} WHERE id=$1`, [docId])
  let entryId: number | null
  let stockShortfalls: { productId: number; requested: number; deducted: number }[] | undefined
  try {
    const res = await postPurchaseInvoiceToGl(docId, userId)
    entryId = res.entryId
    if (isReturn) stockShortfalls = (await deductReturnedStock(docId, userId)).shortfalls
    else await stockPurchaseInvoice(docId, warehouseId, userId)
  } catch (err) {
    await pgQuery(`UPDATE purchase_documents SET status=$2, updated_at=${NOW} WHERE id=$1`, [docId, prev])
    throw err
  }
  if (isReturn) return { status: 'confirmed', entryId, stockShortfalls }
  // Phase 12: a freshly confirmed/open invoice is exactly the "future
  // invoice" a vendor's pre-existing unapplied Treasury cash (Phase 11) was
  // waiting for — settle any of it against this vendor's now-open invoices
  // (including this one). Its own transaction, locked per vendor (see
  // consumeUnappliedForVendor) — deliberately OUTSIDE the try/catch above:
  // the GL post already committed by this point, so a consumption failure
  // must never trigger the GL-post-failure revert (which would leave a
  // real posted GL entry behind a document whose status was rolled back —
  // an inconsistent state neither of these two failure modes should ever
  // produce). A consumption failure here surfaces to the caller as-is,
  // exactly like any other genuine defect — never silently swallowed.
  if (d.vendor_id != null && userId) {
    const { consumeUnappliedForVendor } = await import('@/lib/treasury/paymentData')
    await consumeUnappliedForVendor(d.vendor_id, userId)
  }
  return { status: 'confirmed', entryId }
}

// ── Phase 13: reverse payment allocations on invoice cancellation ───────────
/**
 * Phase 13: reverses every currently-un-reversed positive `purchase_payments`
 * allocation row against a purchase invoice — direct `recordPayment`,
 * Treasury `processPayment` AP allocation (Phase 10), and Phase 12
 * `consumeUnappliedForVendor` rows are all the SAME row shape
 * (`document_id=<invoiceId>, amount>0`), so ONE mechanism reverses all three
 * sources uniformly — no per-source special-casing.
 *
 * Design (docs/engineering/phase13-purchase-invoice-cancellation-audit.md):
 * append-only, no mutation, no migration. For each un-reversed positive row
 * P against this invoice, writes a matched pair sharing `reference =
 * 'AP-VOID:'||P.id`:
 *   - a NEGATIVE row against the SAME invoice (document_id=docId, -P.amount)
 *     — nets this specific allocation back to zero, so `paid_total` (kept in
 *     exact sync with `SUM(amount) WHERE document_id=docId` by every writer)
 *     returns to 0 once every row is reversed.
 *   - a POSITIVE row with document_id=NULL (+P.amount) — the money the
 *     vendor already received does not disappear on cancellation; it
 *     returns to the SAME unapplied pool Phase 11/12 already established,
 *     immediately available for `consumeUnappliedForVendor` to apply to a
 *     future invoice. This is the deterministic answer to "where does
 *     consumed-then-cancelled money go": back to unapplied, uniformly,
 *     regardless of whether it was originally a direct payment, a Treasury
 *     allocation, or itself a Phase-12 consumption row.
 * Both rows carry P's own `gl_entry_id` (never NULL) — the same reason
 * Phase 12 did this: `postPurchasePaymentToGl` treats `gl_entry_id IS NULL`
 * as an unposted real cash payment and would post a phantom Dr AP/Cr Bank
 * entry otherwise. Un-earmarking already-moved cash is a pure subledger
 * reclassification — zero new GL events, the same principle Phase 12
 * established and Section 5 of this phase requires preserving.
 *
 * Idempotent by construction (the `NOT EXISTS ... AP-VOID:` filter — a
 * second call finds nothing left to reverse) and locked on the SAME
 * `treasury_ap_allocate:vendor:${vendorId}` advisory key Phase 11/12 already
 * use for their own AP-allocation sections, so a cancellation can never
 * interleave with a concurrent Treasury payment or consumption run for the
 * same vendor.
 */
export async function reversePurchaseInvoicePaymentAllocations(docId: number, userId?: string): Promise<{ totalReversed: number; details: { sourceRowId: number; amount: number }[] }> {
  const d = (await pgQuery<{ vendor_id: number | null }>(`SELECT vendor_id FROM purchase_documents WHERE id=$1`, [docId]))[0]
  if (!d || d.vendor_id == null) return { totalReversed: 0, details: [] }
  const vendorId = d.vendor_id
  const today = new Date().toISOString().slice(0, 10)
  return withTransaction(async query => {
    await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`treasury_ap_allocate:vendor:${vendorId}`])
    const rows = await query<{ id: number; amount: number; gl_entry_id: number | null }>(
      `SELECT p.id, p.amount::float AS amount, p.gl_entry_id
       FROM purchase_payments p
       WHERE p.document_id = $1 AND p.amount > 0
         AND NOT EXISTS (SELECT 1 FROM purchase_payments r WHERE r.reference = 'AP-VOID:'||p.id)
       ORDER BY p.id`, [docId])

    const details: { sourceRowId: number; amount: number }[] = []
    let totalReversed = 0
    for (const r of rows) {
      const amt = Math.round(Number(r.amount) * 100) / 100
      await query(
        `INSERT INTO purchase_payments (vendor_id, document_id, date, amount, method, reference, created_by, gl_entry_id, note, created_at) VALUES ($1,$2,$3,$4,'bank',$5,$6,$7,$8,${NOW})`,
        [vendorId, docId, today, -amt, `AP-VOID:${r.id}`, userId ?? null, r.gl_entry_id, `Reversed on invoice #${docId} void (source payment #${r.id})`])
      await query(
        `INSERT INTO purchase_payments (vendor_id, document_id, date, amount, method, reference, created_by, gl_entry_id, note, created_at) VALUES ($1,NULL,$2,$3,'bank',$4,$5,$6,$7,${NOW})`,
        [vendorId, today, amt, `AP-VOID:${r.id}`, userId ?? null, r.gl_entry_id, `Returned to unapplied balance — invoice #${docId} voided`])
      details.push({ sourceRowId: r.id, amount: amt })
      totalReversed = Math.round((totalReversed + amt) * 100) / 100
    }

    if (rows.length) {
      const remaining = (await query<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE document_id=$1`, [docId]))[0]
      await query(`UPDATE purchase_documents SET paid_total=$2, updated_at=${NOW} WHERE id=$1`, [docId, Math.max(0, Math.round(Number(remaining.s) * 100) / 100)])
    }
    return { totalReversed, details }
  })
}

/**
 * Void a purchase invoice. If it was posted to the GL, book a balanced REVERSAL
 * entry (reuses the 26.23 reverseEntry mechanism → two-way reversal_of/reversed_by
 * linkage). Idempotent — re-voiding a posted+reversed doc books nothing new.
 * Phase 13: also reverses every payment allocation this invoice received —
 * see `reversePurchaseInvoicePaymentAllocations` — restoring the vendor's
 * correct AP position and returning any consumed unapplied cash to the
 * unapplied pool. Independently idempotent from the GL reversal above; a
 * repeat void call (or two concurrent ones) produces exactly one of each.
 */
export async function voidPurchaseInvoice(docId: number, userId?: string): Promise<{ status: PurchaseStatus; reversalId: number | null; paymentsReversed: number }> {
  const d = (await pgQuery<{ status: string; gl_entry_id: number | null; vendor_id: number | null }>(`SELECT status, gl_entry_id, vendor_id FROM purchase_documents WHERE id=$1`, [docId]))[0]
  if (!d) throw new Error('Document not found')
  let reversalId: number | null = null
  if (d.gl_entry_id) reversalId = (await reverseEntry(Number(d.gl_entry_id), userId)).reversalId
  let paymentsReversed = 0
  if (d.vendor_id != null) {
    paymentsReversed = (await reversePurchaseInvoicePaymentAllocations(docId, userId)).totalReversed
  }
  await pgQuery(`UPDATE purchase_documents SET status='void', updated_at=${NOW} WHERE id=$1`, [docId])
  return { status: 'void', reversalId, paymentsReversed }
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
  // ERPFIX-8 (BUG-ERP-22): used to fetch EVERY document then .slice(0,8) in
  // JS — the LIMIT is now in the SQL itself (listDocuments defaults to a
  // bounded page; here it only ever needs 8).
  const recent = await listDocuments(undefined, { limit: 8 })
  return { kpis, topVendors, recent }
}
