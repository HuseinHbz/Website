import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { solutions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  const rows = db.select().from(solutions).orderBy(solutions.sortOrder).all()
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const db = getDb()
  const result = db.insert(solutions).values({ ...body, updatedBy: user.id }).returning().get()
  await logAction(user, 'create', 'solution', String(result.id), null, result)
  return NextResponse.json(result, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { id, ...data } = body
  const db = getDb()
  const result = db.update(solutions).set({ ...data, updatedBy: user.id, updatedAt: new Date().toISOString() }).where(eq(solutions.id, id)).returning().get()
  await logAction(user, 'update', 'solution', String(id), null, result)
  return NextResponse.json(result)
}

export async function DELETE(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const db = getDb()
  db.delete(solutions).where(eq(solutions.id, id)).run()
  await logAction(user, 'delete', 'solution', String(id), null, null)
  return NextResponse.json({ ok: true })
}
