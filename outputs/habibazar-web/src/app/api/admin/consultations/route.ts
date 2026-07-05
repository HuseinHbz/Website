import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { consultationRequests } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
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
      const { id, ...data } = await req.json()
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
      const { id } = await req.json()
      const db = getDb()
      await db.delete(consultationRequests).where(eq(consultationRequests.id, id))
      await logAction(user, 'DELETE', 'consultation_requests', id)
      return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
