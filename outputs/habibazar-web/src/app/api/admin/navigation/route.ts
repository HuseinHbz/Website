import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { navigationItems } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  const db = getDb()
  return NextResponse.json(await db.select().from(navigationItems).orderBy(asc(navigationItems.sortOrder)).all())
}

export async function POST(req: NextRequest) {
  const user = await getAdminUser()
  const body = await req.json()
  const db = getDb()
  const result = await db.insert(navigationItems).values(body).returning()
  await logAction(user, 'CREATE', 'navigation_items', result[0]?.id, null, body)
  return NextResponse.json(result[0])
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  const { id, ...data } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const db = getDb()
  await db.update(navigationItems).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(navigationItems.id, id))
  await logAction(user, 'UPDATE', 'navigation_items', id, null, data)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getAdminUser()
  const { id } = await req.json()
  const db = getDb()
  await db.delete(navigationItems).where(eq(navigationItems.id, id))
  await logAction(user, 'DELETE', 'navigation_items', id)
  return NextResponse.json({ ok: true })
}
