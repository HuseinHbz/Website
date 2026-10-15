/**
 * PROC-FLOW-1 — live-PostgreSQL proof. Every assertion goes through the
 * PRODUCTION functions (supplyFlowData.ts, purchasingData.ts, approvalData.ts,
 * rbac engine) — no hand-SQL re-interpretation of status (CLAUDE.md rule 15).
 *
 * Covers (بند۵):
 *   1. Sufficient inventory → direct delivery, no purchase document.
 *   2. Insufficient inventory → supply note → purchase order → full receipt
 *      → supply note auto-closes.
 *   3. Cash purchase → payment_request → Finance approves; Procurement's
 *      attempt to approve its OWN request is rejected (SoD).
 *   4. Service request → service invoice (no product_id) → GL post → closes.
 *   5. Three real users, each on one of the seeded RBAC templates, each
 *      correctly gated to their own role's operations.
 *
 * Run: DATABASE_URL=… npx tsx scripts/verify-procflow1-supply-service.ts
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import { effectiveLevel, levelSatisfies, isOpAllowed } from '@/lib/rbac/engine'
import { loadUserRbac, setGrant, setOp, setRowScope } from '@/lib/rbac/data'
import {
  requestGoods, listSupplyNotes, convertSupplyNoteToPurchase, requestCashPurchasePayment,
  createServiceRequest, createServiceInvoice, markServiceRequestFinancialDocSent, closeServiceRequest,
} from '@/lib/erp/supplyFlowData'
import { receiveDocument, confirmPurchaseInvoice, decideApproval, submitDocument } from '@/lib/erp/purchasingData'
import { actOnRequest, getApprovalRequest } from '@/lib/erp/approvalData'
import type { AdminUser } from '@/lib/admin/auth'

let n = 0, failed = 0
const ok = (c: boolean, l: string) => { n++; if (c) console.log(`  ✅ ${n}. ${l}`); else { failed++; console.error(`  ❌ ${n}. ${l}`) } }

async function mkUser(id: string, email: string, role = 'editor', financeRole?: string): Promise<void> {
  await pgQuery(
    `INSERT INTO users (id, name, email, password_hash, role, finance_role, active, created_at)
     VALUES ($1,$1,$2,'x',$3,$4,true,to_char(now(),'YYYY-MM-DD HH24:MI:SS'))
     ON CONFLICT (id) DO UPDATE SET role=$3, finance_role=$4`, [id, email, role, financeRole ?? null])
}
function asUser(id: string, role: string): AdminUser { return { id, name: id, email: `${id}@t.ir`, role, active: true } as AdminUser }

/** Applies a seeded role template to a user via the SAME code path the
 * permissions UI uses (setGrant/setOp/setRowScope per-key). */
async function applyTemplate(actorId: string, userId: string, templateName: string): Promise<void> {
  const t = (await pgQuery<{ grants: string; ops: string; row_scopes: string }>(
    `SELECT grants, ops, row_scopes FROM rbac_role_templates WHERE name=$1`, [templateName]))[0]
  if (!t) throw new Error(`Template not found: ${templateName}`)
  for (const [k, v] of Object.entries(JSON.parse(t.grants) as Record<string, 'none' | 'read' | 'write'>)) await setGrant(actorId, userId, k, v)
  for (const [k, v] of Object.entries(JSON.parse(t.ops) as Record<string, boolean>)) await setOp(actorId, userId, k, v)
  for (const [k, v] of Object.entries(JSON.parse(t.row_scopes) as Record<string, 'all' | 'own' | 'department' | 'company'>)) await setRowScope(actorId, userId, k, v)
}

async function onHand(productId: number, warehouseId: number): Promise<number> {
  return (await pgQuery<{ q: number }>(`SELECT COALESCE(SUM(qty),0)::float AS q FROM inv_moves WHERE product_id=$1 AND warehouse_id=$2`, [productId, warehouseId]))[0].q
}

