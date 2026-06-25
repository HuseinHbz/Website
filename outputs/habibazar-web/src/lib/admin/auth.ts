import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { nanoid } from 'nanoid'
import { cookies } from 'next/headers'
import { getDb } from '@/lib/db'
import { users, adminSessions, auditLogs } from '@/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'

const JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'HBZ-Admin-Secret-Key-2025-Change-In-Production'
)
const SESSION_DURATION = 8 * 60 * 60 * 1000 // 8 hours

export interface AdminUser {
  id: string
  name: string
  email: string
  role: 'super_admin' | 'administrator' | 'editor'
  avatar?: string | null
}

export async function signIn(email: string, password: string, ipAddress?: string, userAgent?: string) {
  const db = getDb()
  const user = await db.select().from(users).where(
    and(eq(users.email, email.toLowerCase()), eq(users.active, true))
  ).get()

  if (!user) return { error: 'Invalid credentials' }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return { error: 'Invalid credentials' }

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
    path: '/admin',
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
    const session = await db.select().from(adminSessions).where(
      and(
        eq(adminSessions.token, token),
        gt(adminSessions.expiresAt, new Date().toISOString())
      )
    ).get()
    if (!session) return null

    const user = await db.select().from(users).where(
      and(eq(users.id, userId), eq(users.active, true))
    ).get()
    if (!user) return null

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as AdminUser['role'],
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
  }
  return perms[role]?.includes(action) ?? false
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12)
}
