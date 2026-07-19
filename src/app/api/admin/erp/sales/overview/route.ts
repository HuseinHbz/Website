import { NextResponse } from 'next/server'
import { apiError, requireAdmin } from '@/lib/api/respond'
import { salesOverview } from '@/lib/erp/salesData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — sales dashboard: KPIs, recent documents, top customers.
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    return NextResponse.json(await salesOverview())
  } catch (e) { return apiError(e, 'Failed to load sales overview') }
}
