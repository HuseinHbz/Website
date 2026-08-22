import { NextRequest, NextResponse } from 'next/server'
import { requirePortal } from '@/lib/portal/guard'
import { portalInvoice } from '@/lib/portal/portalData'
import { loadCompanyProfile } from '@/lib/erp/documentData'
import { renderDocumentHtml, buildSalesPayload, defaultTitle, type DocModel } from '@/lib/erp/documents'
import { SITE } from '@/lib/site'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — printable invoice HTML (own invoice only; foreign id → 404).
// DOC-BRAND бнд۶: this used to be a second, hand-rolled HTML template
// completely independent of the Document Engine's shared HBZ letterhead
// (renderDocumentHtml) — a customer's portal-printed invoice looked
// nothing like an admin-generated one, and repeated the exact same
// Latin-digit numeral bug (`.toLocaleString()` with no fa-IR locale).
// Reused instead of duplicated: same engine, same fa-IR/Jalali formatting,
// same letterhead — one fix in documents.ts now covers every print path.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePortal(req)
  if ('error' in auth) return auth.error
  const { id } = await params
  const inv = await portalInvoice(auth.identity.customerId, Number(id))
  if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const d = inv.doc as Record<string, unknown>

  const { branding, companyName } = await loadCompanyProfile()
  const lines = (inv.lines as { description: string; qty: number; unitPrice: number; lineTotal: number }[])
  const payload = buildSalesPayload(
    lines.map(l => ({ description: l.description, qty: l.qty, unitPrice: l.unitPrice, discountPct: 0, taxPct: 0 })),
    String(d.currency || 'IRR'),
    [
      { label: 'شماره پیگیری', value: String(d.docNo ?? '') },
      ...(d.dueDate ? [{ label: 'تاریخ سررسید', value: String(d.dueDate) }] : []),
      { label: 'وضعیت', value: String(d.status ?? '') },
      { label: 'پرداخت‌شده', value: `${inv.paid.toLocaleString()}` },
      { label: 'مانده', value: `${inv.outstanding.toLocaleString()}` },
    ],
  )
  // Recompute totals from the SAME actual line amounts/subtotal/tax the
  // invoice was issued with (buildSalesPayload's own discount/tax-from-
  // percentage math doesn't apply here — the source figures are already
  // final) rather than re-deriving them from qty×price a second time.
  payload.subtotal = Number(d.subtotal) || payload.subtotal
  payload.discountTotal = Number(d.discountTotal) || 0
  payload.taxTotal = Number(d.taxTotal) || 0
  payload.total = Number(d.total) || payload.total

  // No QR/verify code here — /verify/[code] only recognizes gen_documents.
  // verify_code, and this route renders directly from sales_documents,
  // which never registers one. A QR pointing at a code that always resolves
  // "Document not found" would be worse than no QR — an honest boundary,
  // not a missing feature to fake.
  const model: DocModel = {
    type: 'invoice', number: String(d.docNo ?? ''), date: String(d.date ?? ''),
    title: defaultTitle('invoice', true),
    partyName: String(d.customerName ?? ''), partyInfo: String(d.customerAddress ?? ''),
    issuerName: companyName ?? SITE.name ?? 'HBZ Technology', issuerInfo: SITE.url,
    payload, verifyCode: '', verifyUrl: '',
    branding,
    template: { rtl: true, showQr: false },
  }
  return new NextResponse(renderDocumentHtml(model, ''), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
}
