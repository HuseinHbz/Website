import { NextRequest, NextResponse } from 'next/server'
import { apiError, guardJson, forbidden, unauthorized } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { consultationRequests } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getAdminUser, canDo } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  try {      const db = getDb()
      return NextResponse.json(await db.select().from(consultationRequests).orderBy(desc(consultationRequests.createdAt)))
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function PUT(req: NextRequest) {
  try {      const user = await getAdminUser()
      if (!user) return unauthorized()
      const { id, ...data } = await guardJson(req)
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const db = getDb()
      await db.update(consultationRequests).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(consultationRequests.id, id))
      await logAction(user, 'UPDATE', 'consultation_requests', id, null, data)
      return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function DELETE(req: NextRequest) {
  try {      const user = await getAdminUser()
      if (!user || !canDo(user.role, 'delete')) return forbidden('Delete requires an administrator role')
      const { id } = await guardJson(req)
      const db = getDb()
      await db.delete(consultationRequests).where(eq(consultationRequests.id, id))
      await logAction(user, 'DELETE', 'consultation_requests', id)
      return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
