import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { consultationRequests } from '@/lib/db/schema'
import { notify } from '@/lib/notifications'
import { logger } from '@/lib/logger'
import { apiError, readJson } from '@/lib/api/respond'

const schema = z.object({
  name: z.string().trim().min(1, 'required').max(200),
  email: z.string().trim().email('invalid email').max(200),
  phone: z.string().trim().max(50).optional().nullable(),
  company: z.string().trim().max(200).optional().nullable(),
  message: z.string().trim().min(1, 'required').max(5000),
  preferredDate: z.string().trim().max(100).optional().nullable(),
  marketingConsent: z.boolean().optional(),
  locale: z.enum(['en', 'fa']).optional(),
  kind: z.string().trim().max(50).optional(),
})

export async function POST(req: Request) {
  try {
    const parsed = await readJson(req, schema)
    if ('error' in parsed) return parsed.error
    const { name, email, phone, company, message, preferredDate, locale, kind } = parsed.data

    const db = getDb()
    await db.insert(consultationRequests).values({
      name,
      email,
      phone: phone || null,
      company: company || null,
      projectDescription: message,
      preferredDate: preferredDate || null,
      type: kind === 'INTRO_CALL' ? 'intro' : 'full',
      locale: locale || 'en',
      status: 'new',
    })

    // Fire-and-forget notification — never block or fail the request on it.
    notify({
      type: 'consultation',
      subject: `New consultation request from ${name}`,
      body: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || '-'}\nCompany: ${company || '-'}\nMessage: ${message}${preferredDate ? `\nPreferred Date: ${preferredDate}` : ''}`,
    }).catch((err) => logger.error('consultation notify failed', { error: String(err) }))

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
