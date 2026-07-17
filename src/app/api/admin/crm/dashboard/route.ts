import { NextResponse } from 'next/server'
import { apiError, requireAdmin } from '@/lib/api/respond'
import { crmDashboard } from '@/lib/crm/crmDashboardData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    return NextResponse.json(await crmDashboard())
  } catch (e) { return apiError(e, 'Failed to load CRM dashboard') }
}
