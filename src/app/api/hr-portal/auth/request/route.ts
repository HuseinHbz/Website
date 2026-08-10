import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { readJson, badRequest } from '@/lib/api/respond'
import { limiters } from '@/lib/rateLimit'
import { clientIp } from '@/lib/api/clientIp'
import { requestEmployeeOtp } from '@/lib/hr/portalSession'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({ mobile: z.string().min(8).max(20) })

// POST — request an employee-portal login OTP. Always a neutral 200, whether
// or not the mobile matches an employee (no enumeration).
export async function POST(req: NextRequest) {
  const ip = clientIp(req) ?? 'ip'
  if (!limiters.hrPortalOtp(ip).allowed) {
    return NextResponse.json({ error: 'Too many requests — try again later.' }, { status: 429, headers: { 'Retry-After': '900' } })
  }
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  try {
    const { sessionId } = await requestEmployeeOtp(parsed.data.mobile, ip)
    return NextResponse.json({ ok: true, sessionId })
  } catch { return badRequest('Could not start login') }
}
