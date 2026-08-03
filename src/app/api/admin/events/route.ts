import { NextRequest, NextResponse } from 'next/server'
import { ensureSlug, ensureUniqueSlug } from '@/lib/admin/slug'
import { guardJson, forbidden, unauthorized, checkTreePermission, notFound, jsonOr404, apiError } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { events, eventRegistrations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser, canDo } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'
import { runOnce } from '@/lib/api/idempotency'

export async function GET() {
  try {
    const user = await getAdminUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    { const deny = await checkTreePermission(user, 'brand.events-mgr', 'read'); if (deny) return deny }
    const db = getDb()
    const allEvents = await db.select().from(events).orderBy(events.startDate)
    return NextResponse.json(allEvents)
  } catch (e: unknown) { return apiError(e) }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()
    { const deny = await checkTreePermission(user, 'brand.events-mgr', 'write'); if (deny) return deny }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await guardJson(req)
    const db = getDb()
    const result = (await runOnce(user.id, 'events', body, async () => db.insert(events).values({ ...await ensureUniqueSlug(body as Record<string, unknown>, 'events', 'event'), createdBy: user.id } as never).returning()))[0]
    await logAction(user, 'CREATE', 'event', String(result.id), null, result)
    return NextResponse.json(result, { status: 201 })
  } catch (e: unknown) { return apiError(e) }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()
    { const deny = await checkTreePermission(user, 'brand.events-mgr', 'write'); if (deny) return deny }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id, ...data } = await guardJson(req)
    const db = getDb()
    const result = (await db.update(events).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(events.id, id)).returning())[0]
    if (!result) return notFound()
    await logAction(user, 'UPDATE', 'event', String(id), null, result)
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
    await db.delete(eventRegistrations).where(eq(eventRegistrations.eventId, id))
    await db.delete(events).where(eq(events.id, id))
    await logAction(user, 'DELETE', 'event', String(id), null, null)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) { return apiError(e) }
}
