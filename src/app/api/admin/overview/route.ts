import { NextResponse } from 'next/server'
import { apiError, requirePermission } from '@/lib/api/respond'
import { executiveOverview } from '@/lib/admin/executiveOverview'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — cross-module executive summary for the admin dashboard.
export async function GET() {
  const auth = await requirePermission('executive.home', 'read')
  if ('error' in auth) return auth.error
  try {
    return NextResponse.json(await executiveOverview())
  } catch (e) { return apiError(e, 'Failed to load overview') }
}
