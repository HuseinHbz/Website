import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { contactRequests } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  try {      const db = getDb()
      return NextResponse.json(await db.select().from(contactRequests).orderBy(desc(contactRequests.createdAt)).all())
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function PUT(req: NextRequest) {
  try {      const user = await getAdminUser()
      const { id, status, notes } = await req.json()
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
      const { id } = await req.json()
      const db = getDb()
      await db.delete(contactRequests).where(eq(contactRequests.id, id))
      await logAction(user, 'DELETE', 'contact_requests', id)
      return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
