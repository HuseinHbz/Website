import { NextResponse } from 'next/server'
import { apiError, requirePermission } from '@/lib/api/respond'
import { crmDashboard } from '@/lib/crm/crmDashboardData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const auth = await requirePermission('crm.crm.dashboard', 'read')
  if ('error' in auth) return auth.error
  try {
    return NextResponse.json(await crmDashboard())
  } catch (e) { return apiError(e, 'Failed to load CRM dashboard') }
}
