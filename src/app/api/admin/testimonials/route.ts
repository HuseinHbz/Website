import { NextRequest, NextResponse } from 'next/server'
import { guardJson, forbidden, unauthorized, checkTreePermission, apiError } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { testimonials } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser, canDo } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  try {
    const user = await getAdminUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    { const deny = await checkTreePermission(user, 'brand.testimonials', 'read'); if (deny) return deny }
    const db = getDb()
    return NextResponse.json(await db.select().from(testimonials).orderBy(testimonials.sortOrder))
  } catch (e: unknown) { return apiError(e) }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()
    { const deny = await checkTreePermission(user, 'brand.testimonials', 'write'); if (deny) return deny }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await guardJson(req)
    const db = getDb()
    const result = (await db.insert(testimonials).values(body).returning())[0]
    await logAction(user, 'create', 'testimonial', String(result.id), null, result)
    return NextResponse.json(result, { status: 201 })
  } catch (e: unknown) { return apiError(e) }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()
    { const deny = await checkTreePermission(user, 'brand.testimonials', 'write'); if (deny) return deny }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id, ...data } = await guardJson(req)
    const db = getDb()
    const result = (await db.update(testimonials).set(data).where(eq(testimonials.id, id)).returning())[0]
    await logAction(user, 'update', 'testimonial', String(id), null, result)
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
    await db.delete(testimonials).where(eq(testimonials.id, id))
    await logAction(user, 'delete', 'testimonial', String(id), null, null)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) { return apiError(e) }
}
