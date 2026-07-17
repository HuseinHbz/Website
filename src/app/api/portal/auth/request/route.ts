import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { readJson, badRequest } from '@/lib/api/respond'
import { limiters } from '@/lib/rateLimit'
import { clientIp } from '@/lib/api/clientIp'
import { requestOtp } from '@/lib/portal/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({ channel: z.enum(['sms', 'email']), identifier: z.string().min(3).max(160) })

// POST — request a portal login OTP. Stricter rate limit than the public API.
// Always returns a neutral 200 (no account enumeration) whether or not the
// identifier matches a customer.
export async function POST(req: NextRequest) {
  const ip = clientIp(req) ?? 'ip'
  if (!limiters.portalOtp(ip).allowed) return NextResponse.json({ error: 'Too many requests — try again later.' }, { status: 429, headers: { 'Retry-After': '900' } })
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  try {
    const { sessionId } = await requestOtp(parsed.data.channel, parsed.data.identifier, ip)
    // Neutral response: reveal only the sessionId when one was created; the
    // client always sees "if the account exists, a code was sent".
    return NextResponse.json({ ok: true, sessionId })
  } catch { return badRequest('Could not start login') }
}
