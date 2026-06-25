import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { blogCategories } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  const db = getDb()
  return NextResponse.json(await db.select().from(blogCategories).orderBy(asc(blogCategories.sortOrder)).all())
}

export async function POST(req: NextRequest) {
  const user = await getAdminUser()
  const body = await req.json()
  const db = getDb()
  const result = await db.insert(blogCategories).values(body).returning()
  await logAction(user, 'CREATE', 'blog_categories', result[0]?.id, null, body)
  return NextResponse.json(result[0])
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  const { id, ...data } = await req.json()
  const db = getDb()
  await db.update(blogCategories).set(data).where(eq(blogCategories.id, id))
  await logAction(user, 'UPDATE', 'blog_categories', id, null, data)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getAdminUser()
  const { id } = await req.json()
  const db = getDb()
  await db.delete(blogCategories).where(eq(blogCategories.id, id))
  await logAction(user, 'DELETE', 'blog_categories', id)
  return NextResponse.json({ ok: true })
}
