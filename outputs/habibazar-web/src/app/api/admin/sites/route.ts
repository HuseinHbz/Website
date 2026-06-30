import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { sites } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'
import { randomUUID } from 'crypto'

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  return NextResponse.json(db.select().from(sites).all())
}

export async function POST(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const db = getDb()
  const result = db.insert(sites).values({ ...body, id: body.id || randomUUID(), createdBy: user.id }).returning().get()
  await logAction(user, 'CREATE', 'site', result.id, null, result)
  return NextResponse.json(result, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, ...data } = await req.json()
  const db = getDb()
  const result = db.update(sites).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(sites.id, id)).returning().get()
  await logAction(user, 'UPDATE', 'site', id, null, result)
  return NextResponse.json(result)
}

export async function DELETE(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const db = getDb()
  db.delete(sites).where(eq(sites.id, id)).run()
  await logAction(user, 'DELETE', 'site', id, null, null)
  return NextResponse.json({ ok: true })
}
