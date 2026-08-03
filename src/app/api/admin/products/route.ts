import { NextRequest, NextResponse } from 'next/server'
import { ensureUniqueSlug } from '@/lib/admin/slug'
import { guardJson, forbidden, unauthorized, checkTreePermission, notFound, jsonOr404, apiError } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { products } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser, canDo } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'
import { runOnce } from '@/lib/api/idempotency'

export async function GET() {
  try {
    const user = await getAdminUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    { const deny = await checkTreePermission(user, 'brand.products', 'read'); if (deny) return deny }
    const db = getDb()
    return NextResponse.json(await db.select().from(products).orderBy(products.sortOrder))
  } catch (e: unknown) { return apiError(e) }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()
    { const deny = await checkTreePermission(user, 'brand.products', 'write'); if (deny) return deny }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await guardJson(req)
    const db = getDb()
    const result = (await runOnce(user.id, 'products', body, async () => db.insert(products).values({ ...await ensureUniqueSlug(body as Record<string, unknown>, 'products', 'product'), updatedBy: user.id } as never).returning()))[0]
    await logAction(user, 'CREATE', 'product', String(result.id), null, result)
    return NextResponse.json(result, { status: 201 })
  } catch (e: unknown) { return apiError(e) }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()
    { const deny = await checkTreePermission(user, 'brand.products', 'write'); if (deny) return deny }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id, ...data } = await guardJson(req)
    const db = getDb()
    const result = (await db.update(products).set({ ...data, updatedBy: user.id, updatedAt: new Date().toISOString() }).where(eq(products.id, id)).returning())[0]
    if (!result) return notFound()
    await logAction(user, 'UPDATE', 'product', String(id), null, result)
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
    await db.delete(products).where(eq(products.id, id))
    await logAction(user, 'DELETE', 'product', String(id), null, null)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) { return apiError(e) }
}
