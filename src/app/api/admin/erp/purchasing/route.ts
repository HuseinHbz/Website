import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, requirePermission, requireOp } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import {
  listVendors, createVendor, updateVendor, evaluateVendor, vendorPosition, vendorEvaluationHistory,
  listDocuments, getDocument, saveDocument, submitDocument, decideApproval,
  recordPayment, reverseDirectPayment, convertDocument, overview, postPurchaseInvoiceToGl, analytics,
  receiveDocument, compareQuotes, confirmPurchaseInvoice, voidPurchaseInvoice,
  matchPurchaseInvoice, overrideMatch,
} from '@/lib/erp/purchasingData'
import { issueVendorToken, revokeVendorTokens } from '@/lib/erp/vendorPortal'
import type { PurchaseDocType } from '@/lib/erp/purchasing'
import { clientIp } from '@/lib/api/clientIp'
import { runOnce } from '@/lib/api/idempotency'
import { businessError, toApiResponse } from '@/lib/errors'
import { money, positiveMoney, qty, pct, isoDate, parseIdParam } from '@/lib/api/financeSchemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const DOC_TYPES = ['request', 'rfq', 'quotation', 'order', 'receipt', 'invoice', 'return', 'credit_note'] as const

export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.purchasing', 'read')
  if ('error' in auth) return auth.error
  try {
    const sp = req.nextUrl.searchParams
    const view = sp.get('view')
    if (view === 'overview') return NextResponse.json(await overview())
    if (view === 'analytics') return NextResponse.json(await analytics())
    if (view === 'vendors') return NextResponse.json({ vendors: await listVendors() })
    // ERPFIX-4 (BUG-ERP-18): a bogus id (?id=abc, ?id=-1) used to become NaN
    // and reach PostgreSQL as a raw query, surfacing as an unexplained 500
    // instead of a 400 naming the field.
    if (sp.get('vendorPosition')) {
      const id = parseIdParam(sp.get('vendorPosition')); if (!id.success) return NextResponse.json({ error: 'vendorPosition: must be a positive integer' }, { status: 400 })
      return NextResponse.json(await vendorPosition(id.data))
    }
    // 26.32 بند۴: the evaluation history was written and never read — now readable.
    if (sp.get('evaluations')) {
      const id = parseIdParam(sp.get('evaluations')); if (!id.success) return NextResponse.json({ error: 'evaluations: must be a positive integer' }, { status: 400 })
      return NextResponse.json({ evaluations: await vendorEvaluationHistory(id.data) })
    }
    if (sp.get('compare')) {
      const id = parseIdParam(sp.get('compare')); if (!id.success) return NextResponse.json({ error: 'compare: must be a positive integer' }, { status: 400 })
      return NextResponse.json({ quotes: await compareQuotes(id.data) })
    }
    if (sp.get('id')) {
      const id = parseIdParam(sp.get('id')); if (!id.success) return NextResponse.json({ error: 'id: must be a positive integer' }, { status: 400 })
      const doc = await getDocument(id.data)
      return doc ? NextResponse.json(doc) : NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const type = sp.get('type') as PurchaseDocType | null
    return NextResponse.json({ documents: await listDocuments(type ?? undefined) })
  } catch (e) { return apiError(e, 'Failed to load purchasing data') }
}

