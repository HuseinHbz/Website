import { NextRequest, NextResponse } from 'next/server'
import { guardJson, unauthorized, checkTreePermission, notFound, jsonOr404 } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { integrations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  { const deny = await checkTreePermission(user, 'system.integrations', 'read'); if (deny) return deny }
  const db = getDb()
  return NextResponse.json(await db.select().from(integrations).orderBy(integrations.sortOrder))
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return unauthorized()
  { const deny = await checkTreePermission(user, 'system.integrations', 'write'); if (deny) return deny }
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, ...data } = await guardJson(req)
  const db = getDb()
  const result = (await db.update(integrations).set({ ...data, updatedBy: user.id, updatedAt: new Date().toISOString() }).where(eq(integrations.id, id)).returning())[0]
  if (!result) return notFound()
  await logAction(user, 'UPDATE', 'integration', String(id), null, { slug: result?.slug, enabled: result?.enabled })
  return NextResponse.json(result)
}
