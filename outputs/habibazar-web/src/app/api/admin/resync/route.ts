import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin/auth'
import { resyncPublicContent } from '@/lib/db/resync'

export async function POST() {
  try {
    const user = await getAdminUser()
    if (!user || (user.role !== 'super_admin' && user.role !== 'administrator')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const result = resyncPublicContent()
    return NextResponse.json(result)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
