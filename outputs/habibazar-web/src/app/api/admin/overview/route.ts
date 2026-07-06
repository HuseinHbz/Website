import { NextResponse } from 'next/server'
import { apiError, requireAdmin } from '@/lib/api/respond'
import { executiveOverview } from '@/lib/admin/executiveOverview'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — cross-module executive summary for the admin dashboard.
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    return NextResponse.json(await executiveOverview())
  } catch (e) { return apiError(e, 'Failed to load overview') }
}
