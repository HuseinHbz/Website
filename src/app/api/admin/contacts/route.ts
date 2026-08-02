import { NextRequest, NextResponse } from 'next/server'
import { apiError, guardJson, forbidden, unauthorized, checkTreePermission } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { contactRequests } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getAdminUser, canDo } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  try {      const db = getDb()
      return NextResponse.json(await db.select().from(contactRequests).orderBy(desc(contactRequests.createdAt)))
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function PUT(req: NextRequest) {
  try {      const user = await getAdminUser()
      if (!user) return unauthorized()
      { const deny = await checkTreePermission(user, 'crm.contacts', 'write'); if (deny) return deny }
      const { id, status, notes } = await guardJson(req)
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const db = getDb()
      await db.update(contactRequests).set({ status, updatedAt: new Date().toISOString() }).where(eq(contactRequests.id, id))
      await logAction(user, 'UPDATE', 'contact_requests', id, null, { status, notes })
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
      await db.delete(contactRequests).where(eq(contactRequests.id, id))
      await logAction(user, 'DELETE', 'contact_requests', id)
      return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
