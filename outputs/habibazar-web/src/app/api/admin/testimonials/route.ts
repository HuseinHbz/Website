import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { testimonials } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  return NextResponse.json(db.select().from(testimonials).orderBy(testimonials.sortOrder).all())
}

export async function POST(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const db = getDb()
  const result = db.insert(testimonials).values(body).returning().get()
  await logAction(user, 'create', 'testimonial', String(result.id), null, result)
  return NextResponse.json(result, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, ...data } = await req.json()
  const db = getDb()
  const result = db.update(testimonials).set(data).where(eq(testimonials.id, id)).returning().get()
  await logAction(user, 'update', 'testimonial', String(id), null, result)
  return NextResponse.json(result)
}

export async function DELETE(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const db = getDb()
  db.delete(testimonials).where(eq(testimonials.id, id)).run()
  await logAction(user, 'delete', 'testimonial', String(id), null, null)
  return NextResponse.json({ ok: true })
}
