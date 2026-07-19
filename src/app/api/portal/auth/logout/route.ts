import { NextRequest, NextResponse } from 'next/server'
import { requirePortal } from '@/lib/portal/guard'
import { revokeAllSessions, PORTAL_COOKIE } from '@/lib/portal/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST — log out of every device (revoke all sessions) + clear the cookie.
export async function POST(req: NextRequest) {
  const auth = await requirePortal(req)
  if ('error' in auth) return auth.error
  await revokeAllSessions(auth.identity.customerId)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(PORTAL_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}
