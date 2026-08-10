import { NextRequest, NextResponse } from 'next/server'
import { requireHrPortal } from '@/lib/hr/portalGuard'
import { portalEmployee, portalDashboard } from '@/lib/hr/portalData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requireHrPortal(req)
  if ('error' in auth) return auth.error
  const employee = await portalEmployee(auth.identity.employeeId)
  if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const dashboard = await portalDashboard(auth.identity.employeeId)
  return NextResponse.json({ employee, dashboard })
}
