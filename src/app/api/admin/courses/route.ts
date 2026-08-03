import { NextRequest, NextResponse } from 'next/server'
import { ensureSlug, ensureUniqueSlug } from '@/lib/admin/slug'
import { guardJson, forbidden, unauthorized, checkTreePermission, apiError, notFound, jsonOr404 } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { courses } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser, canDo } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'
import { runOnce } from '@/lib/api/idempotency'

export async function GET() {
  try {
    const user = await getAdminUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    { const deny = await checkTreePermission(user, 'brand.academy', 'read'); if (deny) return deny }
    const db = getDb()
    return NextResponse.json(await db.select().from(courses).orderBy(courses.sortOrder))
  } catch (e: unknown) { return apiError(e) }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()
    { const deny = await checkTreePermission(user, 'brand.academy', 'write'); if (deny) return deny }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await guardJson(req)
    const payload = await ensureUniqueSlug(body as Record<string, unknown>, 'courses', 'course')
    const db = getDb()
    const result = (await runOnce(user.id, 'courses', body, async () => db.insert(courses).values(payload as never).returning()))[0]
    await logAction(user, 'CREATE', 'course', String(result.id), null, result)
    return NextResponse.json(result, { status: 201 })
  } catch (e: unknown) { return apiError(e) }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()
    { const deny = await checkTreePermission(user, 'brand.academy', 'write'); if (deny) return deny }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id, ...data } = await guardJson(req)
    const db = getDb()
    const result = (await db.update(courses).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(courses.id, id)).returning())[0]
    if (!result) return notFound()
    await logAction(user, 'UPDATE', 'course', String(id), null, result)
    return jsonOr404(result)
  } catch (e: unknown) { return apiError(e) }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user || !canDo(user.role, 'delete')) return forbidden('Delete requires an administrator role')
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await guardJson(req)
    const db = getDb()
    await db.delete(courses).where(eq(courses.id, id))
    await logAction(user, 'DELETE', 'course', String(id), null, null)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) { return apiError(e) }
}
