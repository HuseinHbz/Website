/**
 * Purchasing data layer (Phase 26.1) — PostgreSQL access for procure-to-pay.
 * Pure logic lives in `purchasing.ts`; totals/approval/scoring come from there.
 */
import { pgQuery } from '@/lib/db'
import { nextNumber } from '@/lib/numbering/integrate'
import {
  documentTotals, requiredApprovalLevels, isFullyApproved, vendorScore, vendorPayable,
  purchaseInvoiceStatus, purchaseKpis, type LineInput, type PurchaseDocType, type PurchaseStatus,
} from './purchasing'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const num = (v: unknown) => Number(v ?? 0)

export interface VendorInput {
  code?: string; name: string; kind?: string; email?: string; phone?: string
  taxId?: string; economicCode?: string; address?: string; iban?: string
  currency?: string; paymentTerms?: number
}
export interface LineRow extends LineInput { description: string }

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
interface DocRow { id: number; doc_no: string | null; doc_type: string; vendor_id: number | null; status: string; date: string; total: number; paid_total: number; approval_levels: number; budget: number; gl_entry_id: number | null }
export async function listDocuments(docType?: PurchaseDocType) {
  const rows = await pgQuery<DocRow & { vendor_name: string | null }>(
    `SELECT d.*, v.name AS vendor_name FROM purchase_documents d LEFT JOIN purchase_vendors v ON v.id=d.vendor_id
     ${docType ? 'WHERE d.doc_type=$1' : ''} ORDER BY d.created_at DESC`, docType ? [docType] : [])
  return rows.map(r => ({ id: r.id, docNo: r.doc_no, docType: r.doc_type, vendorId: r.vendor_id, vendorName: r.vendor_name, status: r.status, date: r.date, total: num(r.total), paidTotal: num(r.paid_total), approvalLevels: r.approval_levels, budget: num(r.budget), glEntryId: r.gl_entry_id }))
}
export async function getDocument(id: number) {
  const d = (await pgQuery<DocRow>(`SELECT * FROM purchase_documents WHERE id=$1`, [id]))[0]
  if (!d) return null
  const lines = await pgQuery(`SELECT id, description, qty, unit_price AS "unitPrice", discount_pct AS "discountPct", tax_pct AS "taxPct" FROM purchase_document_lines WHERE document_id=$1 ORDER BY sort_order, id`, [id])
  const approvals = await pgQuery(`SELECT level, decision, approver_id AS "approverId", comment, created_at AS "createdAt" FROM purchase_approvals WHERE document_id=$1 ORDER BY created_at`, [id])
  return { ...d, lines, approvals }
}

export async function saveDocument(input: {
  id?: number; docType: PurchaseDocType; vendorId?: number; date: string; currency?: string
  department?: string; budget?: number; sourceId?: number; note?: string; lines: LineRow[]
}, userId?: string): Promise<number> {
  const totals = documentTotals(input.lines)
  if (input.id) {
    await pgQuery(
      `UPDATE purchase_documents SET vendor_id=$2, date=$3, currency=COALESCE($4,currency), department=$5, budget=$6,
        note=$7, subtotal=$8, discount_total=$9, tax_total=$10, total=$11, updated_at=${NOW} WHERE id=$1`,
      [input.id, input.vendorId ?? null, input.date, input.currency ?? null, input.department ?? null, input.budget ?? 0,
       input.note ?? null, totals.subtotal, totals.discountTotal, totals.taxTotal, totals.total])
    await pgQuery(`DELETE FROM purchase_document_lines WHERE document_id=$1`, [input.id])
    await insertLines(input.id, input.lines)
    return input.id
  }
  const docNo = await nextNumber(`purchase_${input.docType}`, { legacyPrefix: input.docType.toUpperCase().slice(0, 3) })
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO purchase_documents (doc_no,doc_type,vendor_id,date,currency,department,budget,source_id,note,subtotal,discount_total,tax_total,total,created_by,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,${NOW},${NOW}) RETURNING id`,
    [docNo, input.docType, input.vendorId ?? null, input.date, input.currency ?? 'IRR', input.department ?? null, input.budget ?? 0,
     input.sourceId ?? null, input.note ?? null, totals.subtotal, totals.discountTotal, totals.taxTotal, totals.total, userId ?? null]))[0]
  await insertLines(row.id, input.lines)
  return row.id
}
async function insertLines(docId: number, lines: LineRow[]) {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    await pgQuery(`INSERT INTO purchase_document_lines (document_id,description,qty,unit_price,discount_pct,tax_pct,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [docId, l.description, l.qty, l.unitPrice, l.discountPct, l.taxPct, i])
  }
}

/** Submit a document for approval — compute the required approval levels. */
export async function submitDocument(id: number) {
  const d = (await pgQuery<{ total: number }>(`SELECT total FROM purchase_documents WHERE id=$1`, [id]))[0]
  if (!d) return
  const levels = requiredApprovalLevels(num(d.total))
  await pgQuery(`UPDATE purchase_documents SET status='submitted', approval_levels=$2, updated_at=${NOW} WHERE id=$1`, [id, levels])
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
export async function recordPayment(documentId: number, vendorId: number, amount: number, method: string, date: string, reference?: string, userId?: string) {
  await pgQuery(`INSERT INTO purchase_payments (vendor_id,document_id,date,amount,method,reference,created_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,${NOW})`,
    [vendorId, documentId, date, amount, method, reference ?? null, userId ?? null])
  const d = (await pgQuery<{ total: number }>(`SELECT total FROM purchase_documents WHERE id=$1`, [documentId]))[0]
  const paid = num((await pgQuery<{ t: number }>(`SELECT COALESCE(SUM(amount),0) AS t FROM purchase_payments WHERE document_id=$1`, [documentId]))[0]?.t)
  const status = purchaseInvoiceStatus(num(d.total), paid)
  await pgQuery(`UPDATE purchase_documents SET paid_total=$2, status=$3, updated_at=${NOW} WHERE id=$1`, [documentId, paid, status])
}

/** Convert an upstream doc (e.g. PR→PO, PO→GRN, GRN→invoice) copying its lines. */
export async function convertDocument(sourceId: number, toType: PurchaseDocType, userId?: string): Promise<number> {
  const src = await getDocument(sourceId)
  if (!src) throw new Error('Source not found')
  const lines = (src.lines as unknown as LineRow[]).map(l => ({ description: l.description, qty: num(l.qty), unitPrice: num(l.unitPrice), discountPct: num(l.discountPct), taxPct: num(l.taxPct) }))
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
