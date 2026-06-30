import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { events, eventRegistrations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  const allEvents = db.select().from(events).orderBy(events.startDate).all()
  return NextResponse.json(allEvents)
}

export async function POST(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const db = getDb()
  const result = db.insert(events).values({ ...body, createdBy: user.id }).returning().get()
  await logAction(user, 'CREATE', 'event', String(result.id), null, result)
  return NextResponse.json(result, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, ...data } = await req.json()
  const db = getDb()
  const result = db.update(events).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(events.id, id)).returning().get()
  await logAction(user, 'UPDATE', 'event', String(id), null, result)
  return NextResponse.json(result)
}

export async function DELETE(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const db = getDb()
  db.delete(eventRegistrations).where(eq(eventRegistrations.eventId, id)).run()
  db.delete(events).where(eq(events.id, id)).run()
  await logAction(user, 'DELETE', 'event', String(id), null, null)
  return NextResponse.json({ ok: true })
}
