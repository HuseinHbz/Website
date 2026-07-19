import { NextResponse } from 'next/server'
import { apiError, unauthorized } from '@/lib/api/respond'
import { getAdminUser } from '@/lib/admin/auth'
import { resyncPublicContent } from '@/lib/db/resync'

export async function POST() {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()
    if (!user || (user.role !== 'super_admin' && user.role !== 'administrator')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const result = resyncPublicContent()
    return NextResponse.json(result)
  } catch (e: unknown) {
    return apiError(e)
  }
}
