import { NextRequest, NextResponse } from 'next/server'
import { ensureUniqueSlug } from '@/lib/admin/slug'
import { apiError, guardJson, forbidden, unauthorized, checkTreePermission } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { getAdminUser, canDo } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'
import { runOnce } from '@/lib/api/idempotency'

export async function GET() {
  try {
    const db = getDb()
    return NextResponse.json(await db.select().from(projects).orderBy(asc(projects.sortOrder)))
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()
    { const deny = await checkTreePermission(user, 'brand.projects', 'write'); if (deny) return deny }
    const body = await guardJson(req)
    const { id: _id, createdAt: _c, updatedAt: _u, ...data } = body
    const db = getDb()
    const result = await runOnce(user?.id, 'projects', body, async () => db.insert(projects).values({ ...await ensureUniqueSlug(data as Record<string, unknown>, 'projects', 'project'), updatedBy: user?.id } as never).returning())
    await logAction(user, 'CREATE', 'projects', result[0]?.id, null, data)
    return NextResponse.json(result[0])
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()
    { const deny = await checkTreePermission(user, 'brand.projects', 'write'); if (deny) return deny }
    const { id, ...data } = await guardJson(req)
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const db = getDb()
    await db.update(projects).set({ ...data, updatedAt: new Date().toISOString(), updatedBy: user?.id }).where(eq(projects.id, id))
    await logAction(user, 'UPDATE', 'projects', id, null, data)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user || !canDo(user.role, 'delete')) return forbidden('Delete requires an administrator role')
    const { id } = await guardJson(req)
    const db = getDb()
    await db.delete(projects).where(eq(projects.id, id))
    await logAction(user, 'DELETE', 'projects', id)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
