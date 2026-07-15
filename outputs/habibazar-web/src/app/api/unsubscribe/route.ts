import { NextRequest, NextResponse } from 'next/server'
import { pgQuery } from '@/lib/db'
import { limiters } from '@/lib/rateLimit'
import { clientIp } from '@/lib/api/clientIp'
import { verifyUnsubscribe } from '@/lib/messaging/webhookVerify'
import { optOut } from '@/lib/crm/channelData'
import type { Channel } from '@/lib/messaging/provider'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function secret(): Promise<string> {
  return (await pgQuery<{ value: string }>(`SELECT value FROM erp_settings WHERE key='admin_jwt_secret'`))[0]?.value
    || process.env.ADMIN_JWT_SECRET || 'unsub-secret'
}

// GET /api/unsubscribe?token=... — HMAC-signed, expiring opt-out link (email
// List-Unsubscribe + sms/telegram/whatsapp). Public + rate-limited.
export async function GET(req: NextRequest) {
  if (!limiters.contact(clientIp(req) ?? "ip").allowed) return new NextResponse('rate limited', { status: 429 })
  const token = req.nextUrl.searchParams.get('token') ?? ''
  const data = verifyUnsubscribe(token, await secret())
  if (!data) return new NextResponse('این لینک نامعتبر یا منقضی شده است. / Invalid or expired link.', { status: 400 })
  await optOut(data.channel as Channel, data.target, 'unsubscribe_link')
  return new NextResponse('شما با موفقیت از دریافت پیام‌ها لغو شدید. / You have been unsubscribed.', { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } })
}

// POST (email clients hitting List-Unsubscribe=One-Click) → same effect.
export async function POST(req: NextRequest) {
  return GET(req)
}
