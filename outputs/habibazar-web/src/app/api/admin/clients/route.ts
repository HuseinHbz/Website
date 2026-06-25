import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { clients } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  const db = getDb()
  return NextResponse.json(await db.select().from(clients).orderBy(asc(clients.sortOrder)).all())
}

export async function POST(req: NextRequest) {
  const user = await getAdminUser()
  const body = await req.json()
  const db = getDb()
  const result = await db.insert(clients).values({ ...body, updatedBy: user?.id }).returning()
  await logAction(user, 'CREATE', 'clients', result[0]?.id, null, body)
  return NextResponse.json(result[0])
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  const { id, ...data } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const db = getDb()
  await db.update(clients).set({ ...data, updatedAt: new Date().toISOString(), updatedBy: user?.id }).where(eq(clients.id, id))
  await logAction(user, 'UPDATE', 'clients', id, null, data)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getAdminUser()
  const { id } = await req.json()
  const db = getDb()
  await db.delete(clients).where(eq(clients.id, id))
  await logAction(user, 'DELETE', 'clients', id)
  return NextResponse.json({ ok: true })
}