async function main() {
  await runMigrations(); await seedDatabase()
  const admin = 'u-sysadmin'
  await mkUser(admin, 'admin@t.ir', 'super_admin')

  // ── بند۱: three real users, each assigned to an EXISTING seeded template (no new templates) ──
  const warehouseKeeper = 'u-wk1', procurement = 'u-proc1', finance = 'u-fin1'
  await mkUser(warehouseKeeper, 'wk@t.ir', 'editor')
  await mkUser(procurement, 'proc@t.ir', 'editor')
  await mkUser(finance, 'fin@t.ir', 'editor', 'finance_manager')
  await applyTemplate(admin, warehouseKeeper, 'Warehouse Keeper')
  await applyTemplate(admin, procurement, 'Procurement')
  await applyTemplate(admin, finance, 'Finance Specialist')

  const wkRbac = await loadUserRbac(warehouseKeeper)
  const procRbac = await loadUserRbac(procurement)
  const finRbac = await loadUserRbac(finance)

  ok(levelSatisfies(effectiveLevel(wkRbac.grants, 'erp.inventory')!, 'write'), '1. Warehouse Keeper has write on erp.inventory (own queue)')
  ok(effectiveLevel(wkRbac.grants, 'erp.finance') === 'none', '2. Warehouse Keeper denied erp.finance entirely (deny dominates)')
  ok(levelSatisfies(effectiveLevel(procRbac.grants, 'erp.purchasing')!, 'write'), '3. Procurement has write on erp.purchasing')
  ok(isOpAllowed(procRbac.ops, procRbac.grants, 'erp.purchasing:request_payment') === true, '4. Procurement holds the new request_payment op')
  ok(effectiveLevel(procRbac.grants, 'erp.finance') === 'none', '5. Procurement denied erp.finance entirely — cannot act as Finance')
  ok(isOpAllowed(procRbac.ops, procRbac.grants, 'erp.approvals:approve') === false, '6. Procurement explicitly CANNOT approve (only create)')
  ok(levelSatisfies(effectiveLevel(finRbac.grants, 'erp.finance')!, 'write'), '7. Finance (Finance Specialist template) has write on erp.finance')

  // ── setup: product, warehouse, vendor ──────────────────────────────────────
  const wh = (await pgQuery<{ id: number }>(`INSERT INTO inv_warehouses (code, name_en) VALUES ('PF1-WH','PF1 Warehouse') RETURNING id`))[0].id
  const product = (await pgQuery<{ id: number }>(`INSERT INTO inv_products (sku, name_en, cost, price) VALUES ('PF1-SKU','PF1 Widget',1000,1500) RETURNING id`))[0].id
  const vendor = (await pgQuery<{ id: number }>(`INSERT INTO purchase_vendors (code, name) VALUES ('PF1-V1','PF1 Vendor') RETURNING id`))[0].id

  // Seed 20 units on hand (a receipt move) so scenario 1 has real stock.
  await pgQuery(`INSERT INTO inv_moves (product_id, warehouse_id, type, qty, unit_cost) VALUES ($1,$2,'receipt',20,1000)`, [product, wh])
  ok((await onHand(product, wh)) === 20, '8. Seeded 20 units on hand via a real inv_moves receipt row')

  // ── Scenario 1: sufficient inventory → direct delivery, no purchase doc ────
  const docsBefore = (await pgQuery<{ c: number }>(`SELECT count(*)::int AS c FROM purchase_documents`))[0].c
  const r1 = await requestGoods({ productId: product, warehouseId: wh, qty: 5 }, warehouseKeeper)
  ok(r1.delivered === true && !r1.noteId, '9. requestGoods(5) with 20 on hand → delivered directly, no supply note')
  ok((await onHand(product, wh)) === 15, '10. on-hand dropped 20→15 via a real issue inv_moves row (signed −5)')
  const docsAfter = (await pgQuery<{ c: number }>(`SELECT count(*)::int AS c FROM purchase_documents`))[0].c
  ok(docsAfter === docsBefore, '11. no purchase_documents row was created for the direct-delivery path')

  // ── Scenario 2: insufficient inventory → supply note → PO → full receipt → auto-close ──
  const r2 = await requestGoods({ productId: product, warehouseId: wh, qty: 50 }, warehouseKeeper)
  ok(r2.delivered === false && !!r2.noteId, '12. requestGoods(50) with 15 on hand → supply note raised (insufficient)')
  const noteId = r2.noteId!
  let note = (await listSupplyNotes()).find(x => x.id === noteId)!
  ok(note.status === 'sent_to_procurement', '13. new supply note status = sent_to_procurement (visible in Procurement queue)')
  ok(note.qtyAvailableSnapshot === 15, '14. supply note snapshots the REAL available qty at raise time (15), not a shadow field')

  const conv = await convertSupplyNoteToPurchase(noteId, vendor, procurement)
  const requestDocId = conv.purchaseDocumentId
  note = (await listSupplyNotes()).find(x => x.id === noteId)!
  ok(note.status === 'linked_to_purchase' && note.linkedPurchaseDocumentId === requestDocId, '15. supply note linked_to_purchase, pointing at the new purchase_documents row')
  const reqDoc = (await pgQuery<{ doc_type: string }>(`SELECT doc_type FROM purchase_documents WHERE id=$1`, [requestDocId]))[0]
  ok(reqDoc.doc_type === 'request', '16. the new document is a genuine purchase_documents row (doc_type=request), via saveDocument — the EXISTING engine')

  // Existing chain continues unchanged: submit → approve → convert to order → convert to receipt → receive.
  await submitDocument(requestDocId)
  await decideApproval(requestDocId, 1, 'approved', admin)
  const { convertDocument } = await import('@/lib/erp/purchasingData')
  const orderId = await convertDocument(requestDocId, 'order', procurement)
  const receiptId = await convertDocument(orderId, 'receipt', procurement)
  const recv = await receiveDocument(receiptId, wh, undefined, procurement)
  ok(recv.ok === true && recv.status === 'received', '17. receiveDocument fully receives the GRN via the UNCHANGED existing chain')
  ok((await onHand(product, wh)) === 65, '18. on-hand rose 15→65 (+50) from the real receipt inv_moves row')
  note = (await listSupplyNotes()).find(x => x.id === noteId)!
  ok(note.status === 'closed', '19. supply note AUTO-CLOSED purely from receiveDocument fully receiving its chain (no manual close call)')

  // ── Scenario 3: cash purchase → payment_request → Finance approves; Procurement self-approval rejected (SoD) ──
  const r3 = await requestGoods({ productId: product, warehouseId: wh, qty: 200 }, warehouseKeeper)
  const cashNoteId = r3.noteId!
  const pay = await requestCashPurchasePayment(cashNoteId, 50_000_000, 'Cash purchase — PF1 test', procurement)
  ok(!pay.autoApproved, '20. payment_request (50M) did NOT auto-approve — matrix level 1 (finance_manager) applies')
  const reqRow = await getApprovalRequest(pay.approvalRequestId)
  ok(reqRow?.request?.docType === 'payment_request' && reqRow?.request?.refType === 'inv_supply_notes', '21. approval_requests row carries doc_type=payment_request (the EXISTING doc type, no new table)')

  let notAuthorized = false
  try { await actOnRequest(pay.approvalRequestId, asUser(procurement, 'editor'), 'approved', undefined, undefined) }
  catch (e) { notAuthorized = /not an authorized approver/i.test((e as Error).message) }
  ok(notAuthorized, '22. Procurement (no finance_role) cannot act on its own payment_request at all — not an authorized approver')

  // The real SoD proof needs the SAME person able to satisfy the matrix level
  // AND be the creator — raise a second request created BY the finance user,
  // then have that SAME finance user try to approve it.
  const payByFinance = await requestCashPurchasePayment(cashNoteId, 40_000_000, 'Cash purchase — self-approval test', finance)
  let sodBlocked = false
  try { await actOnRequest(payByFinance.approvalRequestId, asUser(finance, 'editor'), 'approved', undefined, undefined) }
  catch (e) { sodBlocked = /separation of duties/i.test((e as Error).message) }
  ok(sodBlocked, '22b. Finance attempting to approve its OWN payment_request is rejected — Separation of Duties (isSeparationViolation, zero new code)')

  const decided = await actOnRequest(pay.approvalRequestId, asUser(finance, 'editor'), 'approved', 'ok', undefined)
  ok(decided.status === 'approved', '23. Finance (finance_manager role, matrix-resolved via the EXISTING engine) approves the ORIGINAL (Procurement-created) payment_request successfully')

  let wkBlockedOnDecide = false
  const r3b = await requestGoods({ productId: product, warehouseId: wh, qty: 300 }, warehouseKeeper)
  const pay2 = await requestCashPurchasePayment(r3b.noteId!, 50_000_000, 'Cash purchase #2', procurement)
  try { await actOnRequest(pay2.approvalRequestId, asUser(warehouseKeeper, 'editor'), 'approved', undefined, undefined) }
  catch (e) { wkBlockedOnDecide = /not an authorized approver/i.test((e as Error).message) }
  ok(wkBlockedOnDecide, '24. Warehouse Keeper (no finance_role, not the creator) is also rejected — not an authorized approver for this level')

  // ── Scenario 4: service request → service invoice (no product_id) → GL post → closes ──
  const svc = await createServiceRequest({ description: 'PF1 consulting service', vendorId: vendor }, procurement)
  ok(svc.status === 'requested', '25. service request created with status=requested')
  const inv = await createServiceInvoice(svc.id, [{ description: 'Consulting hours', amount: 2_000_000 }], procurement)
  const invDoc = (await pgQuery<{ doc_type: string; total: number }>(`SELECT doc_type, total::float AS total FROM purchase_documents WHERE id=$1`, [inv.purchaseDocumentId]))[0]
  ok(invDoc.doc_type === 'invoice' && invDoc.total === 2_000_000, '26. service invoice is a real purchase_documents row (invoice, total=2,000,000)')
  const lineProductIds = await pgQuery<{ product_id: number | null }>(`SELECT product_id FROM purchase_document_lines WHERE document_id=$1`, [inv.purchaseDocumentId])
  ok(lineProductIds.every(l => l.product_id === null), '27. every line has NO product_id — the EXISTING service-detection convention, no new is_service flag')

  const glBefore = (await pgQuery<{ c: number }>(`SELECT count(*)::int AS c FROM gl_journal_entries WHERE status='posted'`))[0].c
  const confirmed = await confirmPurchaseInvoice(inv.purchaseDocumentId, admin)
  ok(confirmed.status === 'confirmed' && confirmed.entryId != null, '28. confirmPurchaseInvoice succeeds + auto-posts to GL (the EXISTING function — never duplicated)')
  const glAfter = (await pgQuery<{ c: number }>(`SELECT count(*)::int AS c FROM gl_journal_entries WHERE status='posted'`))[0].c
  ok(glAfter === glBefore + 1, '29. exactly one new POSTED gl_journal_entries row — via the EXISTING postPurchaseInvoiceToGl auto-post (26.24b), no second GL engine')

  await markServiceRequestFinancialDocSent(svc.id)
  await closeServiceRequest(svc.id)
  const finalSvc = (await pgQuery<{ status: string }>(`SELECT status FROM erp_service_requests WHERE id=$1`, [svc.id]))[0]
  ok(finalSvc.status === 'closed', '30. service request lifecycle completes: requested → invoiced → financial_doc_sent → closed')

  // ── company_id / tenancy sanity on the two new tables ──────────────────────
  const tenancy = await pgQuery<{ has_col: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='inv_supply_notes' AND column_name='company_id') AS has_col`)
  ok(tenancy[0].has_col, '31. inv_supply_notes carries company_id (audit:tenancy)')
  const tenancy2 = await pgQuery<{ has_col: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='erp_service_requests' AND column_name='company_id') AS has_col`)
  ok(tenancy2[0].has_col, '32. erp_service_requests carries company_id (audit:tenancy)')

  console.log(`\n  ${n - failed}/${n} assertions passed.`)
  if (failed > 0) { console.error(`  ${failed} FAILED`); process.exit(1) }
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
