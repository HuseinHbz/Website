import { verifyPassword, hashPassword } from './password'
import { SignJWT, jwtVerify } from 'jose'
import { nanoid } from 'nanoid'
import { cookies } from 'next/headers'
import { NobleCryptoPlugin, ScureBase32Plugin, generateSecret as otplibGenerateSecret, verifySync, generateSync, generateURI } from 'otplib'
import { getDb } from '@/lib/db'
import { users, adminSessions, auditLogs } from '@/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'

const totpPlugins = { crypto: new NobleCryptoPlugin(), base32: new ScureBase32Plugin() }

export function generateTotpSecret(): string {
  return otplibGenerateSecret(totpPlugins)
}

export function verifyTotpCode(token: string, secret: string): boolean {
  return !!(verifySync({ token, secret, ...totpPlugins }))?.valid
}

export function generateTotpToken(secret: string): string {
  return generateSync({ secret, ...totpPlugins })
}

export function generateTotpURI(label: string, issuer: string, secret: string): string {
  return generateURI({ strategy: 'totp', label, issuer, secret })
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'HBZ-Admin-Secret-Key-2025-Change-In-Production'
)
const SESSION_DURATION = 8 * 60 * 60 * 1000 // 8 hours

export interface AdminUser {
  id: string
  name: string
  email: string
  role: 'super_admin' | 'administrator' | 'editor' | 'auditor' | 'viewer'
  department?: string | null
  avatar?: string | null
}

export async function verifyTotp(userId: string, code: string): Promise<boolean> {
  const db = getDb()
  const user = (await db.select().from(users).where(eq(users.id, userId)))[0]
  if (!user?.totpSecret || !user.totpEnabled) return false
  return verifyTotpCode(code, user.totpSecret)
}

export async function signIn(email: string, password: string, ipAddress?: string, userAgent?: string, totpCode?: string) {
  const db = getDb()
  const user = (await db.select().from(users).where(
    and(eq(users.email, email.toLowerCase()), eq(users.active, true))
  ))[0]

  if (!user) return { error: 'Invalid credentials' }

  const { valid, needsRehash } = await verifyPassword(password, user.passwordHash)
  if (!valid) return { error: 'Invalid credentials' }
  // 26.25b بند ۰.۲: transparently upgrade a legacy bcrypt hash to scrypt on a
  // successful login (no forced password reset). Best-effort — never blocks login.
  if (needsRehash) {
    try { await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, user.id)) } catch { /* upgrade is best-effort */ }
  }

  if (user.totpEnabled && user.totpSecret) {
    if (!totpCode) return { requireTotp: true }
    // 26.27 بند ۵ — recovery-code login (5.1) else guarded TOTP (5.2 replay + 5.3 lock)
    const { verifyTotpGuarded, consumeRecoveryCode } = await import('./totpSecurity')
    if (/^[0-9a-fA-F]{10}$/.test(totpCode)) {
      const ok = await consumeRecoveryCode(user.id, totpCode)
      if (!ok) return { error: 'Invalid authentication code' }
      try {
        const { logger } = await import('@/lib/logger')
        logger.security('2FA recovery code used at login', { source: 'auth', userId: user.id, ip: ipAddress })
        const { sendMail } = await import('@/lib/notifications')
        await sendMail({ to: user.email, subject: 'HBZ Admin — recovery code used', html: `<p>A 2FA recovery code was used to sign in to your account (${user.email}) at ${new Date().toISOString()} from IP ${ipAddress || 'unknown'}. If this was not you, reset your 2FA immediately.</p>` })
      } catch { /* alerting is best-effort */ }
    } else {
      const verdict = await verifyTotpGuarded(user.id, user.totpSecret, totpCode)
      if (verdict === 'locked') return { error: 'Too many attempts — try again later' }
      if (verdict !== 'ok') return { error: 'Invalid authentication code' }
    }
  }

  const sessionId = nanoid()
  const token = await new SignJWT({ sub: user.id, role: user.role, sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(JWT_SECRET)

  const expiresAt = new Date(Date.now() + SESSION_DURATION).toISOString()
  await db.insert(adminSessions).values({
    id: sessionId,
    userId: user.id,
    token,
    expiresAt,
    ipAddress,
    userAgent,
  })

  await db.update(users).set({ lastLogin: new Date().toISOString() }).where(eq(users.id, user.id))

  await db.insert(auditLogs).values({
    userId: user.id,
    userEmail: user.email,
    action: 'LOGIN',
    resource: 'auth',
    ipAddress,
    userAgent,
  })

  const cookieStore = await cookies()
  cookieStore.set('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION / 1000,
    path: '/',
  })

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as AdminUser['role'],
      avatar: user.avatar,
    }
  }
}

export async function signOut() {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value
  if (token) {
    const db = getDb()
    await db.delete(adminSessions).where(eq(adminSessions.token, token))
    cookieStore.delete('admin_token')
  }
}

export async function getAdminUser(): Promise<AdminUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('admin_token')?.value
    if (!token) return null

    const { payload } = await jwtVerify(token, JWT_SECRET)
    const userId = payload.sub as string

    const db = getDb()
    const session = (await db.select().from(adminSessions).where(
      and(
        eq(adminSessions.token, token),
        gt(adminSessions.expiresAt, new Date().toISOString())
      )
    ))[0]
    if (!session) return null

    const user = (await db.select().from(users).where(
      and(eq(users.id, userId), eq(users.active, true))
    ))[0]
    if (!user) return null

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as AdminUser['role'],
      department: user.department ?? null,
      avatar: user.avatar,
    }
  } catch {
    return null
  }
}

export function canDo(role: AdminUser['role'], action: 'manage_users' | 'manage_settings' | 'delete' | 'publish' | 'edit') {
  const perms: Record<AdminUser['role'], string[]> = {
    super_admin: ['manage_users', 'manage_settings', 'delete', 'publish', 'edit'],
    administrator: ['manage_settings', 'delete', 'publish', 'edit'],
    editor: ['edit', 'publish'],
    // Read-only roles (26.22): auditor sees everything incl. logs but writes
    // nothing; viewer (shareholder/observer) sees dashboards + reports only.
    auditor: [],
    viewer: [],
  }
  return perms[role]?.includes(action) ?? false
}

// 26.25b بند ۰.۲: re-exported from the async-scrypt password module (was bcrypt).
export { hashPassword }
