/**
 * Purchasing data layer (Phase 26.1) — PostgreSQL access for procure-to-pay.
 * Pure logic lives in `purchasing.ts`; totals/approval/scoring come from there.
 */
import { pgQuery } from '@/lib/db'
import { nextNumber } from '@/lib/numbering/integrate'
import { rialRateFor } from './currencyData'
import {
  documentTotals, requiredApprovalLevels, isFullyApproved, vendorScore, vendorPayable,
  purchaseInvoiceStatus, purchaseKpis, validateBudget, type LineInput, type PurchaseDocType, type PurchaseStatus,
} from './purchasing'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const num = (v: unknown) => Number(v ?? 0)

export interface VendorInput {
  code?: string; name: string; kind?: string; email?: string; phone?: string
  taxId?: string; economicCode?: string; address?: string; iban?: string
  currency?: string; paymentTerms?: number
}
export interface LineRow extends LineInput { description: string; productId?: number | null }

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

export async function vendorPosition(vendorId: number) {
  const inv = num((await pgQuery<{ t: number }>(`SELECT COALESCE(SUM(total),0) AS t FROM purchase_documents WHERE vendor_id=$1 AND doc_type='invoice' AND status NOT IN ('void','draft')`, [vendorId]))[0]?.t)
  const paid = num((await pgQuery<{ t: number }>(`SELECT COALESCE(SUM(amount),0) AS t FROM purchase_payments WHERE vendor_id=$1`, [vendorId]))[0]?.t)
  const cn = num((await pgQuery<{ t: number }>(`SELECT COALESCE(SUM(total),0) AS t FROM purchase_documents WHERE vendor_id=$1 AND doc_type='credit_note' AND status NOT IN ('void','draft')`, [vendorId]))[0]?.t)
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
  const lines = await pgQuery(`SELECT id, description, qty::float AS qty, unit_price::float AS "unitPrice", discount_pct::float AS "discountPct", tax_pct::float AS "taxPct", product_id AS "productId", received_qty::float AS "receivedQty" FROM purchase_document_lines WHERE document_id=$1 ORDER BY sort_order, id`, [id])
  const approvals = await pgQuery(`SELECT level, decision, approver_id AS "approverId", comment, created_at AS "createdAt" FROM purchase_approvals WHERE document_id=$1 ORDER BY created_at`, [id])
  return { ...d, lines, approvals }
}

