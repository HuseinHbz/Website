import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { analyticsEvents } from '@/lib/db/schema'

export async function POST(req: NextRequest) {
  try {
    const { type, page, locale, sessionId, metadata } = await req.json()
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined
    const ua = req.headers.get('user-agent') || undefined
    const referrer = req.headers.get('referer') || undefined
    const db = getDb()
    await db.insert(analyticsEvents).values({
      type: type || 'pageview',
      page,
      referrer,
      userAgent: ua,
      ipAddress: ip ?? undefined,
      locale,
      sessionId,
      metadata: metadata ? JSON.stringify(metadata) : null,
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
