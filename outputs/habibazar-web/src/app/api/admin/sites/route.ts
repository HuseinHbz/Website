import { NextRequest, NextResponse } from 'next/server'
import { guardJson, forbidden, unauthorized } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { sites } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser, canDo } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'
import { randomUUID } from 'crypto'

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  return NextResponse.json(await db.select().from(sites))
}

export async function POST(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return unauthorized()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await guardJson(req)
  const db = getDb()
  const result = (await db.insert(sites).values({ ...body, id: body.id || randomUUID(), createdBy: user.id }).returning())[0]
  await logAction(user, 'CREATE', 'site', result.id, null, result)
  return NextResponse.json(result, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return unauthorized()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, ...data } = await guardJson(req)
  const db = getDb()
  const result = (await db.update(sites).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(sites.id, id)).returning())[0]
  await logAction(user, 'UPDATE', 'site', id, null, result)
  return NextResponse.json(result)
}

export async function DELETE(req: NextRequest) {
  const user = await getAdminUser()
  if (!user || !canDo(user.role, 'delete')) return forbidden('Delete requires an administrator role')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await guardJson(req)
  const db = getDb()
  await db.delete(sites).where(eq(sites.id, id))
  await logAction(user, 'DELETE', 'site', id, null, null)
  return NextResponse.json({ ok: true })
}
