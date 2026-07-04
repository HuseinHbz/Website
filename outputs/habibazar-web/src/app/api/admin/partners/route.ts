import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { partners } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  return await NextResponse.json(db.select().from(partners).orderBy(partners.sortOrder))
}

export async function POST(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const db = getDb()
  const result = (await db.insert(partners).values(body).returning())[0]
  await logAction(user, 'CREATE', 'partner', String(result.id), null, result)
  return NextResponse.json(result, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, ...data } = await req.json()
  const db = getDb()
  const result = (await db.update(partners).set(data).where(eq(partners.id, id)).returning())[0]
  await logAction(user, 'UPDATE', 'partner', String(id), null, result)
  return NextResponse.json(result)
}

export async function DELETE(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const db = getDb()
  await db.delete(partners).where(eq(partners.id, id))
  await logAction(user, 'DELETE', 'partner', String(id), null, null)
  return NextResponse.json({ ok: true })
}
