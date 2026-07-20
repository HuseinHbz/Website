import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin/auth'
import { loadUserRbac } from '@/lib/rbac/data'

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // 26.27: explicit tree grants for grant-aware navigation (empty = role default)
  let grants: Record<string, string> = {}
  try { grants = (await loadUserRbac(user.id)).grants } catch { /* pre-migration */ }
  return NextResponse.json({ user, grants })
}
