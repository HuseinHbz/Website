import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/respond'
import { renderDocument } from '@/lib/erp/documentData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET ?id= — the print-ready HTML for a document (opened in a new tab to print /
// save as PDF). Auth-gated.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const id = Number(req.nextUrl.searchParams.get('id'))
  if (!id) return new NextResponse('id required', { status: 400 })
  try {
    const html = await renderDocument(id)
    if (!html) return new NextResponse('Not found', { status: 404 })
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch {
    return new NextResponse('Render failed', { status: 500 })
  }
}
