import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { User } from './types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'

export async function getSession(): Promise<User | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) return null

  try {
    const res = await fetch(`${API_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.data as User
  } catch {
    return null
  }
}

export async function requireAuth(): Promise<User> {
  const user = await getSession()
  if (!user) redirect('/login')
  return user
}

export async function requirePermission(permission: string): Promise<User> {
  const user = await requireAuth()
  if (!user.role.permissions.includes(permission)) {
    redirect('/dashboard')
  }
  return user
}

export function hasPermission(user: User, permission: string): boolean {
  return user.role.permissions.includes(permission)
}

export async function getTokenFromCookies(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get('access_token')?.value
}
