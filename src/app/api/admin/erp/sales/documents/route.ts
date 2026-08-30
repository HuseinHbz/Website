import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, requirePermission, requireOp } from '@/lib/api/respond'
import { pgQuery, withTransaction } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { DOC_TYPES, documentTotals, lineTotals } from '@/lib/erp/sales'
import { postSalesInvoiceToGl, createSalesReturn, settleReturnIfPaid } from '@/lib/erp/salesData'
import { reverseEntry } from '@/lib/erp/glPosting'
import { nextNumber } from '@/lib/numbering/integrate'
import { rialRateFor } from '@/lib/erp/currencyData'
import { clientIp } from '@/lib/api/clientIp'
import { defaultCurrency } from '@/lib/erp/settings'
import { evaluateCredit } from '@/lib/crm/customer360Data'
import { businessError, toApiResponse } from '@/lib/errors'
import { runOnce } from '@/lib/api/idempotency'
import { reserveSalesOrderTx, releaseSalesOrderReservation, deliverSalesOrder } from '@/lib/erp/salesFulfillment'

/** Idempotent credit-limit breach alert (26.25 بند ۱.۳), fingerprinted per invoice. */
async function raiseCreditAlert(customerId: number, invoiceId: number, limit: number, projected: number) {
  try {
    await pgQuery(
      `INSERT INTO business_alerts (kind, domain, severity, title_en, title_fa, detail, metric_value, ref_type, ref_id, fingerprint, updated_at)
       VALUES ('credit_limit_exceeded','financial','warning','Customer credit limit exceeded','عبور مشتری از سقف اعتبار',$1,$2,'sales_customers',$3,$4,${NOW})
       ON CONFLICT (fingerprint) DO UPDATE SET updated_at=${NOW}, status='open'`,
      [`Invoice ${invoiceId}: projected ${projected} > limit ${limit}`, projected, customerId, `credit:${customerId}:${invoiceId}`])
  } catch { /* alert is best-effort */ }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const PREFIX: Record<string, string> = { quote: 'QT', order: 'SO', invoice: 'INV', credit_note: 'CN', debit_note: 'DN' }

// GET — list documents of a type (?type=), or one document with its lines (?id=).
export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.sales', 'read')
  if ('error' in auth) return auth.error
  try {
    // 26.28 بند ۲ — sales row scope: a document is "owned" by its customer's
    // owner, falling back to the creator (a sales rep sees their own customers).
    const { rowScopeSql, rowInScope } = await import('@/lib/rbac/data')
    const OWNER = 'COALESCE(c.owner_id, d.created_by)'
    const id = Number(req.nextUrl.searchParams.get('id'))
    if (id) {
      const doc = (await pgQuery(
        `SELECT d.id, d.doc_type AS "docType", d.doc_no AS "docNo", d.customer_id AS "customerId", d.date, d.due_date AS "dueDate",
                d.status, d.subtotal::float AS subtotal, d.discount_total::float AS "discountTotal", d.tax_total::float AS "taxTotal",
                d.total::float AS total, d.notes, d.currency, d.exchange_rate::float AS "exchangeRate", d.base_total::float AS "baseTotal", c.name AS "customerName",
                ${OWNER} AS "ownerId"
         FROM sales_documents d JOIN sales_customers c ON c.id=d.customer_id WHERE d.id=$1 AND d.deleted_at IS NULL`, [id]))[0] as (Record<string, unknown> & { ownerId: string | null }) | undefined
      if (!doc) return badRequest('Not found')
      if (!(await rowInScope(auth.user.id, 'erp.sales', doc.ownerId))) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })   // بند ۲.۲
      }
      const lines = await pgQuery(
        `SELECT id, description, qty::float AS qty, unit_price::float AS "unitPrice", discount_pct::float AS "discountPct", tax_pct::float AS "taxPct", line_total::float AS "lineTotal"
         FROM sales_document_lines WHERE document_id=$1 ORDER BY line_no, id`, [id])
      const paid = (await pgQuery(`SELECT COALESCE(SUM(amount),0)::float AS paid FROM sales_payments WHERE document_id=$1`, [id]))[0] as { paid: number }
      return NextResponse.json({ doc, lines, paid: paid.paid })
    }
    const type = req.nextUrl.searchParams.get('type')
    const baseParams: unknown[] = type ? [type] : []
    const sc = await rowScopeSql(auth.user.id, 'erp.sales', OWNER, baseParams.length + 1)
    const rows = await pgQuery(
      `SELECT d.id, d.doc_type AS "docType", d.doc_no AS "docNo", d.date, d.due_date AS "dueDate", d.status,
              d.total::float AS total, d.currency, d.gl_entry_id AS "glEntryId", c.name AS "customerName",
              COALESCE((SELECT SUM(amount) FROM sales_payments p WHERE p.document_id=d.id),0)::float AS paid
       FROM sales_documents d JOIN sales_customers c ON c.id=d.customer_id
       WHERE d.deleted_at IS NULL ${type ? 'AND d.doc_type=$1' : ''}${sc.clause}
       ORDER BY d.date DESC, d.id DESC LIMIT 300`, [...baseParams, ...sc.params])
    return NextResponse.json({ documents: rows })
  } catch (e) { return apiError(e, 'Failed to load documents') }
}

