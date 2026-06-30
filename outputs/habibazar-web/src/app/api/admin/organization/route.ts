import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { organization } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  const row = db.select().from(organization).get()
  return NextResponse.json(row || {})
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const db = getDb()
  const existing = db.select().from(organization).get()
  if (existing) {
    const result = db.update(organization).set({ ...body, updatedBy: user.id, updatedAt: new Date().toISOString() }).where(eq(organization.id, existing.id)).returning().get()
    await logAction(user, 'UPDATE', 'organization', String(existing.id), null, result)
    return NextResponse.json(result)
  } else {
    const result = db.insert(organization).values({ ...body, updatedBy: user.id }).returning().get()
    return NextResponse.json(result, { status: 201 })
  }
}
