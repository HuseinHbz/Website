import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { technologies } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  return NextResponse.json(db.select().from(technologies).orderBy(technologies.sortOrder).all())
}

export async function POST(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const db = getDb()
  const result = db.insert(technologies).values(body).returning().get()
  await logAction(user, 'create', 'technology', String(result.id), null, result)
  return NextResponse.json(result, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, ...data } = await req.json()
  const db = getDb()
  const result = db.update(technologies).set(data).where(eq(technologies.id, id)).returning().get()
  await logAction(user, 'update', 'technology', String(id), null, result)
  return NextResponse.json(result)
}

export async function DELETE(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const db = getDb()
  db.delete(technologies).where(eq(technologies.id, id)).run()
  await logAction(user, 'delete', 'technology', String(id), null, null)
  return NextResponse.json({ ok: true })
}
