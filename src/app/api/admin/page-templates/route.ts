import { NextRequest, NextResponse } from 'next/server'
import { ensureSlug } from '@/lib/admin/slug'
import { guardJson, forbidden, unauthorized, checkTreePermission, apiError } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { pageTemplates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser, canDo } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  try {
    const user = await getAdminUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    { const deny = await checkTreePermission(user, 'brand.templates', 'read'); if (deny) return deny }
    const db = getDb()
    return NextResponse.json(await db.select().from(pageTemplates))
  } catch (e: unknown) { return apiError(e) }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()
    { const deny = await checkTreePermission(user, 'brand.templates', 'write'); if (deny) return deny }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await guardJson(req)
    const payload = ensureSlug(body as Record<string, unknown>, 'template')
    const db = getDb()
    const result = (await db.insert(pageTemplates).values(payload as never).returning())[0]
    await logAction(user, 'create', 'page_template', String(result.id), null, result)
    return NextResponse.json(result, { status: 201 })
  } catch (e: unknown) { return apiError(e) }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()
    { const deny = await checkTreePermission(user, 'brand.templates', 'write'); if (deny) return deny }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id, ...data } = await guardJson(req)
    const db = getDb()
    const result = (await db.update(pageTemplates).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(pageTemplates.id, id)).returning())[0]
    await logAction(user, 'update', 'page_template', String(id), null, result)
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
    await db.delete(pageTemplates).where(eq(pageTemplates.id, id))
    await logAction(user, 'delete', 'page_template', String(id), null, null)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) { return apiError(e) }
}
