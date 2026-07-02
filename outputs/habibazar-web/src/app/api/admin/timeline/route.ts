import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { timelineItems } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  try {
    const db = getDb()
    return NextResponse.json(await db.select().from(timelineItems).orderBy(asc(timelineItems.sortOrder)).all())
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAdminUser()
    const body = await req.json()
    const { id: _id, createdAt: _c, updatedAt: _u, ...data } = body
    const db = getDb()
    const result = await db.insert(timelineItems).values({ ...data, updatedBy: user?.id }).returning()
    await logAction(user, 'CREATE', 'timeline_items', result[0]?.id, null, data)
    return NextResponse.json(result[0])
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAdminUser()
    const { id, ...data } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const db = getDb()
    const old = await db.select().from(timelineItems).where(eq(timelineItems.id, id)).get()
    await db.update(timelineItems).set({ ...data, updatedAt: new Date().toISOString(), updatedBy: user?.id }).where(eq(timelineItems.id, id))
    await logAction(user, 'UPDATE', 'timeline_items', id, old, data)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAdminUser()
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const db = getDb()
    await db.delete(timelineItems).where(eq(timelineItems.id, id))
    await logAction(user, 'DELETE', 'timeline_items', id)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
