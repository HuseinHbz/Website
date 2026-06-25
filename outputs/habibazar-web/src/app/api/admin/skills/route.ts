import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { skills } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  const db = getDb()
  return NextResponse.json(await db.select().from(skills).orderBy(asc(skills.sortOrder)).all())
}

export async function POST(req: NextRequest) {
  const user = await getAdminUser()
  const body = await req.json()
  const db = getDb()
  const result = await db.insert(skills).values({ ...body, updatedBy: user?.id }).returning()
  await logAction(user, 'CREATE', 'skills', result[0]?.id, null, body)
  return NextResponse.json(result[0])
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  const body = await req.json()
  const { id, ...data } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const db = getDb()
  await db.update(skills).set({ ...data, updatedAt: new Date().toISOString(), updatedBy: user?.id }).where(eq(skills.id, id))
  await logAction(user, 'UPDATE', 'skills', id, null, data)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getAdminUser()
  const { id } = await req.json()
  const db = getDb()
  await db.delete(skills).where(eq(skills.id, id))
  await logAction(user, 'DELETE', 'skills', id)
  return NextResponse.json({ ok: true })
}
