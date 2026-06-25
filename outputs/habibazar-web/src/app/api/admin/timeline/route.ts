import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { timelineItems } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  const db = getDb()
  const rows = await db.select().from(timelineItems).orderBy(asc(timelineItems.sortOrder)).all()
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const user = await getAdminUser()
  const body = await req.json()
  const db = getDb()
  const result = await db.insert(timelineItems).values({ ...body, updatedBy: user?.id }).returning()
  await logAction(user, 'CREATE', 'timeline_items', result[0]?.id, null, body)
  return NextResponse.json(result[0])
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  const body = await req.json()
  const { id, ...data } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const db = getDb()
  const old = await db.select().from(timelineItems).where(eq(timelineItems.id, id)).get()
  await db.update(timelineItems).set({ ...data, updatedAt: new Date().toISOString(), updatedBy: user?.id }).where(eq(timelineItems.id, id))
  await logAction(user, 'UPDATE', 'timeline_items', id, old, data)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getAdminUser()
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const db = getDb()
  await db.delete(timelineItems).where(eq(timelineItems.id, id))
  await logAction(user, 'DELETE', 'timeline_items', id)
  return NextResponse.json({ ok: true })
}
