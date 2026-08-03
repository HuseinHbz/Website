import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, requirePermission, requireOp } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import {
  listVendors, createVendor, updateVendor, evaluateVendor, vendorPosition, vendorEvaluationHistory,
  listDocuments, getDocument, saveDocument, submitDocument, decideApproval,
  recordPayment, convertDocument, overview, postPurchaseInvoiceToGl, analytics,
  receiveDocument, compareQuotes, confirmPurchaseInvoice, voidPurchaseInvoice,
} from '@/lib/erp/purchasingData'
import { issueVendorToken, revokeVendorTokens } from '@/lib/erp/vendorPortal'
import type { PurchaseDocType } from '@/lib/erp/purchasing'
import { clientIp } from '@/lib/api/clientIp'

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
    if (sp.get('vendorPosition')) return NextResponse.json(await vendorPosition(Number(sp.get('vendorPosition'))))
    // 26.32 بند۴: the evaluation history was written and never read — now readable.
    if (sp.get('evaluations')) return NextResponse.json({ evaluations: await vendorEvaluationHistory(Number(sp.get('evaluations'))) })
    if (sp.get('compare')) return NextResponse.json({ quotes: await compareQuotes(Number(sp.get('compare'))) })
    if (sp.get('id')) {
      const doc = await getDocument(Number(sp.get('id')))
      return doc ? NextResponse.json(doc) : NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const type = sp.get('type') as PurchaseDocType | null
    return NextResponse.json({ documents: await listDocuments(type ?? undefined) })
  } catch (e) { return apiError(e, 'Failed to load purchasing data') }
}

const lineSchema = z.object({ description: z.string().min(1).max(300), qty: z.number(), unitPrice: z.number(), discountPct: z.number().default(0), taxPct: z.number().default(0), productId: z.number().int().nullable().optional() })
const vendorCreate = z.object({ action: z.literal('vendor.create'), name: z.string().min(1).max(160), kind: z.enum(['individual', 'company', 'international']).optional(), email: z.string().max(160).optional(), phone: z.string().max(40).optional(), taxId: z.string().max(40).optional(), economicCode: z.string().max(40).optional(), address: z.string().max(400).optional(), iban: z.string().max(40).optional(), currency: z.string().max(4).optional(), paymentTerms: z.number().int().optional() })
const vendorUpdate = z.object({ action: z.literal('vendor.update'), id: z.number().int(), name: z.string().max(160).optional(), email: z.string().max(160).optional(), phone: z.string().max(40).optional(), taxId: z.string().max(40).optional(), address: z.string().max(400).optional(), iban: z.string().max(40).optional(), currency: z.string().max(4).optional(), paymentTerms: z.number().int().optional() })
const score = z.number().min(0).max(5)
const evaluate = z.object({ action: z.literal('vendor.evaluate'), vendorId: z.number().int(), quality: score, delivery: score, price: score, service: score, compliance: score, note: z.string().max(500).optional() })
const docSave = z.object({ action: z.literal('doc.save'), id: z.number().int().optional(), docType: z.enum(DOC_TYPES), vendorId: z.number().int().optional(), date: z.string().max(20), currency: z.string().max(4).optional(), department: z.string().max(80).optional(), budget: z.number().optional(), sourceId: z.number().int().optional(), note: z.string().max(1000).optional(), priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(), lines: z.array(lineSchema).max(200).default([]) })
const docSubmit = z.object({ action: z.literal('doc.submit'), id: z.number().int() })
const docApprove = z.object({ action: z.literal('doc.approve'), id: z.number().int(), level: z.number().int().min(1).max(3), decision: z.enum(['approved', 'rejected']), comment: z.string().max(500).optional() })
const docConvert = z.object({ action: z.literal('doc.convert'), sourceId: z.number().int(), toType: z.enum(DOC_TYPES) })
const docPayment = z.object({ action: z.literal('doc.payment'), documentId: z.number().int(), vendorId: z.number().int(), amount: z.number().positive(), method: z.enum(['cash', 'bank', 'card', 'cheque', 'other']), date: z.string().max(20), reference: z.string().max(80).optional() })
const docPost = z.object({ action: z.literal('doc.post'), id: z.number().int() })
const docConfirm = z.object({ action: z.literal('doc.confirm'), id: z.number().int() })
const docVoid = z.object({ action: z.literal('doc.void'), id: z.number().int() })
const docReceive = z.object({ action: z.literal('doc.receive'), id: z.number().int(), warehouseId: z.number().int(), lines: z.array(z.object({ lineId: z.number().int(), qty: z.number().min(0) })).optional() })
const portalLink = z.object({ action: z.literal('vendor.portalLink'), vendorId: z.number().int(), days: z.number().int().min(1).max(365).optional() })
const portalRevoke = z.object({ action: z.literal('vendor.portalRevoke'), vendorId: z.number().int() })
const body = z.discriminatedUnion('action', [vendorCreate, vendorUpdate, evaluate, docSave, docSubmit, docApprove, docConvert, docPayment, docPost, docConfirm, docVoid, docReceive, portalLink, portalRevoke])

