import { NextRequest, NextResponse } from 'next/server'
import { generateTotpSecret, totp } from '@/lib/admin/auth'
import QRCode from 'qrcode'
import { getDb } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

// GET — generate setup QR code for current user
export async function GET() {
  const adminUser = await getAdminUser()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const user = await db.select().from(users).where(eq(users.id, adminUser.id)).get()
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const secret = user.totpSecret && !user.totpEnabled
    ? user.totpSecret
    : generateTotpSecret()

  await db.update(users).set({ totpSecret: secret }).where(eq(users.id, adminUser.id))

  const otpauth = totp.toURI({ label: user.email, issuer: 'HBZ Admin', secret })
  const qrDataUrl = await QRCode.toDataURL(otpauth)

  return NextResponse.json({ secret, qrCode: qrDataUrl, enabled: user.totpEnabled })
}

// POST — enable or disable 2FA
export async function POST(req: NextRequest) {
  const adminUser = await getAdminUser()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, code } = await req.json() as { action: 'enable' | 'disable'; code: string }
  const db = getDb()
  const user = await db.select().from(users).where(eq(users.id, adminUser.id)).get()
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (action === 'enable') {
    if (!user.totpSecret) return NextResponse.json({ error: 'No secret generated' }, { status: 400 })
    const valid = !!(await totp.verify(code, { secret: user.totpSecret }))?.valid
    if (!valid) return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    await db.update(users).set({ totpEnabled: true }).where(eq(users.id, adminUser.id))
    await logAction(adminUser, 'UPDATE', 'users', adminUser.id, null, { totpEnabled: true })
    return NextResponse.json({ ok: true })
  }

  if (action === 'disable') {
    if (!user.totpSecret) return NextResponse.json({ error: 'No secret' }, { status: 400 })
    const valid = !!(await totp.verify(code, { secret: user.totpSecret }))?.valid
    if (!valid) return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    await db.update(users).set({ totpEnabled: false, totpSecret: null }).where(eq(users.id, adminUser.id))
    await logAction(adminUser, 'UPDATE', 'users', adminUser.id, null, { totpEnabled: false })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
