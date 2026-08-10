import { NextRequest, NextResponse } from 'next/server'
import { badRequest } from '@/lib/api/respond'
import { requireHrPortal } from '@/lib/hr/portalGuard'
import { myAttendance } from '@/lib/hr/portalData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — my attendance/timesheet for a period. Read-only: the employee never
// writes attendance from the portal, only views what was recorded.
export async function GET(req: NextRequest) {
  const auth = await requireHrPortal(req)
  if ('error' in auth) return auth.error
  const sp = req.nextUrl.searchParams
  const from = sp.get('from') ?? ''
  const to = sp.get('to') ?? ''
  if (!from || !to) return badRequest('from and to required')
  return NextResponse.json(await myAttendance(auth.identity.employeeId, from, to))
}
