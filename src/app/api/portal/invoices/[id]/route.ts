import { NextRequest, NextResponse } from 'next/server'
import { requirePortal } from '@/lib/portal/guard'
import { portalInvoice } from '@/lib/portal/portalData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — one invoice. The data layer binds customer_id from the SESSION, so a
// foreign invoice id resolves to null → 404 (IDOR guard, بند ۲.۵).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePortal(req)
  if ('error' in auth) return auth.error
  const { id } = await params
  const inv = await portalInvoice(auth.identity.customerId, Number(id))
  if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(inv)
}
