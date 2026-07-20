import { NextRequest, NextResponse } from 'next/server'
import { apiError, guardJson, forbidden, unauthorized, checkTreePermission } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { redirects } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getAdminUser, canDo } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  try {
    const db = getDb()
    const rows = await db.select().from(redirects).orderBy(desc(redirects.createdAt))
    return NextResponse.json(rows)
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()
    { const deny = await checkTreePermission(user, 'system.seo', 'write'); if (deny) return deny }
    const body = await guardJson(req)
    const db = getDb()
    const result = await db.insert(redirects).values(body).returning()
    await logAction(user, 'CREATE', 'redirects', String(result[0]?.id), null, body)
    return NextResponse.json(result[0])
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()
    { const deny = await checkTreePermission(user, 'system.seo', 'write'); if (deny) return deny }
    const { id, ...data } = await guardJson(req)
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const db = getDb()
    await db.update(redirects).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(redirects.id, id))
    await logAction(user, 'UPDATE', 'redirects', String(id), null, data)
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
    await db.delete(redirects).where(eq(redirects.id, id))
    await logAction(user, 'DELETE', 'redirects', String(id))
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
