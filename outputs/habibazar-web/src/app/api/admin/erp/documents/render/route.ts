import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, readJson } from '@/lib/api/respond'
import { z } from 'zod'
import QRCode from 'qrcode'
import { renderDocument, loadCompanyProfile } from '@/lib/erp/documentData'
import { renderDocumentHtml, buildSalesPayload, type DocModel, type DocTemplateConfig } from '@/lib/erp/documents'
import { SITE } from '@/lib/site'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET ?id=[&template=key] — the print-ready HTML for a document (opened in a new
// tab to print / save as PDF). `template` overrides the stored designer template.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const id = Number(req.nextUrl.searchParams.get('id'))
  if (!id) return new NextResponse('id required', { status: 400 })
  try {
    const html = await renderDocument(id, req.nextUrl.searchParams.get('template') ?? undefined)
    if (!html) return new NextResponse('Not found', { status: 404 })
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch {
    return new NextResponse('Render failed', { status: 500 })
  }
}

const previewSchema = z.object({ config: z.record(z.string(), z.unknown()) })

// POST — Invoice Designer live preview: renders a demo invoice with the draft
// template config + the real company profile (no document is stored).
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, previewSchema)
  if ('error' in parsed) return parsed.error
  try {
    const { branding, companyName } = await loadCompanyProfile()
    const payload = buildSalesPayload([
      { description: 'Enterprise infrastructure service', qty: 2, unitPrice: 1200, discountPct: 0, taxPct: 9 },
      { description: 'Managed security (monthly)', qty: 1, unitPrice: 800, discountPct: 10, taxPct: 9 },
    ], 'USD', [{ label: 'Reference', value: 'DESIGN-PREVIEW' }])
    const verifyUrl = `${SITE.url}/verify/PREVIEW`
    const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 168 })
    const model: DocModel = {
      type: 'invoice', number: 'INV-PREVIEW-0001', date: new Date().toISOString().slice(0, 10),
      title: 'INVOICE', partyName: 'Demo Customer LLC', partyInfo: 'No. 1, Demo St.',
      issuerName: companyName ?? SITE.name ?? 'HBZ Technology', issuerInfo: SITE.url,
      payload, verifyCode: 'PREVIEW', verifyUrl,
      branding, template: parsed.data.config as DocTemplateConfig,
    }
    return new NextResponse(renderDocumentHtml(model, qr), { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch {
    return new NextResponse('Preview failed', { status: 500 })
  }
}
