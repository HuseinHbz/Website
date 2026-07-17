import { NextRequest, NextResponse } from 'next/server'
import { guardJson, unauthorized } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { organization } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  const row = (await db.select().from(organization))[0]
  return NextResponse.json(row || {})
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return unauthorized()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await guardJson(req)
  const db = getDb()
  const existing = (await db.select().from(organization))[0]
  if (existing) {
    const result = (await db.update(organization).set({ ...body, updatedBy: user.id, updatedAt: new Date().toISOString() }).where(eq(organization.id, existing.id)).returning())[0]
    await logAction(user, 'UPDATE', 'organization', String(existing.id), null, result)
    return NextResponse.json(result)
  } else {
    const result = (await db.insert(organization).values({ ...body, updatedBy: user.id }).returning())[0]
    return NextResponse.json(result, { status: 201 })
  }
}