export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.purchasing', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, body)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  const uid = auth.user.id
  const ip = clientIp(req)
  try {
    switch (d.action) {
      case 'vendor.create': { const id = await createVendor(d, uid); await logAction(auth.user, 'erp.vendor.create', 'purchase_vendors', String(id), { name: d.name }); return NextResponse.json({ id }) }
      case 'vendor.update': { await updateVendor(d.id, d); await logAction(auth.user, 'erp.vendor.update', 'purchase_vendors', String(d.id), {}); return NextResponse.json({ ok: true }) }
      case 'vendor.evaluate': { const s = await evaluateVendor(d.vendorId, d, d.note, uid); await logAction(auth.user, 'erp.vendor.evaluate', 'purchase_vendors', String(d.vendorId), { score: s.score, grade: s.grade }); return NextResponse.json(s) }
      case 'doc.save': { const id = await saveDocument(d, uid); await logAction(auth.user, 'erp.purchase.save', 'purchase_documents', String(id), { type: d.docType }); return NextResponse.json({ id }) }
      case 'doc.submit': {
        const r = await submitDocument(d.id)
        if (!r.ok) return NextResponse.json({ error: r.error, budget: r.budget }, { status: 400 })
        await logAction(auth.user, 'erp.purchase.submit', 'purchase_documents', String(d.id), {})
        return NextResponse.json({ ok: true })
      }
      case 'doc.receive': {
        const r = await receiveDocument(d.id, d.warehouseId, d.lines, uid)
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
        await logAction(auth.user, 'erp.purchase.receive', 'purchase_documents', String(d.id), { received: r.received, status: r.status, warehouseId: d.warehouseId })
        return NextResponse.json(r)
      }
      case 'doc.approve': {
        // Level ≥2 approvals require an elevated role (multi-level approval).
        if (d.level >= 2 && !['super_admin', 'administrator'].includes(auth.user.role)) return NextResponse.json({ error: 'This approval level requires an administrator' }, { status: 403 })
        const status = await decideApproval(d.id, d.level, d.decision, uid, d.comment)
        await logAction(auth.user, 'erp.purchase.approve', 'purchase_documents', String(d.id), { level: d.level }, { decision: d.decision, status }, ip)
        return NextResponse.json({ ok: true, status })
      }
      case 'doc.convert': { const id = await convertDocument(d.sourceId, d.toType, uid); await logAction(auth.user, 'erp.purchase.convert', 'purchase_documents', String(id), { from: d.sourceId, to: d.toType }); return NextResponse.json({ id }) }
      case 'doc.payment': { await recordPayment(d.documentId, d.vendorId, d.amount, d.method, d.date, d.reference, uid); await logAction(auth.user, 'erp.purchase.payment', 'purchase_documents', String(d.documentId), { amount: d.amount }); return NextResponse.json({ ok: true }) }
      case 'vendor.portalLink': {
        const token = await issueVendorToken(d.vendorId, uid, d.days ?? 90)
        await logAction(auth.user, 'erp.vendor.portal.issue', 'purchase_vendors', String(d.vendorId), { days: d.days ?? 90 })
        return NextResponse.json({ token, path: `/en/vendor/${token}` })
      }
      case 'vendor.portalRevoke': {
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
          const res = await confirmPurchaseInvoice(d.id, uid)
          await logAction(auth.user, 'erp.purchase.confirm', 'purchase_documents', String(d.id), null, { status: res.status, entryId: res.entryId }, ip)
          return NextResponse.json(res)
        } catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : 'Confirm failed' }, { status: 400 }) }
      }
      case 'doc.void': {
        { const deny = await requireOp(auth.user, 'erp.purchasing:void', 'edit'); if (deny) return deny }
        // Voiding a GL-posted purchase invoice books a balanced reversal entry.
        const res = await voidPurchaseInvoice(d.id, uid)
        await logAction(auth.user, 'erp.purchase.void', 'purchase_documents', String(d.id), null, { status: res.status, reversalId: res.reversalId }, ip)
        return NextResponse.json(res)
      }
    }
  } catch (e) { return apiError(e, 'Failed to update purchasing') }
}
