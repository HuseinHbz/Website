import { NextRequest, NextResponse } from 'next/server'
import { ensureSlug, ensureUniqueSlug } from '@/lib/admin/slug'
import { guardJson, forbidden, unauthorized, checkTreePermission, apiError, notFound, jsonOr404 } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { partners } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser, canDo } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'
import { runOnce } from '@/lib/api/idempotency'

export async function GET() {
  try {
    const user = await getAdminUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    { const deny = await checkTreePermission(user, 'system.partners', 'read'); if (deny) return deny }
    const db = getDb()
    return NextResponse.json(await db.select().from(partners).orderBy(partners.sortOrder))
  } catch (e: unknown) { return apiError(e) }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()
    { const deny = await checkTreePermission(user, 'system.partners', 'write'); if (deny) return deny }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await guardJson(req)
    const db = getDb()
    // 26.32: the partner form never collects a slug — derive it (26.29 BUG-101 class)
    const result = (await runOnce(user.id, 'partners', body, async () => db.insert(partners).values(await ensureUniqueSlug(body as Record<string, unknown>, 'partners', 'partner') as never).returning()))[0]
    await logAction(user, 'CREATE', 'partner', String(result.id), null, result)
    return NextResponse.json(result, { status: 201 })
  } catch (e: unknown) { return apiError(e) }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()
    { const deny = await checkTreePermission(user, 'system.partners', 'write'); if (deny) return deny }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id, ...data } = await guardJson(req)
    const db = getDb()
    const result = (await db.update(partners).set(data).where(eq(partners.id, id)).returning())[0]
    if (!result) return notFound()
    await logAction(user, 'UPDATE', 'partner', String(id), null, result)
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
    await db.delete(partners).where(eq(partners.id, id))
    await logAction(user, 'DELETE', 'partner', String(id), null, null)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) { return apiError(e) }
}
