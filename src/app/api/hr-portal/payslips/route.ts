import { NextRequest, NextResponse } from 'next/server'
import { requireHrPortal } from '@/lib/hr/portalGuard'
import { myPayslips, myAnnualSummary } from '@/lib/hr/portalData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requireHrPortal(req)
  if ('error' in auth) return auth.error
  const sp = req.nextUrl.searchParams
  const year = sp.get('year') ? Number(sp.get('year')) : null
  return NextResponse.json({
    slips: await myPayslips(auth.identity.employeeId),
    annual: year ? await myAnnualSummary(auth.identity.employeeId, year) : null,
  })
}
