import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { readJson } from '@/lib/api/respond'
import { limiters } from '@/lib/rateLimit'
import { clientIp } from '@/lib/api/clientIp'
import { verifyOtp, PORTAL_COOKIE } from '@/lib/portal/session'
import { SESSION_TTL_HOURS } from '@/lib/crm/portal'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({ sessionId: z.number().int().positive(), code: z.string().regex(/^\d{4,8}$/) })

// POST — verify the OTP → issue an httpOnly portal cookie (independent of admin).
export async function POST(req: NextRequest) {
  const ip = clientIp(req) ?? 'ip'
  if (!limiters.portalVerify(ip).allowed) return NextResponse.json({ error: 'Too many attempts — try again later.' }, { status: 429, headers: { 'Retry-After': '900' } })
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const r = await verifyOtp(parsed.data.sessionId, parsed.data.code)
  if (!r.ok || !r.token) {
    const status = r.reason === 'too_many_attempts' ? 429 : 401
    return NextResponse.json({ error: r.reason === 'too_many_attempts' ? 'Locked — too many attempts' : 'Invalid or expired code' }, { status })
  }
  const res = NextResponse.json({ ok: true, customerId: r.customerId })
  res.cookies.set(PORTAL_COOKIE, r.token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    path: '/', maxAge: SESSION_TTL_HOURS * 3600,
  })
  return res
}
