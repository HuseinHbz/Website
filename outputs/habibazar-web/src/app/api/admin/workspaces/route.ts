import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { workspaces } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'
import { randomUUID } from 'crypto'

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  return await NextResponse.json(db.select().from(workspaces).orderBy(workspaces.sortOrder))
}

export async function POST(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const db = getDb()
  const result = (await db.insert(workspaces).values({ ...body, id: body.id || randomUUID(), createdBy: user.id }).returning())[0]
  await logAction(user, 'CREATE', 'workspace', result.id, null, result)
  return NextResponse.json(result, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, ...data } = await req.json()
  const db = getDb()
  const result = (await db.update(workspaces).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(workspaces.id, id)).returning())[0]
  await logAction(user, 'UPDATE', 'workspace', id, null, result)
  return NextResponse.json(result)
}

export async function DELETE(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const db = getDb()
  await db.delete(workspaces).where(eq(workspaces.id, id))
  await logAction(user, 'DELETE', 'workspace', id, null, null)
  return NextResponse.json({ ok: true })
}
