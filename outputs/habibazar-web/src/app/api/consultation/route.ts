import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { consultationRequests } from '@/lib/db/schema'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, phone, company, message, preferredDate, marketingConsent, locale, kind } = body

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = getDb()
    await db.insert(consultationRequests).values({
      name: String(name).trim(),
      email: String(email).trim(),
      phone: phone ? String(phone).trim() : null,
      company: company ? String(company).trim() : null,
      projectDescription: message ? String(message).trim() : null,
      preferredDate: preferredDate ? String(preferredDate).trim() : null,
      type: kind === 'INTRO_CALL' ? 'intro' : 'full',
      locale: locale || 'en',
      status: 'new',
    })

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
