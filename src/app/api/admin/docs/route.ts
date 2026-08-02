import { NextRequest, NextResponse } from 'next/server'
import { ensureSlug } from '@/lib/admin/slug'
import { guardJson, forbidden, unauthorized, checkTreePermission } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { docs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser, canDo } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  { const deny = await checkTreePermission(user, 'brand.docs', 'read'); if (deny) return deny }
  const db = getDb()
  return NextResponse.json(await db.select().from(docs).orderBy(docs.sortOrder))
}

export async function POST(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return unauthorized()
  { const deny = await checkTreePermission(user, 'brand.docs', 'write'); if (deny) return deny }
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await guardJson(req)
  const db = getDb()
  const result = (await db.insert(docs).values({ ...ensureSlug(body as Record<string, unknown>, "doc"), updatedBy: user.id } as never).returning())[0]
  await logAction(user, 'CREATE', 'doc', String(result.id), null, result)
  return NextResponse.json(result, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return unauthorized()
  { const deny = await checkTreePermission(user, 'brand.docs', 'write'); if (deny) return deny }
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, ...data } = await guardJson(req)
  const db = getDb()
  const result = (await db.update(docs).set({ ...data, updatedBy: user.id, updatedAt: new Date().toISOString() }).where(eq(docs.id, id)).returning())[0]
  await logAction(user, 'UPDATE', 'doc', String(id), null, result)
  return NextResponse.json(result)
}

export async function DELETE(req: NextRequest) {
  const user = await getAdminUser()
  if (!user || !canDo(user.role, 'delete')) return forbidden('Delete requires an administrator role')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await guardJson(req)
  const db = getDb()
  await db.delete(docs).where(eq(docs.id, id))
  await logAction(user, 'DELETE', 'doc', String(id), null, null)
  return NextResponse.json({ ok: true })
}
