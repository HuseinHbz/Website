import { NextRequest, NextResponse } from 'next/server'
import { guardJson, forbidden, unauthorized } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { solutions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser, canDo } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  const rows = await db.select().from(solutions).orderBy(solutions.sortOrder)
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return unauthorized()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await guardJson(req)
  const db = getDb()
  const result = (await db.insert(solutions).values({ ...body, updatedBy: user.id }).returning())[0]
  await logAction(user, 'create', 'solution', String(result.id), null, result)
  return NextResponse.json(result, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return unauthorized()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await guardJson(req)
  const { id, ...data } = body
  const db = getDb()
  const result = (await db.update(solutions).set({ ...data, updatedBy: user.id, updatedAt: new Date().toISOString() }).where(eq(solutions.id, id)).returning())[0]
  await logAction(user, 'update', 'solution', String(id), null, result)
  return NextResponse.json(result)
}

export async function DELETE(req: NextRequest) {
  const user = await getAdminUser()
  if (!user || !canDo(user.role, 'delete')) return forbidden('Delete requires an administrator role')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await guardJson(req)
  const db = getDb()
  await db.delete(solutions).where(eq(solutions.id, id))
  await logAction(user, 'delete', 'solution', String(id), null, null)
  return NextResponse.json({ ok: true })
}
