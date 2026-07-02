import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { signIn } from '@/lib/admin/auth'
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { logger } from '@/lib/logger'
import { readJson } from '@/lib/api/respond'

const schema = z.object({
  email: z.string().trim().email('invalid email').max(200),
  password: z.string().min(1).max(200),
  totpCode: z.string().trim().max(20).optional().nullable(),
})

let initialized = false

async function ensureInit() {
  if (!initialized) {
    runMigrations()
    await seedDatabase()
    initialized = true
  }
}

export async function POST(req: NextRequest) {
  await ensureInit()
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const { email, password, totpCode } = parsed.data
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined
  const ua = req.headers.get('user-agent') || undefined
  const result = await signIn(email, password, ip ?? undefined, ua, totpCode ?? undefined)
  if (result.error) {
    logger.security('Failed login attempt', { email, ip, ua: ua?.slice(0, 100) })
    return NextResponse.json({ error: result.error }, { status: 401 })
  }
  if (result.requireTotp) {
    return NextResponse.json({ requireTotp: true }, { status: 200 })
  }
  logger.audit('LOGIN', 'admin', undefined, { email, ip })
  return NextResponse.json({ user: result.user })
}
