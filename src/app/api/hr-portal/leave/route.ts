import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { readJson, badRequest } from '@/lib/api/respond'
import { requireHrPortal } from '@/lib/hr/portalGuard'
import { myLeaveOverview, myLeaveRequests, myLeaveRequest, myCalendar } from '@/lib/hr/portalData'
import { listLeaveTypes } from '@/lib/hr/leaveData'
import { leaveRefusalMessage, type LeaveCheck } from '@/lib/hr/leave'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({
  leaveTypeId: z.number().int().positive(),
  startDate: z.string().trim().min(4).max(24),
  endDate: z.string().trim().min(4).max(24),
  halfDay: z.boolean().optional(),
  reason: z.string().trim().max(500).optional().nullable(),
})

export async function GET(req: NextRequest) {
  const auth = await requireHrPortal(req)
  if ('error' in auth) return auth.error
  const sp = req.nextUrl.searchParams
  if (sp.get('view') === 'calendar') {
    return NextResponse.json(await myCalendar(sp.get('from') ?? undefined, sp.get('to') ?? undefined))
  }
  const { balances, ledger } = await myLeaveOverview(auth.identity.employeeId)
  return NextResponse.json({
    balances, ledger,
    requests: await myLeaveRequests(auth.identity.employeeId),
    types: await listLeaveTypes(),
  })
}

// POST — submit a leave request. 🔴 employeeId is NEVER read from the body —
// it comes from the session, so a request can never be filed in someone
// else's name. Days are computed server-side; a request beyond the balance is
// refused with the reason, never silently shortened (reuse of 28.2 exactly).
export async function POST(req: NextRequest) {
  const auth = await requireHrPortal(req)
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const r = await myLeaveRequest(auth.identity.employeeId, parsed.data)
  if (!r.ok) {
    return badRequest(leaveRefusalMessage((r.reason ?? 'invalid_range') as NonNullable<LeaveCheck['reason']>, true))
  }
  return NextResponse.json(r, { status: 201 })
}
