import { NextRequest, NextResponse } from 'next/server'
import { requireHrPortal } from '@/lib/hr/portalGuard'
import { myLeaveCancel } from '@/lib/hr/portalData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// DELETE — cancel MY OWN pending/approved leave request. `myLeaveCancel`
// checks ownership internally and refuses (never approves/rejects) — an
// employee cannot decide their own request, only withdraw it.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireHrPortal(req)
  if ('error' in auth) return auth.error
  const { id } = await params
  const r = await myLeaveCancel(auth.identity.employeeId, Number(id))
  if (!r.ok) {
    // A request that belongs to someone else answers 404, not 400 — existence
    // is not leaked (26.25a IDOR pattern).
    if (r.error === 'Not found') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ error: r.error }, { status: 400 })
  }
  return NextResponse.json(r)
}
