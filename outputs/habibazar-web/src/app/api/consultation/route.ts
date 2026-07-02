import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { consultationRequests } from '@/lib/db/schema'
import { notify } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, phone, company, message, preferredDate, marketingConsent, locale, kind } = body

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(String(email))) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
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

    // Send notifications asynchronously (don't block response)
    notify({
      type: 'consultation',
      subject: `New consultation request from ${name}`,
      body: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || '-'}\nCompany: ${company || '-'}\nMessage: ${message}${preferredDate ? `\nPreferred Date: ${preferredDate}` : ''}`,
    }).catch(console.error)

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
