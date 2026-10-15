/**
 * PROC-FLOW-1 — Purchase & Service-Request process with 3 roles (Warehouse
 * Keeper · Procurement · Finance). This file is deliberately thin: it is
 * the ONLY genuinely new data layer the phase adds. Everything else rides
 * on existing, already-verified infrastructure —
 *   - inventory availability: `stockStateFor` (inventoryOpsData.ts)
 *   - the purchase chain: `saveDocument`/`receiveDocument` (purchasingData.ts)
 *   - the payment-request approval: `createApprovalRequest`/`actOnRequest`
 *     with doc_type='payment_request' (approvalData.ts, approval/matrix.ts)
 *   - the GL post: `postPurchaseInvoiceToGl` (purchasingData.ts)
 *   - service-line detection: lines with no product_id (purchasingData.ts
 *     `stockPurchaseInvoice` convention, reused verbatim here)
 * No second approval engine, no shadow inventory field, no new is_service flag.
 */
import { pgQuery, withTransaction, type TxQuery } from '@/lib/db'
import { nextNumber } from '@/lib/numbering/integrate'
import { stockStateFor } from '@/lib/inventory/inventoryOpsData'
import { saveDocument } from './purchasingData'
import { createApprovalRequest } from './approvalData'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

export interface SupplyNoteRow {
  id: number; noteNo: string | null; productId: number; warehouseId: number
  qtyNeeded: number; qtyAvailableSnapshot: number; status: string
  raisedBy: string | null; sentAt: string | null
  linkedPurchaseDocumentId: number | null; createdAt: string
  productName?: string; warehouseName?: string
}

function mapRow(r: any): SupplyNoteRow {
  return {
    id: r.id, noteNo: r.note_no, productId: r.product_id, warehouseId: r.warehouse_id,
    qtyNeeded: Number(r.qty_needed), qtyAvailableSnapshot: Number(r.qty_available_snapshot),
    status: r.status, raisedBy: r.raised_by, sentAt: r.sent_at,
    linkedPurchaseDocumentId: r.linked_purchase_document_id, createdAt: r.created_at,
    productName: r.product_name, warehouseName: r.warehouse_name,
  }
}

/**
 * بند۳.۱ step 1-2 — the ONE goods-request entry point. Checks REAL
 * availability via the canonical stockStateFor; if enough is on hand it
 * writes a single `issue` inv_moves row (direct delivery, no purchase
 * document anywhere in this path) and returns immediately. Otherwise it
 * raises a supply note for Procurement's queue. Never both.
 */
export async function requestGoods(
  input: { productId: number; warehouseId: number; qty: number; companyId?: number | null },
  userId?: string,
): Promise<{ delivered: boolean; noteId?: number; noteNo?: string }> {
  return withTransaction(async (query: TxQuery) => {
    await query(`SELECT pg_advisory_xact_lock(hashtextextended('supply_note', $1))`, [input.productId * 100000 + input.warehouseId])
    const state = await stockStateFor(input.productId, input.warehouseId, query)
    if (state.available >= input.qty) {
      await query(
        `INSERT INTO inv_moves (product_id, warehouse_id, type, qty, unit_cost, ref, created_by, created_at)
         VALUES ($1,$2,'issue',$3,0,$4,$5,${NOW})`,
        [input.productId, input.warehouseId, -Math.abs(input.qty), 'Direct delivery (goods request)', userId ?? null])
      return { delivered: true }
    }
    const noteNo = await nextNumber('supply_note', { module: 'erp.purchasing', userId: userId ?? null })
    const row = (await query<{ id: number }>(
      `INSERT INTO inv_supply_notes (note_no, product_id, warehouse_id, qty_needed, qty_available_snapshot, status, raised_by, sent_at, company_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'sent_to_procurement',$6,${NOW},$7,${NOW},${NOW}) RETURNING id`,
      [noteNo, input.productId, input.warehouseId, input.qty, state.available, userId ?? null, input.companyId ?? null]))[0]
    return { delivered: false, noteId: row.id, noteNo }
  })
}