// ERPFIX-4 (BUG-ERP-18): qty/unitPrice/discountPct/taxPct now go through the
// shared financeSchemas primitives — qty must be positive (a zero/negative
// line was previously accepted outright), discount/tax are bounded 0-100
// (a 500% tax was previously accepted outright), unitPrice is non-negative
// (every real purchase line in this codebase, including returns, carries a
// positive unit price — discounts/credits flow through discountPct or the
// doc_type itself, never a negative price).
const lineSchema = z.object({ description: z.string().min(1).max(300), qty, unitPrice: money, discountPct: pct.default(0), taxPct: pct.default(0), productId: z.number().int().nullable().optional() })
const vendorExtra = { nationalId: z.string().max(40).optional(), regNo: z.string().max(40).optional(), contactName: z.string().max(120).optional(), contactPhone: z.string().max(40).optional(), bankName: z.string().max(120).optional(), city: z.string().max(80).optional(), postalCode: z.string().max(20).optional(), website: z.string().max(200).optional(), category: z.string().max(80).optional(), notes: z.string().max(1000).optional() }
const vendorCreate = z.object({ action: z.literal('vendor.create'), name: z.string().min(1).max(160), kind: z.enum(['individual', 'company', 'international']).optional(), email: z.string().max(160).optional(), phone: z.string().max(40).optional(), taxId: z.string().max(40).optional(), economicCode: z.string().max(40).optional(), address: z.string().max(400).optional(), iban: z.string().max(40).optional(), currency: z.string().max(4).optional(), paymentTerms: z.number().int().optional(), ...vendorExtra })
const vendorUpdate = z.object({ action: z.literal('vendor.update'), id: z.number().int(), name: z.string().max(160).optional(), email: z.string().max(160).optional(), phone: z.string().max(40).optional(), taxId: z.string().max(40).optional(), economicCode: z.string().max(40).optional(), address: z.string().max(400).optional(), iban: z.string().max(40).optional(), currency: z.string().max(4).optional(), paymentTerms: z.number().int().optional(), ...vendorExtra })
const score = z.number().min(0).max(5)
const evaluate = z.object({ action: z.literal('vendor.evaluate'), vendorId: z.number().int(), quality: score, delivery: score, price: score, service: score, compliance: score, note: z.string().max(500).optional() })
const docSave = z.object({ action: z.literal('doc.save'), id: z.number().int().optional(), docType: z.enum(DOC_TYPES), vendorId: z.number().int().optional(), date: isoDate, currency: z.string().max(4).optional(), department: z.string().max(80).optional(), budget: money.optional(), sourceId: z.number().int().optional(), note: z.string().max(1000).optional(), priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(), lines: z.array(lineSchema).max(200).default([]) })
const docSubmit = z.object({ action: z.literal('doc.submit'), id: z.number().int() })
const docApprove = z.object({ action: z.literal('doc.approve'), id: z.number().int(), level: z.number().int().min(1).max(3), decision: z.enum(['approved', 'rejected']), comment: z.string().max(500).optional() })
const docConvert = z.object({ action: z.literal('doc.convert'), sourceId: z.number().int(), toType: z.enum(DOC_TYPES) })
const docPayment = z.object({ action: z.literal('doc.payment'), documentId: z.number().int(), vendorId: z.number().int(), amount: positiveMoney, method: z.enum(['cash', 'bank', 'card', 'cheque', 'other']), date: isoDate, reference: z.string().max(80).optional() })
const docPaymentReverse = z.object({ action: z.literal('doc.paymentReverse'), paymentId: z.number().int() })
const docPost = z.object({ action: z.literal('doc.post'), id: z.number().int() })
const docConfirm = z.object({ action: z.literal('doc.confirm'), id: z.number().int(), warehouseId: z.number().int().optional() })
const docVoid = z.object({ action: z.literal('doc.void'), id: z.number().int() })
const docReceive = z.object({ action: z.literal('doc.receive'), id: z.number().int(), warehouseId: z.number().int(), lines: z.array(z.object({ lineId: z.number().int(), qty: z.number().min(0) })).optional() })
const portalLink = z.object({ action: z.literal('vendor.portalLink'), vendorId: z.number().int(), days: z.number().int().min(1).max(365).optional() })
const portalRevoke = z.object({ action: z.literal('vendor.portalRevoke'), vendorId: z.number().int() })
const docMatch = z.object({ action: z.literal('doc.match'), id: z.number().int() })
const docMatchOverride = z.object({ action: z.literal('doc.matchOverride'), id: z.number().int(), reason: z.string().min(3).max(500) })
const body = z.discriminatedUnion('action', [vendorCreate, vendorUpdate, evaluate, docSave, docSubmit, docApprove, docConvert, docPayment, docPaymentReverse, docPost, docConfirm, docVoid, docReceive, portalLink, portalRevoke, docMatch, docMatchOverride])