const createSchema = z.object({
  id: z.number().int().positive().optional(),
  docType: z.enum(DOC_TYPES),
  customerId: z.number().int().positive(),
  date: z.string().min(1).max(30),
  dueDate: z.string().max(30).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  sourceId: z.number().int().positive().optional(),
  currency: z.enum(['IRR', 'IRT', 'USD', 'EUR']).optional(),
  // Phase 6: the fulfillment warehouse an ORDER reserves/delivers against.
  // Nullable/optional — an order with no warehouse simply never reserves
  // (matches Phase 5's "nothing to match against" honesty for a standalone doc).
  warehouseId: z.number().int().positive().optional().nullable(),
  lines: z.array(z.object({
    description: z.string().min(1).max(300),
    qty: z.number().positive(),
    unitPrice: z.number().min(0),
    discountPct: z.number().min(0).max(100).default(0),
    taxPct: z.number().min(0).max(100).default(0),
    productId: z.number().int().positive().nullable().optional(),
  })).min(1).max(200),
})

export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.sales', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, createSchema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  const totals = documentTotals(d.lines)
  try {
    const currency = d.currency ?? await defaultCurrency()
    const rate = await rialRateFor(currency)
    if (rate == null) return badRequest(`No exchange rate configured for ${currency} — set one in Finance → Currency`)
    const baseTotal = Math.round(totals.total * rate * 100) / 100
    // Phase-3B live-verification finding: a nonexistent customerId fell
    // through to a raw PG foreign-key violation (23503), which apiError
    // does not special-case (only 23502/23505 do), so it surfaced as an
    // unhandled HTTP 500 "Failed to save document" — exactly the class of
    // bug the master prompt's own ERP-SALES-CUSTOMER-NOT-FOUND example
    // names. Fixed with an explicit existence check.
    const custExists = (await pgQuery<{ c: number }>(`SELECT count(*)::int AS c FROM sales_customers WHERE id=$1`, [d.customerId]))[0]
    if (!custExists?.c) return toApiResponse(businessError('ERP-SALES-CUSTOMER-NOT-FOUND', undefined))
    if (d.id) {
      const cur = (await pgQuery(`SELECT status FROM sales_documents WHERE id=$1`, [d.id]))[0] as { status: string } | undefined
      if (!cur) return badRequest('Not found')
      if (cur.status !== 'draft') return badRequest('Only draft documents can be edited')
    }
    // Full-remediation RULE-025 (26.32-class double-submit guard): a CREATE
    // (no d.id) is wrapped in runOnce — two genuinely concurrent identical
    // POSTs (double-click, network retry) used to create two invoices with
    // two different doc numbers; the second now replays the first's result
    // instead of reaching the database. An update targets a specific row by
    // id, so it doesn't need this (a repeat is naturally idempotent).
    // NOTE: nextNumber() must run INSIDE the runOnce-guarded closure — minting
    // it outside (as an earlier version of this fix did) burns one numbering-
    // sequence value per concurrent request even though only one document is
    // actually written (caught by a live-concurrency test on the journal
    // route's identical pattern).
    const createOnce = <T>(fn: () => Promise<T>) => d.id ? fn() : runOnce(auth.user.id, 'erp/sales/documents', d, fn)
    // Phase-3B live-verification finding: 5 concurrent identical creates
    // correctly wrote exactly ONE row (runOnce dedup working), but
    // logAction below used to fire unconditionally for every HTTP request
    // that reached this point — including the 4 replayed duplicates — so
    // audit_logs ended up with 5 "success" rows for one real creation.
    // `didWrite` is set true only inside the closure that actually runs;
    // a replayed call never invokes it (runOnce short-circuits before
    // calling fn()), so it stays false for every duplicate.
    let didWrite = false
    // Full-remediation RULE-002: header write + line replacement now commit
    // as one transaction — the old bare-pgQuery sequence (UPDATE/INSERT
    // header, DELETE old lines, loop-INSERT new lines) could leave a
    // document with missing/mismatched lines on a mid-sequence failure.
    const docId = await createOnce(() => withTransaction(async query => {
      didWrite = true
      let id = d.id
      if (id) {
        await query(
          `UPDATE sales_documents SET customer_id=$2, date=$3, due_date=$4, notes=$5, subtotal=$6, discount_total=$7, tax_total=$8, total=$9, currency=$10, exchange_rate=$11, base_total=$12, warehouse_id=$13, updated_at=${NOW} WHERE id=$1`,
          [id, d.customerId, d.date, d.dueDate ?? null, d.notes ?? null, totals.subtotal, totals.discountTotal, totals.taxTotal, totals.total, currency, rate, baseTotal, d.warehouseId ?? null])
        await query(`DELETE FROM sales_document_lines WHERE document_id=$1`, [id])
      } else {
        const docNo = await nextNumber(d.docType, { module: 'sales', userId: auth.user.id, legacyPrefix: PREFIX[d.docType] })
        const row = (await query(
          `INSERT INTO sales_documents (doc_type, doc_no, customer_id, date, due_date, status, subtotal, discount_total, tax_total, total, source_id, notes, created_by, currency, exchange_rate, base_total, warehouse_id, updated_at)
           VALUES ($1,$2,$3,$4,$5,'draft',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,${NOW}) RETURNING id`,
          [d.docType, docNo, d.customerId, d.date, d.dueDate ?? null, totals.subtotal, totals.discountTotal, totals.taxTotal, totals.total, d.sourceId ?? null, d.notes ?? null, auth.user.id, currency, rate, baseTotal, d.warehouseId ?? null]))[0] as { id: number }
        id = row.id
      }
      for (let i = 0; i < d.lines.length; i++) {
        const l = d.lines[i]
        await query(`INSERT INTO sales_document_lines (document_id, description, qty, unit_price, discount_pct, tax_pct, line_total, line_no, product_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [id, l.description, l.qty, l.unitPrice, l.discountPct, l.taxPct, lineTotals(l).total, i, l.productId ?? null])
      }
      return id!
    }))
    // An update always logs; a create only logs on the real write — a
    // replayed duplicate (didWrite still false) must not add a second
    // "success" audit row for a document that already existed.
    if (d.id || didWrite) {
      await logAction(auth.user, d.id ? 'sales.doc.update' : 'sales.doc.create', 'sales_document', docId, null, { docType: d.docType, total: totals.total })
    }
    return NextResponse.json({ id: docId, total: totals.total })
  } catch (e) { return apiError(e, 'Failed to save document') }
}

const opSchema = z.object({
  id: z.number().int().positive(), op: z.enum(['send', 'confirm', 'void', 'convert', 'return', 'post', 'deliver']), toType: z.enum(DOC_TYPES).optional(),
  // BUG-013: optional partial-return selection (omit → full remaining return).
  // Phase 6 'deliver': which lines/qty to ship from a confirmed order's
  // reservation (omit → error; delivery is always explicit, never implicit
  // "deliver everything", so a partial pick never silently over-ships).
  lines: z.array(z.object({ lineId: z.number().int().positive(), qty: z.number().positive() })).optional(),
})

// PUT — lifecycle: send/confirm/void, or convert a quote→order or order→invoice
// (copies the lines into a new draft document that references the source).
export async function PUT(req: NextRequest) {
  const auth = await requirePermission('erp.sales', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, opSchema)
  if ('error' in parsed) return parsed.error
  const { id, op, toType, lines } = parsed.data
  try {
    const src = (await pgQuery(`SELECT * FROM sales_documents WHERE id=$1`, [id]))[0] as Record<string, unknown> | undefined
    if (!src) return badRequest('Not found')
    if (op === 'convert') {
      if (!toType) return badRequest('toType required')
      // 26.26 بند ۲ (CFO hunt): a source may not be converted to the same target
      // twice — re-converting a quote/order minted a DUPLICATE downstream document.
      const dup = (await pgQuery(`SELECT 1 FROM sales_documents WHERE source_id=$1 AND doc_type=$2 AND status<>'void' LIMIT 1`, [id, toType]))[0]
      if (dup) return badRequest(`Already converted to a ${toType}`)
      const docNo = await nextNumber(toType, { module: 'sales', userId: auth.user.id, legacyPrefix: PREFIX[toType] })
      // Phase-6 audit finding: this INSERT...SELECT never copied `product_id` —
      // converting a quote→order (or order→invoice) silently dropped the
      // inventory-product link on every line, which would have made
      // reservation/delivery impossible for any order that started life as a
      // quote (the normal path). Also had no transaction — a mid-sequence
      // failure could leave a new document header with zero/partial lines
      // while the source stayed un-confirmed. Both fixed: copies product_id,
      // and warehouse_id (a quote's chosen fulfillment warehouse carries
      // forward to the order it becomes), atomically.
      const newDoc = await withTransaction(async query => {
        const row = (await query(
          `INSERT INTO sales_documents (doc_type, doc_no, customer_id, date, due_date, status, subtotal, discount_total, tax_total, total, source_id, notes, created_by, warehouse_id, updated_at)
           VALUES ($1,$2,$3,to_char(now(),'YYYY-MM-DD'),$4,'draft',$5,$6,$7,$8,$9,$10,$11,$12,${NOW}) RETURNING id`,
          [toType, docNo, src.customer_id, src.due_date ?? null, src.subtotal, src.discount_total, src.tax_total, src.total, id, src.notes ?? null, auth.user.id, src.warehouse_id ?? null]))[0] as { id: number }
        await query(
          `INSERT INTO sales_document_lines (document_id, description, qty, unit_price, discount_pct, tax_pct, line_total, line_no, product_id)
           SELECT $1, description, qty, unit_price, discount_pct, tax_pct, line_total, line_no, product_id FROM sales_document_lines WHERE document_id=$2`,
          [row.id, id])
        await query(`UPDATE sales_documents SET status='confirmed', updated_at=${NOW} WHERE id=$1`, [id])
        return row
      })
      await logAction(auth.user, 'sales.doc.convert', 'sales_document', id, null, { toType, newId: newDoc.id })
      return NextResponse.json({ id: newDoc.id, docNo })
    }
    if (op === 'return') {
      { const deny = await requireOp(auth.user, 'erp.sales:return', 'edit'); if (deny) return deny }
      // BUG-013 (26.26): guarded sales return via the data layer — only a
      // confirmed/partial/paid invoice, cumulative return ≤ invoice total
      // (idempotent), optional partial-line selection. The source invoice is
      // never mutated; the credit note is settled when it is confirmed.
      const res = await createSalesReturn(id, { lines, userId: auth.user.id })
      if (!res.ok) return badRequest(res.error ?? 'Return not allowed')
      await logAction(auth.user, 'sales.doc.return', 'sales_document', id, null, { creditNoteId: res.id, partial: !!lines }, clientIp(req))
      return NextResponse.json({ id: res.id, docNo: res.docNo })
    }
    if (op === 'deliver') {
      { const deny = await requireOp(auth.user, 'erp.sales:deliver', 'edit'); if (deny) return deny }
      if (!lines || lines.length === 0) return badRequest('Select at least one line to deliver')
      const res = await deliverSalesOrder(id, lines, auth.user.id)
      if (!res.ok) {
        if (res.error?.includes('exceeds reserved_remaining')) return toApiResponse(businessError('ERP-SALES-DELIVERY-EXCEEDS-RESERVATION', { reason: res.error }))
        return badRequest(res.error ?? 'Delivery failed')
      }
      await logAction(auth.user, 'delivery.confirmed', 'sales_document', id, null, { shipmentId: res.shipmentId, cogsEntryId: res.cogsEntryId, lines }, clientIp(req))
      if (res.cogsEntryId) await logAction(auth.user, 'cogs.posted', 'inv_shipment', res.shipmentId!, null, { entryId: res.cogsEntryId }, clientIp(req))
      return NextResponse.json({ ok: true, shipmentId: res.shipmentId, cogsEntryId: res.cogsEntryId })
    }
    if (op === 'post') {
      { const deny = await requireOp(auth.user, 'erp.sales:post', 'edit'); if (deny) return deny }
      // GL posting is an administrator action (mirrors purchasing's doc.post).
      if (!['administrator', 'super_admin'].includes(auth.user.role)) return badRequest('Only administrators can post to the GL')
      const res = await postSalesInvoiceToGl(id, auth.user.id)
      await logAction(auth.user, 'sales.doc.post', 'sales_document', id, null, { entryId: res.entryId, alreadyPosted: res.alreadyPosted }, clientIp(req))
      return NextResponse.json({ ok: true, entryId: res.entryId, alreadyPosted: res.alreadyPosted })
    }
    // BUG-013 (26.26): a paid invoice may NOT be voided (deleting a settled
    // financial doc breaks the audit trail) — the operator must return/refund first.
    if (op === 'void' && String(src.doc_type) === 'invoice') {
      { const deny = await requireOp(auth.user, 'erp.sales:void', 'edit'); if (deny) return deny }
      const paid = Number(((await pgQuery(`SELECT COALESCE(SUM(amount),0)::float s FROM sales_payments WHERE document_id=$1 AND method<>'refund'`, [id]))[0] as { s: number }).s)
      if (paid > 0) return toApiResponse(businessError('ERP-SALES-VOID-PAID-INVOICE-BLOCKED', undefined))
    }
    if (op === 'confirm') { const deny = await requireOp(auth.user, 'erp.sales:confirm', 'edit'); if (deny) return deny }
    if (op === 'void') { const deny = await requireOp(auth.user, 'erp.sales:void', 'edit'); if (deny) return deny }
    const status = op === 'send' ? 'sent' : op === 'confirm' ? 'confirmed' : 'void'

    if (op === 'confirm' && String(src.doc_type) === 'invoice') {
      // Phase-3 sales audit finding: evaluateCredit() read the live AR
      // balance, then the status UPDATE ran as a separate, unlocked
      // statement — two genuinely concurrent confirms for the SAME
      // customer could both read the pre-confirm balance and both pass
      // the credit check, together landing the customer over their limit
      // (a classic TOCTOU race). Fixed: the credit check + status write for
      // an invoice confirm now run inside one transaction, serialized per
      // customer via a pg_advisory_xact_lock — the second concurrent
      // confirm blocks until the first commits, then correctly re-reads
      // the now-updated balance. 26.25 بند ۱.۳: block mode rejects an
      // over-limit confirm; warn mode allows it and raises an alert; no
      // limit (0) never blocks (backward compatible).
      const blocked = await withTransaction(async query => {
        await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`sales_customer_credit:${src.customer_id}`])
        const decision = await evaluateCredit(Number(src.customer_id), Number(src.total))
        if (decision.exceeded && decision.mode === 'block') return decision
        await query(`UPDATE sales_documents SET status=$2, updated_at=${NOW} WHERE id=$1`, [id, status])
        if (decision.exceeded) await raiseCreditAlert(Number(src.customer_id), id, decision.limit, decision.projected)
        return null
      })
      if (blocked) return toApiResponse(businessError('ERP-SALES-CREDIT-LIMIT-EXCEEDED', {
        limit: blocked.limit.toLocaleString(), projected: blocked.projected.toLocaleString(),
      }))
    } else if (op === 'confirm' && String(src.doc_type) === 'order' && src.status !== 'confirmed' && src.warehouse_id) {
      // Phase 6: confirming a sales ORDER reserves its product lines against
      // the order's fulfillment warehouse — "Draft → Pending Approval →
      // Approved → Reservation → Reserved" using this repo's REAL
      // terminology (there is no distinct "approved" status for sales
      // documents; `confirmed` IS the approval gate here, matching how
      // invoice-confirm already gates the credit check above). Guarded by
      // `src.status !== 'confirmed'` so a repeat confirm on an
      // already-confirmed order is a no-op status write, never a second
      // reservation (idempotent). An order with no warehouse set never
      // reserves — the honest "nothing to reserve against" case, not an
      // error (matches every prior phase's standalone-document precedent).
      // The reservation and the status write commit together: insufficient
      // stock on ANY line rolls back the whole confirm — no partial
      // reservation, order stays unconfirmed.
      const reserveFailure = await withTransaction(async query => {
        const r = await reserveSalesOrderTx(query, id, Number(src.warehouse_id), auth.user.id)
        if (!r.ok) return r.error!
        await query(`UPDATE sales_documents SET status=$2, updated_at=${NOW} WHERE id=$1`, [id, status])
        return null
      })
      if (reserveFailure) return toApiResponse(businessError('ERP-SALES-INSUFFICIENT-STOCK', { reason: reserveFailure }))
      await logAction(auth.user, 'inventory.reservation.created', 'sales_document', id, null, { warehouseId: src.warehouse_id }, clientIp(req))
    } else {
      await pgQuery(`UPDATE sales_documents SET status=$2, updated_at=${NOW} WHERE id=$1`, [id, status])
      // Cancelling (void) a confirmed order before delivery releases its
      // reservations — never silently orphaned, never a physical stock
      // mutation (nothing was ever issued). A no-op if nothing was reserved.
      if (op === 'void' && String(src.doc_type) === 'order') {
        const released = await releaseSalesOrderReservation(id)
        if (released > 0) await logAction(auth.user, 'inventory.reservation.released', 'sales_document', id, null, { count: released }, clientIp(req))
      }
    }
    // 26.23 (بند ۱.۱): confirming an invoice/credit note auto-posts it to the GL
    // (idempotent — gl_entry_id guard). A closed fiscal period fails loudly.
    let entryId: number | null = null
    if (op === 'confirm' && ['invoice', 'credit_note'].includes(String(src.doc_type))) {
      try {
        entryId = (await postSalesInvoiceToGl(id, auth.user.id)).entryId
      } catch (err) {
        await pgQuery(`UPDATE sales_documents SET status=$2, updated_at=${NOW} WHERE id=$1`, [id, src.status])
        return badRequest(`Confirmed but not postable: ${err instanceof Error ? err.message : 'GL posting failed'}`)
      }
      // BUG-013 (26.26): confirming a RETURN credit note against a PAID invoice
      // must settle it (refund → AR back to 0, or explicit customer credit + alert)
      // — otherwise AR is left silently negative.
      if (String(src.doc_type) === 'credit_note' && src.source_id) {
        try { await settleReturnIfPaid(id, auth.user.id) } catch { /* alert/refund is best-effort; never blocks confirm */ }
      }
    }
    // 26.23 (بند ۱.۳/۲.۱): voiding a GL-posted document books a reversal entry.
    if (op === 'void' && src.gl_entry_id) {
      const rev = await reverseEntry(Number(src.gl_entry_id), auth.user.id)
      await logAction(auth.user, 'sales.doc.void.reversal', 'gl_journal_entry', rev.reversalId, { source: src.gl_entry_id }, { reversalId: rev.reversalId }, clientIp(req))
    }
    await logAction(auth.user, `sales.doc.${op}`, 'sales_document', id, { status: src.status }, { status, entryId }, clientIp(req))
    return NextResponse.json({ ok: true, entryId })
  } catch (e) { return apiError(e, 'Operation failed') }
}

// Soft delete (Phase 26.7): super_admin/administrator only (canDo 'delete'
// excludes editors). Records who/when/why; the row stays for the audit trail
// and is voided so every financial aggregate keeps excluding it.
export async function DELETE(req: NextRequest) {
  const auth = await requirePermission('erp.sales', 'write', 'delete')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, z.object({ id: z.number().int().positive(), reason: z.string().max(500).optional() }))
  if ('error' in parsed) return parsed.error
  try {
    const paid = (await pgQuery(`SELECT 1 FROM sales_payments WHERE document_id=$1 LIMIT 1`, [parsed.data.id]))[0]
    if (paid) return badRequest('Document has payments; void it instead')
    const row = (await pgQuery(
      `UPDATE sales_documents SET deleted_at=${NOW}, deleted_by=$2, delete_reason=$3, status='void', updated_at=${NOW}
       WHERE id=$1 AND deleted_at IS NULL RETURNING id`,
      [parsed.data.id, auth.user.id, parsed.data.reason ?? null]))[0]
    if (!row) return badRequest('Not found or already deleted')
    await logAction(auth.user, 'sales.doc.delete', 'sales_document', parsed.data.id, null, { soft: true, reason: parsed.data.reason ?? '' })
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to delete document') }
}
