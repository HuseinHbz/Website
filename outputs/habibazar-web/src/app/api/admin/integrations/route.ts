import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { integrations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  return await NextResponse.json(db.select().from(integrations).orderBy(integrations.sortOrder))
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, ...data } = await req.json()
  const db = getDb()
  const result = (await db.update(integrations).set({ ...data, updatedBy: user.id, updatedAt: new Date().toISOString() }).where(eq(integrations.id, id)).returning())[0]
  await logAction(user, 'UPDATE', 'integration', String(id), null, { slug: result?.slug, enabled: result?.enabled })
  return NextResponse.json(result)
}
