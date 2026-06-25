import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  const db = getDb()
  return NextResponse.json(await db.select().from(projects).orderBy(asc(projects.sortOrder)).all())
}

export async function POST(req: NextRequest) {
  const user = await getAdminUser()
  const body = await req.json()
  const db = getDb()
  const result = await db.insert(projects).values({ ...body, updatedBy: user?.id }).returning()
  await logAction(user, 'CREATE', 'projects', result[0]?.id, null, body)
  return NextResponse.json(result[0])
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  const { id, ...data } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const db = getDb()
  await db.update(projects).set({ ...data, updatedAt: new Date().toISOString(), updatedBy: user?.id }).where(eq(projects.id, id))
  await logAction(user, 'UPDATE', 'projects', id, null, data)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getAdminUser()
  const { id } = await req.json()
  const db = getDb()
  await db.delete(projects).where(eq(projects.id, id))
  await logAction(user, 'DELETE', 'projects', id)
  return NextResponse.json({ ok: true })
}