/** Warehouse Keeper's queue: notes this role raised (any status). */
export async function listSupplyNotes(status?: string): Promise<SupplyNoteRow[]> {
  const rows = await pgQuery<any>(
    `SELECT n.*, p.name_en AS product_name, w.name_en AS warehouse_name
     FROM inv_supply_notes n
     LEFT JOIN inv_products p ON p.id=n.product_id
     LEFT JOIN inv_warehouses w ON w.id=n.warehouse_id
     WHERE $1::text IS NULL OR n.status=$1
     ORDER BY n.id DESC LIMIT 200`, [status ?? null])
  return rows.map(mapRow)
}

/**
 * Procurement's queue action — بند۳.۱ step 3: builds a new purchase
 * request document from the note via the EXISTING `saveDocument` (same
 * engine every other purchase request uses), links it, and marks the note
 * linked_to_purchase. The existing submit→approve→order→receive chain
 * continues completely unchanged from here; `receiveDocument` auto-closes
 * this note once the chain it fed is fully received (see purchasingData.ts).
 */
export async function convertSupplyNoteToPurchase(noteId: number, vendorId: number | undefined, userId?: string): Promise<{ purchaseDocumentId: number }> {
  return withTransaction(async (query: TxQuery) => {
    await query(`SELECT pg_advisory_xact_lock(hashtextextended('supply_note_convert', $1))`, [noteId])
    const note = (await query<{ id: number; product_id: number; qty_needed: number; status: string }>(
      `SELECT id, product_id, qty_needed::float AS qty_needed, status FROM inv_supply_notes WHERE id=$1`, [noteId]))[0]
    if (!note) throw new Error('Supply note not found')
    if (note.status !== 'sent_to_procurement') throw new Error(`Supply note is '${note.status}', expected 'sent_to_procurement'`)
    const docId = await saveDocument({
      docType: 'request', vendorId, date: new Date().toISOString().slice(0, 10), currency: 'IRR',
      note: `Purchase request from supply note`,
      lines: [{ description: `Supply note #${note.id}`, qty: note.qty_needed, unitPrice: 0, discountPct: 0, taxPct: 0, productId: note.product_id }],
    }, userId, query)
    await query(
      `UPDATE inv_supply_notes SET status='linked_to_purchase', linked_purchase_document_id=$2, updated_at=${NOW} WHERE id=$1`,
      [noteId, docId])
    return { purchaseDocumentId: docId }
  })
}

/**
 * بند۳.۲ cash-purchase path, steps 1-3 ONLY. Issues a payment_request
 * approval through the EXISTING approval engine (createApprovalRequest +
 * the seeded payment_request matrix) — no second approval table. Links
 * the supply note so its status reflects a cash path was chosen, but does
 * NOT create a purchase order and does NOT touch goods receipt.
 *
 * بند۳.۲.۴ — MANDATORY STOP: whether a GRN must still follow this payment
 * (two-step: pay then receive) or whether payment alone completes the
 * process is an open business-policy question that was explicitly NOT
 * answered by the project owner. This function — and this path — stops
 * here by design. See docs/governance/proc-flow-1-report.md §3.2.4.
 */
export async function requestCashPurchasePayment(
  noteId: number, amount: number, title: string, userId: string,
): Promise<{ approvalRequestId: number; autoApproved: boolean }> {
  const note = (await pgQuery<{ id: number; status: string }>(`SELECT id, status FROM inv_supply_notes WHERE id=$1`, [noteId]))[0]
  if (!note) throw new Error('Supply note not found')
  if (!['sent_to_procurement', 'linked_to_purchase'].includes(note.status)) throw new Error(`Supply note is '${note.status}', cannot request payment`)
  const r = await createApprovalRequest(
    { docType: 'payment_request', refType: 'inv_supply_notes', refId: noteId, title, amount },
    userId)
  return { approvalRequestId: r.id, autoApproved: r.autoApproved }
}

// ── Service requests (بند۳.۳) ───────────────────────────────────────────────

