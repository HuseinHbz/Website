import { NextRequest, NextResponse } from 'next/server'
import { requireHrPortal } from '@/lib/hr/portalGuard'
import { myPayslipDetail } from '@/lib/hr/portalData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — one payslip. Ownership AND period-finality are both checked inside
// `myPayslipDetail`; either failure returns null → 404 here, so a foreign
// slip id and a not-yet-approved slip look identical from the outside.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireHrPortal(req)
  if ('error' in auth) return auth.error
  const { id } = await params
  const slip = await myPayslipDetail(auth.identity.employeeId, Number(id))
  if (!slip) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(slip)
}
