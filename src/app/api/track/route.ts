import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { analyticsEvents } from '@/lib/db/schema'

// Public, unauthenticated analytics beacon — validate + cap every field so it
// can't be abused to bloat the DB with oversized payloads.
const schema = z.object({
  type: z.string().trim().max(50).optional(),
  page: z.string().trim().max(500).optional().nullable(),
  locale: z.enum(['en', 'fa']).optional().nullable(),
  sessionId: z.string().trim().max(100).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json()
    const parsed = schema.safeParse(raw)
    if (!parsed.success) return NextResponse.json({ ok: false })
    const { type, page, locale, sessionId, metadata } = parsed.data

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined
    const ua = req.headers.get('user-agent') || undefined
    const referrer = req.headers.get('referer') || undefined
    // Bound the serialized metadata size to prevent abuse.
    let metaStr: string | null = null
    if (metadata) {
      const s = JSON.stringify(metadata)
      metaStr = s.length > 4000 ? s.slice(0, 4000) : s
    }
    const db = getDb()
    await db.insert(analyticsEvents).values({
      type: type || 'pageview',
      page: page || undefined,
      referrer,
      userAgent: ua,
      ipAddress: ip ?? undefined,
      locale: locale || undefined,
      sessionId: sessionId || undefined,
      metadata: metaStr,
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
