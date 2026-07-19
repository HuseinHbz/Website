import { NextRequest, NextResponse } from 'next/server'
import { requirePortal } from '@/lib/portal/guard'
import { portalPayments } from '@/lib/portal/portalData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requirePortal(req)
  if ('error' in auth) return auth.error
  return NextResponse.json({ payments: await portalPayments(auth.identity.customerId) })
}