export interface ServiceRequestRow {
  id: number; requestNo: string | null; requesterId: string | null; description: string
  vendorId: number | null; status: string; linkedPurchaseDocumentId: number | null; createdAt: string
}

function mapSrv(r: any): ServiceRequestRow {
  return {
    id: r.id, requestNo: r.request_no, requesterId: r.requester_id, description: r.description,
    vendorId: r.vendor_id, status: r.status, linkedPurchaseDocumentId: r.linked_purchase_document_id, createdAt: r.created_at,
  }
}

export async function createServiceRequest(input: { description: string; vendorId?: number; companyId?: number | null }, userId?: string): Promise<ServiceRequestRow> {
  const requestNo = await nextNumber('service_request', { module: 'erp.purchasing', userId: userId ?? null })
  const row = (await pgQuery<any>(
    `INSERT INTO erp_service_requests (request_no, requester_id, description, vendor_id, status, company_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'requested',$5,${NOW},${NOW}) RETURNING *`,
    [requestNo, userId ?? null, input.description, input.vendorId ?? null, input.companyId ?? null]))[0]
  return mapSrv(row)
}

export async function listServiceRequests(status?: string): Promise<ServiceRequestRow[]> {
  const rows = await pgQuery<any>(
    `SELECT * FROM erp_service_requests WHERE $1::text IS NULL OR status=$1 ORDER BY id DESC LIMIT 200`, [status ?? null])
  return rows.map(mapSrv)
}

/**
 * بند۳.۳ step 2 — creates the service invoice via the SAME `saveDocument`
 * every purchase invoice uses, with lines carrying NO product_id — the
 * exact existing convention `stockPurchaseInvoice` already reads ("no
 * product_id ⇒ service-only, nothing to stock"). Posting to GL happens
 * through the existing `confirmPurchaseInvoice`/`postPurchaseInvoiceToGl`
 * — never touched or duplicated here.
 */
export async function createServiceInvoice(
  requestId: number, lines: { description: string; amount: number }[], userId?: string,
): Promise<{ purchaseDocumentId: number }> {
  return withTransaction(async (query: TxQuery) => {
    const req = (await query<{ id: number; vendor_id: number | null; status: string }>(
      `SELECT id, vendor_id, status FROM erp_service_requests WHERE id=$1`, [requestId]))[0]
    if (!req) throw new Error('Service request not found')
    if (!['requested', 'quoted'].includes(req.status)) throw new Error(`Service request is '${req.status}', cannot invoice`)
    const docId = await saveDocument({
      docType: 'invoice', vendorId: req.vendor_id ?? undefined, date: new Date().toISOString().slice(0, 10), currency: 'IRR',
      note: `Service invoice for request #${requestId}`,
      lines: lines.map(l => ({ description: l.description, qty: 1, unitPrice: l.amount, discountPct: 0, taxPct: 0, productId: null })),
    }, userId, query)
    await query(
      `UPDATE erp_service_requests SET status='invoiced', linked_purchase_document_id=$2, updated_at=${NOW} WHERE id=$1`,
      [requestId, docId])
    return { purchaseDocumentId: docId }
  })
}

/**
 * بند۳.۳ step 3-4 — called after the existing `confirmPurchaseInvoice`
 * (which already auto-posts to GL per Phase 26.15.1) succeeds for a
 * document linked from a service request. Pure status mirror, same
 * pattern `advanceDocument` uses for other ref types — never a second GL
 * post, never re-interprets posting state.
 */
export async function markServiceRequestFinancialDocSent(requestId: number): Promise<void> {
  await pgQuery(
    `UPDATE erp_service_requests SET status='financial_doc_sent', updated_at=${NOW} WHERE id=$1 AND status='invoiced'`, [requestId])
}

export async function closeServiceRequest(requestId: number): Promise<void> {
  await pgQuery(
    `UPDATE erp_service_requests SET status='closed', updated_at=${NOW} WHERE id=$1 AND status='financial_doc_sent'`, [requestId])
}
