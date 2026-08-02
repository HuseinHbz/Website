import { NextRequest, NextResponse } from 'next/server'
import { ensureSlug } from '@/lib/admin/slug'
import { guardJson, forbidden, unauthorized, checkTreePermission, apiError } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { technologies } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser, canDo } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  try {
    const user = await getAdminUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    { const deny = await checkTreePermission(user, 'brand.technologies', 'read'); if (deny) return deny }
    const db = getDb()
    return NextResponse.json(await db.select().from(technologies).orderBy(technologies.sortOrder))
  } catch (e: unknown) { return apiError(e) }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()
    { const deny = await checkTreePermission(user, 'brand.technologies', 'write'); if (deny) return deny }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await guardJson(req)
    const payload = ensureSlug(body as Record<string, unknown>, 'tech')
    const db = getDb()
    const result = (await db.insert(technologies).values(payload as never).returning())[0]
    await logAction(user, 'create', 'technology', String(result.id), null, result)
    return NextResponse.json(result, { status: 201 })
  } catch (e: unknown) { return apiError(e) }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()
    { const deny = await checkTreePermission(user, 'brand.technologies', 'write'); if (deny) return deny }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id, ...data } = await guardJson(req)
    const db = getDb()
    const result = (await db.update(technologies).set(data).where(eq(technologies.id, id)).returning())[0]
    await logAction(user, 'update', 'technology', String(id), null, result)
    return NextResponse.json(result)
  } catch (e: unknown) { return apiError(e) }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user || !canDo(user.role, 'delete')) return forbidden('Delete requires an administrator role')
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await guardJson(req)
    const db = getDb()
    await db.delete(technologies).where(eq(technologies.id, id))
    await logAction(user, 'delete', 'technology', String(id), null, null)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) { return apiError(e) }
}
