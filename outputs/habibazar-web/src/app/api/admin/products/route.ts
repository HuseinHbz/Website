import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { products } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  return await NextResponse.json(db.select().from(products).orderBy(products.sortOrder))
}

export async function POST(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const db = getDb()
  const result = (await db.insert(products).values({ ...body, updatedBy: user.id }).returning())[0]
  await logAction(user, 'CREATE', 'product', String(result.id), null, result)
  return NextResponse.json(result, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, ...data } = await req.json()
  const db = getDb()
  const result = (await db.update(products).set({ ...data, updatedBy: user.id, updatedAt: new Date().toISOString() }).where(eq(products.id, id)).returning())[0]
  await logAction(user, 'UPDATE', 'product', String(id), null, result)
  return NextResponse.json(result)
}

export async function DELETE(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const db = getDb()
  await db.delete(products).where(eq(products.id, id))
  await logAction(user, 'DELETE', 'product', String(id), null, null)
  return NextResponse.json({ ok: true })
}