export async function POST(req: NextRequest) {
  // ERPFIX-4 (BUG-ERP-16): the module gate is now `read` — a Warehouse Keeper
  // only ever holds `read` on erp.purchasing, yet must still reach doc.receive
  // via its OWN op grant below. Every action that genuinely needs generic
  // write capability (not covered by a specific op) re-checks `write` itself.
  const auth = await requirePermission('erp.purchasing', 'read')
  if ('error' in auth) return auth.error
  const requireWrite = async () => requirePermission('erp.purchasing', 'write', 'edit')
  const parsed = await readJson(req, body)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  const uid = auth.user.id
  const ip = clientIp(req)
  try {
    switch (d.action) {
      case 'vendor.create': {
        const w = await requireWrite(); if ('error' in w) return w.error
        const id = await createVendor(d, uid); await logAction(auth.user, 'erp.vendor.create', 'purchase_vendors', String(id), { name: d.name }); return NextResponse.json({ id })
      }
      case 'vendor.update': {
        // ERPFIX-4 (BUG-ERP-16): changing the vendor's bank/IBAN is its own
        // op — a generic purchasing-write grant no longer implies the
        // authority to redirect where a vendor's money goes. Audited with
        // old→new values + a business_alert, never silent.
        const bankFieldsChanged = d.iban !== undefined || d.bankName !== undefined
        if (bankFieldsChanged) {
          const deny = await requireOp(auth.user, 'erp.purchasing:vendor_bank_change', 'edit'); if (deny) return deny
          const before = await (async () => {
            const { pgQuery } = await import('@/lib/db')
            return (await pgQuery<{ iban: string | null; bank_name: string | null }>(`SELECT iban, bank_name FROM purchase_vendors WHERE id=$1`, [d.id]))[0]
          })()
          await updateVendor(d.id, d)
          await logAction(auth.user, 'erp.vendor.bankChange', 'purchase_vendors', String(d.id),
            { iban: before?.iban ?? null, bankName: before?.bank_name ?? null },
            { iban: d.iban ?? before?.iban ?? null, bankName: d.bankName ?? before?.bank_name ?? null }, ip)
          try {
            const { pgQuery } = await import('@/lib/db')
            await pgQuery(
              `INSERT INTO business_alerts (kind, domain, severity, title_en, title_fa, detail, ref_type, ref_id, channels, fingerprint, updated_at)
               VALUES ('vendor_bank_changed','financial','warning','Vendor bank details changed','تغییر اطلاعات بانکی تأمین‌کننده',$1,'purchase_vendors',$2,'["inapp"]',$3,to_char(now(),'YYYY-MM-DD HH24:MI:SS'))
               ON CONFLICT (fingerprint) DO UPDATE SET updated_at=to_char(now(),'YYYY-MM-DD HH24:MI:SS'), detail=$1`,
              [`Vendor #${d.id} bank/IBAN changed by ${auth.user.id}`, d.id, `vendor_bank_changed:${d.id}:${Date.now()}`])
          } catch { /* alert is best-effort */ }
          return NextResponse.json({ ok: true })
        }
        const w = await requireWrite(); if ('error' in w) return w.error
        await updateVendor(d.id, d); await logAction(auth.user, 'erp.vendor.update', 'purchase_vendors', String(d.id), {}); return NextResponse.json({ ok: true })
      }
      case 'vendor.evaluate': {
        const w = await requireWrite(); if ('error' in w) return w.error
        const s = await evaluateVendor(d.vendorId, d, d.note, uid); await logAction(auth.user, 'erp.vendor.evaluate', 'purchase_vendors', String(d.vendorId), { score: s.score, grade: s.grade }); return NextResponse.json(s)
      }
      case 'doc.save': {
        const w = await requireWrite(); if ('error' in w) return w.error
        // Phase-4 procurement audit finding: a CREATE (no d.id) had no
        // double-submit guard — two genuinely concurrent identical POSTs
        // (double-click, network retry) created two purchase requests/
        // orders with two different doc numbers. A replayed duplicate
        // must not add a second success audit row either (didWrite gates
        // it to the one real write, matching the sales-route fix).
        let didWrite = false
        const write = async () => { didWrite = true; return saveDocument(d, uid) }
        let id: number
        try { id = d.id ? await write() : await runOnce(uid, 'erp/purchasing/doc.save', d, write) }
        catch (err) {
          // ERPFIX-4 (BUG-ERP-15): saveDocument throws a PURCHASE_DOC_LOCKED-
          // prefixed error once a document has moved past draft/rejected.
          const msg = err instanceof Error ? err.message : 'Save failed'
          if (msg.startsWith('PURCHASE_DOC_LOCKED: ')) return toApiResponse(businessError('ERP-PURCHASING-DOC-LOCKED', undefined))
          throw err
        }
        if (d.id || didWrite) await logAction(auth.user, 'erp.purchase.save', 'purchase_documents', String(id), { type: d.docType })
        return NextResponse.json({ id })
      }
      case 'doc.submit': {
        const w = await requireWrite(); if ('error' in w) return w.error
        const r = await submitDocument(d.id)
        if (!r.ok) return NextResponse.json({ error: r.error, budget: r.budget }, { status: 400 })
        await logAction(auth.user, 'erp.purchase.submit', 'purchase_documents', String(d.id), {})
        return NextResponse.json({ ok: true })
      }
      case 'doc.receive': {
        // ERPFIX-4 (BUG-ERP-16): receiving goods is its own op — a
        // Warehouse Keeper holds only `read` on erp.purchasing but is
        // granted this specific op, so they can record a GRN without
        // touching price, vendor, or approval.
        { const deny = await requireOp(auth.user, 'erp.purchasing:receive', 'edit'); if (deny) return deny }
        const r = await receiveDocument(d.id, d.warehouseId, d.lines, uid)
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
        await logAction(auth.user, 'erp.purchase.receive', 'purchase_documents', String(d.id), { received: r.received, status: r.status, warehouseId: d.warehouseId })
        return NextResponse.json(r)
      }
      case 'doc.approve': {
        // ERPFIX-4 (BUG-ERP-16): level 1 and level ≥2 are now separate ops
        // (approve / approve_high) instead of a hardcoded role-name check —
        // a role template grants each independently (e.g. a purchasing
        // manager gets `approve` but not `approve_high`).
        const opKey = d.level >= 2 ? 'erp.purchasing:approve_high' : 'erp.purchasing:approve'
        { const deny = await requireOp(auth.user, opKey, 'edit'); if (deny) return deny }
        const r = await decideApproval(d.id, d.level, d.decision, uid, d.comment)
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
        await logAction(auth.user, 'erp.purchase.approve', 'purchase_documents', String(d.id), { level: d.level }, { decision: d.decision, status: r.status }, ip)
        return NextResponse.json({ ok: true, status: r.status })
      }
      case 'doc.convert': {
        // ERPFIX-4 (BUG-ERP-16): converting a document downstream (PR→PO,
        // PO→GRN, GRN→invoice) is Procurement's own authority, distinct
        // from generic purchasing write.
        { const deny = await requireOp(auth.user, 'erp.purchasing:convert', 'edit'); if (deny) return deny }
        // ERPFIX-3 (BUG-ERP-04): convertDocument throws a PURCHASE_CONVERT_BLOCKED-
        // prefixed error for an invalid-status or already-fully-converted source —
        // mapped to a proper bilingual 409, mirroring THREE_WAY_MATCH_FAILED above.
        let id: number
        try { id = await convertDocument(d.sourceId, d.toType, uid) }
        catch (err) {
          const msg = err instanceof Error ? err.message : 'Conversion failed'
          if (msg.startsWith('PURCHASE_CONVERT_BLOCKED: ')) {
            const reason = msg.slice('PURCHASE_CONVERT_BLOCKED: '.length)
            return toApiResponse(reason.includes('already') ? businessError('ERP-PURCHASING-NOTHING-TO-CONVERT', undefined) : businessError('ERP-PURCHASING-INVALID-TRANSITION', { reason }))
          }
          throw err
        }
        await logAction(auth.user, 'erp.purchase.convert', 'purchase_documents', String(id), { from: d.sourceId, to: d.toType })
        return NextResponse.json({ id })
      }
      case 'doc.payment': {
        // ERPFIX-4 (BUG-ERP-16, decision_gate answered): a direct purchasing
        // payment is its own op. erp_settings.direct_payment_mode (default
        // 'warn') compares the Rial amount against the SAME approval
        // matrix's first tier (base currency is Rial throughout this
        // system — migrate.ts's "Toman tiers" comment is stale/wrong, not
        // a real unit); 'warn' raises a business_alert and still allows
        // it, 'block' rejects outright and points at the Treasury payment
        // order flow, 'off' is the historical no-check behavior.
        { const deny = await requireOp(auth.user, 'erp.purchasing:pay', 'edit'); if (deny) return deny }
        const { directPaymentGate } = await import('@/lib/erp/purchasingData')
        const gate = await directPaymentGate(d.amount)
        if (gate.blocked) return toApiResponse(businessError('ERP-PURCHASING-DIRECT-PAYMENT-BLOCKED', { amount: d.amount.toLocaleString() }))
        const r = await recordPayment(d.documentId, d.vendorId, d.amount, d.method, d.date, d.reference, uid)
        if (gate.warn) {
          try {
            const { pgQuery } = await import('@/lib/db')
            await pgQuery(
              `INSERT INTO business_alerts (kind, domain, severity, title_en, title_fa, detail, metric_value, ref_type, ref_id, channels, fingerprint, updated_at)
               VALUES ('direct_payment_above_tier','financial','warning','Direct purchase payment above the first approval tier','پرداخت مستقیم خرید بالاتر از سطح اول تأیید',$1,$2,'purchase_documents',$3,'["inapp"]',$4,to_char(now(),'YYYY-MM-DD HH24:MI:SS'))
               ON CONFLICT (fingerprint) DO UPDATE SET updated_at=to_char(now(),'YYYY-MM-DD HH24:MI:SS')`,
              [`Direct payment of ${d.amount.toLocaleString()} Rial recorded outside the Treasury payment-order flow`, d.amount, d.documentId, `direct_payment:${d.documentId}:${Date.now()}`])
          } catch { /* alert is best-effort */ }
        }
        if (!r.ok) {
          // Phase-5 three-way match block: recordPayment signals this class
          // with a stable prefix (not a generic string) so the route can
          // shape a proper bilingual error without the data layer knowing
          // about NextResponse/the error catalog.
          if (r.error?.startsWith('THREE_WAY_MATCH_FAILED: '))
            return toApiResponse(businessError('ERP-PURCHASING-PAYMENT-BLOCKED-MISMATCH', { reasons: r.error.slice('THREE_WAY_MATCH_FAILED: '.length) }))
          return NextResponse.json({ error: r.error }, { status: 400 })
        }
        await logAction(auth.user, 'erp.purchase.payment', 'purchase_documents', String(d.documentId), { amount: d.amount })
        return NextResponse.json({ ok: true })
      }
      case 'doc.paymentReverse': {
        // Phase 15 — undoing a previously committed purchase transaction is
        // exactly as sensitive as voiding one; reuses the SAME registered op
        // doc.void already requires rather than a new RBAC registration.
        { const deny = await requireOp(auth.user, 'erp.purchasing:void', 'edit'); if (deny) return deny }
        const r = await reverseDirectPayment(d.paymentId, uid)
        await logAction(auth.user, 'erp.purchase.paymentReverse', 'purchase_payments', String(d.paymentId), null, r, ip)
        return NextResponse.json(r)
      }
      case 'doc.match': {
        const r = await matchPurchaseInvoice(d.id)
        return NextResponse.json(r)
      }
      case 'doc.matchOverride': {
        // Overriding a failed three-way match to let a mismatched invoice be
        // paid anyway is an accounting-control bypass — administrator only,
        // reason required, fully audited (no silent bypass).
        if (!['super_admin', 'administrator'].includes(auth.user.role)) return NextResponse.json({ error: 'Overriding a three-way match requires an administrator' }, { status: 403 })
        const r = await overrideMatch(d.id, d.reason, uid)
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
        await logAction(auth.user, 'erp.purchase.matchOverride', 'purchase_documents', String(d.id), null, { reason: d.reason }, ip)
        return NextResponse.json({ ok: true })
      }
      case 'vendor.portalLink': {
        const w = await requireWrite(); if ('error' in w) return w.error
        const token = await issueVendorToken(d.vendorId, uid, d.days ?? 90)
        await logAction(auth.user, 'erp.vendor.portal.issue', 'purchase_vendors', String(d.vendorId), { days: d.days ?? 90 })
        return NextResponse.json({ token, path: `/en/vendor/${token}` })
      }
      case 'vendor.portalRevoke': {
        const w = await requireWrite(); if ('error' in w) return w.error
        const n = await revokeVendorTokens(d.vendorId)
        await logAction(auth.user, 'erp.vendor.portal.revoke', 'purchase_vendors', String(d.vendorId), { revoked: n })
        return NextResponse.json({ revoked: n })
      }
      case 'doc.post': {
        { const deny = await requireOp(auth.user, 'erp.purchasing:post', 'edit'); if (deny) return deny }
        // Posting to the double-entry GL is an accounting action — administrator only.
        if (!['super_admin', 'administrator'].includes(auth.user.role)) return NextResponse.json({ error: 'Posting to the GL requires an administrator' }, { status: 403 })
        const res = await postPurchaseInvoiceToGl(d.id, uid)
        await logAction(auth.user, 'erp.purchase.post', 'purchase_documents', String(d.id), { entryId: res.entryId, alreadyPosted: res.alreadyPosted })
        return NextResponse.json(res)
      }
      case 'doc.confirm': {
        { const deny = await requireOp(auth.user, 'erp.purchasing:confirm', 'edit'); if (deny) return deny }
        // 26.24b BUG-008: confirming a purchase invoice AUTO-POSTS it to the GL
        // (Cr Accounts Payable), mirroring sales. A closed period fails loudly and
        // the status rolls back so AP can never drift negative on later payment.
        try {
          const res = await confirmPurchaseInvoice(d.id, uid, d.warehouseId)
          await logAction(auth.user, 'erp.purchase.confirm', 'purchase_documents', String(d.id), null, { status: res.status, entryId: res.entryId }, ip)
          return NextResponse.json(res)
        } catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : 'Confirm failed' }, { status: 400 }) }
      }
      case 'doc.void': {
        { const deny = await requireOp(auth.user, 'erp.purchasing:void', 'edit'); if (deny) return deny }
        // Voiding a GL-posted purchase invoice books a balanced reversal entry.
        const res = await voidPurchaseInvoice(d.id, uid)
        await logAction(auth.user, 'erp.purchase.void', 'purchase_documents', String(d.id), null, { status: res.status, reversalId: res.reversalId, paymentsReversed: res.paymentsReversed }, ip)
        return NextResponse.json(res)
      }
    }
  } catch (e) { return apiError(e, 'Failed to update purchasing') }
}
