import { NextRequest, NextResponse } from 'next/server'
import { requireHrPortal } from '@/lib/hr/portalGuard'
import { revokeAllEmployeeSessions, HR_PORTAL_COOKIE } from '@/lib/hr/portalSession'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST — log out of every device (revoke all sessions) + clear the cookie.
export async function POST(req: NextRequest) {
  const auth = await requireHrPortal(req)
  if ('error' in auth) return auth.error
  await revokeAllEmployeeSessions(auth.identity.employeeId)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(HR_PORTAL_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}
