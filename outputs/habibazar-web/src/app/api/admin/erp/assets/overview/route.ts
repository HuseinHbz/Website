import { NextResponse } from 'next/server'
import { apiError, requireAdmin } from '@/lib/api/respond'
import { assetOverview } from '@/lib/erp/assetData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — asset dashboard: KPIs, by-type/status, attention list, upcoming maintenance.
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    return NextResponse.json(await assetOverview())
  } catch (e) { return apiError(e, 'Failed to load asset overview') }
}
