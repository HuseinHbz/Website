import { NextRequest, NextResponse } from 'next/server'
import { signIn } from '@/lib/admin/auth'
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { logger } from '@/lib/logger'

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
  const { email, password, totpCode } = await req.json()
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined
  const ua = req.headers.get('user-agent') || undefined
  const result = await signIn(email, password, ip ?? undefined, ua, totpCode)
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
