import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { readJson, apiError, requireOp } from '@/lib/api/respond'
import { generateTotpSecret, generateTotpURI, getAdminUser } from '@/lib/admin/auth'
import { encryptSecret, decryptSecret, verifyTotpGuarded, issueRecoveryCodes, remainingRecoveryCodes } from '@/lib/admin/totpSecurity'
import QRCode from 'qrcode'
import { getDb } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logAction } from '@/lib/admin/audit'
import { logger } from '@/lib/logger'

/**
 * 26.27 بند ۵ — hardened 2FA management.
 *  - Secrets stored AES-256-GCM encrypted (5.4); legacy plaintext still decodes.
 *  - Enable verifies through the guarded path (replay + lock, 5.2/5.3) and
 *    issues 10 hashed single-use recovery codes returned exactly once (5.1).
 *  - Managing ANOTHER user requires the `security.users:reset_2fa` sensitive op
 *    (5.6/5.7) — role alone is the legacy fallback; resetting someone else's
 *    2FA is audited AND emailed to that user.
 */

const bodySchema = z.object({
  action: z.enum(['enable', 'disable', 'recovery']),
  code: z.string().min(1).max(16).optional(),
  userId: z.string().min(1).max(64).optional(),
})

async function targetGate(adminUser: NonNullable<Awaited<ReturnType<typeof getAdminUser>>>, targetId: string): Promise<NextResponse | null> {
  if (targetId === adminUser.id) return null
  if (adminUser.role !== 'super_admin' && adminUser.role !== 'administrator') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return await requireOp(adminUser, 'security.users:reset_2fa', 'manage_users')
}

// GET — generate/return setup QR (?userId=xxx for managing other users)
export async function GET(req: NextRequest) {
  const adminUser = await getAdminUser()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { searchParams } = new URL(req.url)
    const targetId = searchParams.get('userId') || adminUser.id
    const deny = await targetGate(adminUser, targetId)
    if (deny) return deny

    const db = getDb()
    const user = (await db.select().from(users).where(eq(users.id, targetId)))[0]
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // reuse a pending (not yet enabled) secret so the QR stays stable across reloads
    let plain: string
    if (user.totpSecret && !user.totpEnabled) {
      plain = decryptSecret(user.totpSecret)
    } else {
      plain = generateTotpSecret()
      await db.update(users).set({ totpSecret: encryptSecret(plain), totpEnabled: false }).where(eq(users.id, targetId))
    }
    const otpauth = generateTotpURI(user.email, 'HBZ Admin', plain)
    const qrDataUrl = await QRCode.toDataURL(otpauth)
    const recoveryLeft = await remainingRecoveryCodes(targetId)
    return NextResponse.json({ secret: plain, qrCode: qrDataUrl, enabled: user.totpEnabled, email: user.email, recoveryLeft })
  } catch (e) { return apiError(e) }
}

// POST — enable / disable / regenerate recovery codes
export async function POST(req: NextRequest) {
  const adminUser = await getAdminUser()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const parsed = await readJson(req, bodySchema)
    if ('error' in parsed) return parsed.error
    const { action, code, userId } = parsed.data
    const targetId = userId || adminUser.id
    const deny = await targetGate(adminUser, targetId)
    if (deny) return deny

    const db = getDb()
    const user = (await db.select().from(users).where(eq(users.id, targetId)))[0]
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (action === 'enable') {
      if (!user.totpSecret) return NextResponse.json({ error: 'No secret generated' }, { status: 400 })
      if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })
      const verdict = await verifyTotpGuarded(targetId, user.totpSecret, code)
      if (verdict === 'locked') return NextResponse.json({ error: 'Too many attempts — try again later' }, { status: 429 })
      if (verdict !== 'ok') return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
      // upgrade legacy plaintext to encrypted on enable (5.4 idempotent migration)
      const stored = user.totpSecret.startsWith('enc:v1:') ? user.totpSecret : encryptSecret(user.totpSecret)
      await db.update(users).set({ totpEnabled: true, totpSecret: stored }).where(eq(users.id, targetId))
      const recoveryCodes = await issueRecoveryCodes(targetId)
      await logAction(adminUser, 'UPDATE', 'users', targetId, null, { totpEnabled: true })
      return NextResponse.json({ ok: true, recoveryCodes })
    }

    if (action === 'recovery') {
      if (!user.totpEnabled) return NextResponse.json({ error: '2FA is not enabled' }, { status: 400 })
      const recoveryCodes = await issueRecoveryCodes(targetId)
      await logAction(adminUser, 'UPDATE', 'users', targetId, null, { recoveryCodesRegenerated: true })
      return NextResponse.json({ ok: true, recoveryCodes })
    }

    // disable — full reset (secret + replay/lock state + recovery codes)
    await db.update(users).set({ totpEnabled: false, totpSecret: null }).where(eq(users.id, targetId))
    const { pgQuery } = await import('@/lib/db')
    await pgQuery(`UPDATE users SET totp_last_step=NULL, totp_fail_count=0, totp_locked_until=NULL WHERE id=$1`, [targetId])
    await pgQuery(`DELETE FROM admin_recovery_codes WHERE user_id=$1`, [targetId])
    await logAction(adminUser, 'UPDATE', 'users', targetId, null, { totpEnabled: false, resetBy: adminUser.id })
    if (targetId !== adminUser.id) {
      logger.security('2FA reset by another admin', { source: 'auth', targetId, actorId: adminUser.id })
      try {
        const { sendMail } = await import('@/lib/notifications')
        await sendMail({ to: user.email, subject: 'HBZ Admin — your 2FA was reset', html: `<p>Your two-factor authentication was reset by administrator ${adminUser.email} at ${new Date().toISOString()}. If you did not request this, contact your system administrator immediately.</p>` })
      } catch { /* alerting is best-effort */ }
    }
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e) }
}
