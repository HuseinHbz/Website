import { NextRequest, NextResponse } from 'next/server'
import { requirePortal } from '@/lib/portal/guard'
import { portalDashboard, portalChannels } from '@/lib/portal/portalData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requirePortal(req)
  if ('error' in auth) return auth.error
  const dash = await portalDashboard(auth.identity.customerId)
  if (!dash) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const channels = await portalChannels(auth.identity.customerId)
  return NextResponse.json({ ...dash, channels })
}
