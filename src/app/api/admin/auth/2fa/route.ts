import { NextRequest, NextResponse } from 'next/server'
import { guardJson, unauthorized } from '@/lib/api/respond'
import { generateTotpSecret, verifyTotpCode, generateTotpURI } from '@/lib/admin/auth'
import QRCode from 'qrcode'
import { getDb } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

// GET — generate setup QR code (?userId=xxx for managing other users)
export async function GET(req: NextRequest) {
  const adminUser = await getAdminUser()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const targetId = searchParams.get('userId') || adminUser.id

  if (targetId !== adminUser.id && adminUser.role !== 'super_admin' && adminUser.role !== 'administrator') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = getDb()
  const user = (await db.select().from(users).where(eq(users.id, targetId)))[0]
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const secret = (user.totpSecret && !user.totpEnabled) ? user.totpSecret : generateTotpSecret()
  await db.update(users).set({ totpSecret: secret }).where(eq(users.id, targetId))

  const otpauth = generateTotpURI(user.email, 'HBZ Admin', secret)
  const qrDataUrl = await QRCode.toDataURL(otpauth)

  return NextResponse.json({ secret, qrCode: qrDataUrl, enabled: user.totpEnabled, email: user.email })
}

// POST — enable or disable 2FA for a user (userId optional, defaults to self)
export async function POST(req: NextRequest) {
  const adminUser = await getAdminUser()
  if (!adminUser) return unauthorized()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, code, userId } = await guardJson(req) as { action: 'enable' | 'disable'; code: string; userId?: string }
  const targetId = userId || adminUser.id

  if (targetId !== adminUser.id && adminUser.role !== 'super_admin' && adminUser.role !== 'administrator') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = getDb()
  const user = (await db.select().from(users).where(eq(users.id, targetId)))[0]
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (action === 'enable') {
    if (!user.totpSecret) return NextResponse.json({ error: 'No secret generated' }, { status: 400 })
    if (!verifyTotpCode(code, user.totpSecret)) return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    await db.update(users).set({ totpEnabled: true }).where(eq(users.id, targetId))
    await logAction(adminUser, 'UPDATE', 'users', targetId, null, { totpEnabled: true })
    return NextResponse.json({ ok: true })
  }

  if (action === 'disable') {
    await db.update(users).set({ totpEnabled: false, totpSecret: null }).where(eq(users.id, targetId))
    await logAction(adminUser, 'UPDATE', 'users', targetId, null, { totpEnabled: false })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
