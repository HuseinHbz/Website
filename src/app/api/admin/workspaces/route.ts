import { NextRequest, NextResponse } from 'next/server'
import { guardJson, forbidden, unauthorized } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { workspaces } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser, canDo } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'
import { randomUUID } from 'crypto'

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  return NextResponse.json(await db.select().from(workspaces).orderBy(workspaces.sortOrder))
}

export async function POST(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return unauthorized()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await guardJson(req)
  const db = getDb()
  const result = (await db.insert(workspaces).values({ ...body, id: body.id || randomUUID(), createdBy: user.id }).returning())[0]
  await logAction(user, 'CREATE', 'workspace', result.id, null, result)
  return NextResponse.json(result, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return unauthorized()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, ...data } = await guardJson(req)
  const db = getDb()
  const result = (await db.update(workspaces).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(workspaces.id, id)).returning())[0]
  await logAction(user, 'UPDATE', 'workspace', id, null, result)
  return NextResponse.json(result)
}

export async function DELETE(req: NextRequest) {
  const user = await getAdminUser()
  if (!user || !canDo(user.role, 'delete')) return forbidden('Delete requires an administrator role')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await guardJson(req)
  const db = getDb()
  await db.delete(workspaces).where(eq(workspaces.id, id))
  await logAction(user, 'DELETE', 'workspace', id, null, null)
  return NextResponse.json({ ok: true })
}
