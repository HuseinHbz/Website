import { NextResponse } from 'next/server'
import { apiError, requirePermission } from '@/lib/api/respond'
import { executiveCockpit } from '@/lib/bi/cockpitData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const auth = await requirePermission('erp.business-intelligence', 'read')
  if ('error' in auth) return auth.error
  try { return NextResponse.json(await executiveCockpit()) } catch (e) { return apiError(e, 'Cockpit failed') }
}