export async function saveDocument(input: {
  id?: number; docType: PurchaseDocType; vendorId?: number; date: string; currency?: string
  department?: string; budget?: number; sourceId?: number; note?: string; priority?: string; lines: LineRow[]
}, userId?: string): Promise<number> {
  const totals = documentTotals(input.lines)
  const rate = (await rialRateFor(input.currency ?? 'IRR')) ?? 1
  const baseTotal = Math.round(totals.total * rate * 100) / 100
  if (input.id) {
    await pgQuery(
      `UPDATE purchase_documents SET vendor_id=$2, date=$3, currency=COALESCE($4,currency), department=$5, budget=$6,
        note=$7, subtotal=$8, discount_total=$9, tax_total=$10, total=$11, priority=COALESCE($12,priority), exchange_rate=$13, base_total=$14, updated_at=${NOW} WHERE id=$1`,
      [input.id, input.vendorId ?? null, input.date, input.currency ?? null, input.department ?? null, input.budget ?? 0,
       input.note ?? null, totals.subtotal, totals.discountTotal, totals.taxTotal, totals.total, input.priority ?? null, rate, baseTotal])
    await pgQuery(`DELETE FROM purchase_document_lines WHERE document_id=$1`, [input.id])
    await insertLines(input.id, input.lines)
    return input.id
  }
  const docNo = await nextNumber(`purchase_${input.docType}`, { legacyPrefix: input.docType.toUpperCase().slice(0, 3) })
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO purchase_documents (doc_no,doc_type,vendor_id,date,currency,department,budget,source_id,note,subtotal,discount_total,tax_total,total,priority,created_by,exchange_rate,base_total,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,${NOW},${NOW}) RETURNING id`,
    [docNo, input.docType, input.vendorId ?? null, input.date, input.currency ?? 'IRR', input.department ?? null, input.budget ?? 0,
     input.sourceId ?? null, input.note ?? null, totals.subtotal, totals.discountTotal, totals.taxTotal, totals.total, input.priority ?? 'normal', userId ?? null, rate, baseTotal]))[0]
  await insertLines(row.id, input.lines)
  return row.id
}
async function insertLines(docId: number, lines: LineRow[]) {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    await pgQuery(`INSERT INTO purchase_document_lines (document_id,description,qty,unit_price,discount_pct,tax_pct,sort_order,product_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [docId, l.description, l.qty, l.unitPrice, l.discountPct, l.taxPct, i, l.productId ?? null])
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
export async function receiveDocument(
  docId: number, warehouseId: number,
  linesIn?: { lineId: number; qty: number }[], userId?: string,
): Promise<{ ok: boolean; error?: string; received: number; status?: string }> {
  const doc = (await pgQuery<{ doc_type: string; status: string; doc_no: string | null }>(
    `SELECT doc_type, status, doc_no FROM purchase_documents WHERE id=$1`, [docId]))[0]
  if (!doc) return { ok: false, error: 'Document not found', received: 0 }
  if (doc.doc_type !== 'receipt') return { ok: false, error: 'Only goods-receipt (GRN) documents can be received', received: 0 }
  if (['void', 'rejected'].includes(doc.status)) return { ok: false, error: 'Document is not receivable', received: 0 }
  const lines = await pgQuery<{ id: number; qty: number; unit_price: number; product_id: number | null; received_qty: number }>(
    `SELECT id, qty::float AS qty, unit_price::float AS unit_price, product_id, received_qty::float AS received_qty
     FROM purchase_document_lines WHERE document_id=$1 ORDER BY sort_order, id`, [docId])
  const wanted = new Map((linesIn ?? []).map(l => [l.lineId, Math.max(0, l.qty)]))
  let received = 0
  for (const l of lines) {
    if (!l.product_id) continue
    const remaining = Math.max(0, num(l.qty) - num(l.received_qty))
    const take = Math.min(remaining, linesIn ? (wanted.get(l.id) ?? 0) : remaining)
    if (take <= 0) continue
    await pgQuery(
      `INSERT INTO inv_moves (product_id, warehouse_id, type, qty, unit_cost, ref, created_by, created_at)
       VALUES ($1,$2,'receipt',$3,$4,$5,$6,${NOW})`,
      [l.product_id, warehouseId, take, num(l.unit_price), `GRN ${doc.doc_no ?? docId}`, userId ?? null])
    await pgQuery(`UPDATE purchase_document_lines SET received_qty = received_qty + $2 WHERE id=$1`, [l.id, take])
    received++
  }
  const after = await pgQuery<{ qty: number; received_qty: number; product_id: number | null }>(
    `SELECT qty::float AS qty, received_qty::float AS received_qty, product_id FROM purchase_document_lines WHERE document_id=$1`, [docId])
  const productLines = after.filter(l => l.product_id)
  const complete = productLines.length === 0 || productLines.every(l => num(l.received_qty) + 0.0001 >= num(l.qty))
  const status = complete ? 'received' : 'partial'
  await pgQuery(`UPDATE purchase_documents SET status=$2, updated_at=${NOW} WHERE id=$1`, [docId, status])
  return { ok: true, received, status }
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

/** Record an approval decision; advance to 'approved' once every level signs. */
export async function decideApproval(id: number, level: number, decision: 'approved' | 'rejected', approverId?: string, comment?: string): Promise<PurchaseStatus> {
  await pgQuery(`INSERT INTO purchase_approvals (document_id,level,decision,approver_id,comment,created_at) VALUES ($1,$2,$3,$4,$5,${NOW})`,
    [id, level, decision, approverId ?? null, comment ?? null])
  if (decision === 'rejected') { await pgQuery(`UPDATE purchase_documents SET status='rejected', updated_at=${NOW} WHERE id=$1`, [id]); return 'rejected' }
  const d = (await pgQuery<{ total: number }>(`SELECT total FROM purchase_documents WHERE id=$1`, [id]))[0]
  const approved = (await pgQuery<{ level: number }>(`SELECT DISTINCT level FROM purchase_approvals WHERE document_id=$1 AND decision='approved'`, [id])).map(r => r.level)
  if (isFullyApproved(num(d.total), approved)) { await pgQuery(`UPDATE purchase_documents SET status='approved', updated_at=${NOW} WHERE id=$1`, [id]); return 'approved' }
  return 'submitted'
}

/** Record a payment against a purchase invoice and recompute its settle status. */
export async function recordPayment(documentId: number, vendorId: number, amount: number, method: string, date: string, reference?: string, userId?: string, currency = 'IRR') {
  const rate = (await rialRateFor(currency)) ?? 1
  await pgQuery(`INSERT INTO purchase_payments (vendor_id,document_id,date,amount,method,reference,created_by,currency,exchange_rate,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,${NOW})`,
    [vendorId, documentId, date, amount, method, reference ?? null, userId ?? null, currency, rate])
  const d = (await pgQuery<{ total: number }>(`SELECT total FROM purchase_documents WHERE id=$1`, [documentId]))[0]
  const paid = num((await pgQuery<{ t: number }>(`SELECT COALESCE(SUM(amount),0) AS t FROM purchase_payments WHERE document_id=$1`, [documentId]))[0]?.t)
  const status = purchaseInvoiceStatus(num(d.total), paid)
  await pgQuery(`UPDATE purchase_documents SET paid_total=$2, status=$3, updated_at=${NOW} WHERE id=$1`, [documentId, paid, status])
}

/** Convert an upstream doc (e.g. PR→PO, PO→GRN, GRN→invoice) copying its lines. */
export async function convertDocument(sourceId: number, toType: PurchaseDocType, userId?: string): Promise<number> {
  const src = await getDocument(sourceId)
  if (!src) throw new Error('Source not found')
  const lines = (src.lines as unknown as LineRow[]).map(l => ({ description: l.description, qty: num(l.qty), unitPrice: num(l.unitPrice), discountPct: num(l.discountPct), taxPct: num(l.taxPct), productId: l.productId ?? null }))
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
  const d = (await pgQuery<{ doc_type: string; status: string; subtotal: number; discount_total: number; tax_total: number; total: number; gl_entry_id: number | null; doc_no: string | null }>(
    `SELECT doc_type, status, subtotal, discount_total, tax_total, total, gl_entry_id, doc_no FROM purchase_documents WHERE id=$1`, [docId]))[0]
  if (!d) throw new Error('Document not found')
  if (d.gl_entry_id) return { entryId: d.gl_entry_id, alreadyPosted: true }
  if (d.doc_type !== 'invoice') throw new Error('Only purchase invoices post to the GL')
  if (['draft', 'void'].includes(d.status)) throw new Error('Confirm the invoice before posting')

  const net = num(d.subtotal) - num(d.discount_total)
  const lines = purchaseInvoicePostingLines(net, num(d.tax_total), num(d.total))
  if (!postingBalanced(lines)) throw new Error('Posting does not balance')

  // Resolve account ids by code (seeded standard chart).
  const codes = [...new Set(lines.map(l => l.accountCode))]
  const accs = await pgQuery<{ id: number; code: string }>(`SELECT id, code FROM gl_accounts WHERE code = ANY($1)`, [codes])
  const idOf = new Map(accs.map(a => [a.code, a.id]))
  for (const c of codes) if (!idOf.has(c)) throw new Error(`GL account ${c} is missing from the chart`)

  const entryNo = await nextNumber('journal', { legacyPrefix: 'JV' })
  const entry = (await pgQuery<{ id: number }>(
    `INSERT INTO gl_journal_entries (entry_no, date, memo, reference, status, total, created_by, created_at, posted_at)
     VALUES ($1, to_char(now(),'YYYY-MM-DD'), $2, $3, 'posted', $4, $5, ${NOW}, ${NOW}) RETURNING id`,
    [entryNo, `Purchase invoice ${d.doc_no ?? docId}`, `PUR-${docId}`, num(d.total), userId ?? null]))[0]
  let ln = 0
  for (const l of lines) {
    await pgQuery(`INSERT INTO gl_journal_lines (entry_id, account_id, debit, credit, memo, line_no) VALUES ($1,$2,$3,$4,$5,$6)`,
      [entry.id, idOf.get(l.accountCode), l.debit, l.credit, l.memo, ln++])
  }
  await pgQuery(`UPDATE purchase_documents SET gl_entry_id=$2, updated_at=${NOW} WHERE id=$1`, [docId, entry.id])
  return { entryId: entry.id, alreadyPosted: false }
}

// ── Analytics ────────────────────────────────────────────────────────────────
import { purchaseAnalytics, type PurchaseDocFact } from './purchasing'

/** Purchasing analytics — one query, the pure engine does the aggregation. */
export async function analytics(months = 12) {
  const rows = await pgQuery<{ doc_type: string; status: string; total: number; date: string; vendor_name: string | null }>(
    `SELECT d.doc_type, d.status, d.total, d.date, v.name AS vendor_name
     FROM purchase_documents d LEFT JOIN purchase_vendors v ON v.id = d.vendor_id`)
  const facts: PurchaseDocFact[] = rows.map(r => ({
    docType: r.doc_type as PurchaseDocFact['docType'], status: r.status,
    total: num(r.total), date: r.date, vendorName: r.vendor_name,
  }))
  return purchaseAnalytics(facts, months)
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export async function overview() {
  const orders = (await pgQuery<{ status: string; total: number }>(`SELECT status, total FROM purchase_documents WHERE doc_type='order'`)).map(o => ({ status: o.status as PurchaseStatus, total: num(o.total) }))
  const pendingApproval = num((await pgQuery<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_documents WHERE status='submitted'`))[0]?.c)
  const payables = num((await pgQuery<{ t: number }>(`SELECT COALESCE(SUM(total-paid_total),0) AS t FROM purchase_documents WHERE doc_type='invoice' AND status IN ('confirmed','partial')`))[0]?.t)
  const vendors = num((await pgQuery<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_vendors WHERE active=true`))[0]?.c)
  const kpis = purchaseKpis({ orders, pendingApproval, payables, vendors })
  const topVendors = await pgQuery(`SELECT name, score, grade FROM purchase_vendors WHERE active=true ORDER BY score DESC LIMIT 5`)
  const recent = await listDocuments()
  return { kpis, topVendors, recent: recent.slice(0, 8) }
}
