import { NextResponse } from 'next/server'
import { apiError, requirePermission } from '@/lib/api/respond'
import { salesOverview } from '@/lib/erp/salesData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — sales dashboard: KPIs, recent documents, top customers.
export async function GET() {
  const auth = await requirePermission('erp.sales', 'read')
  if ('error' in auth) return auth.error
  try {
    return NextResponse.json(await salesOverview())
  } catch (e) { return apiError(e, 'Failed to load sales overview') }
}
