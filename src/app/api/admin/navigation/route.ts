import { NextRequest, NextResponse } from 'next/server'
import { apiError, guardJson, requirePermission } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { navigationItems } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { logAction } from '@/lib/admin/audit'

// 26.28 بند ۰.۱ — this route previously had NO in-route auth on GET (middleware
// still JWT-gated it, but defense-in-depth requires the registry key in code).
// Key: brand.menus — the Menu Builder module that owns navigation_items.

export async function GET() {
  const auth = await requirePermission('brand.menus', 'read')
  if ('error' in auth) return auth.error
  try {
    const db = getDb()
    return NextResponse.json(await db.select().from(navigationItems).orderBy(asc(navigationItems.sortOrder)))
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission('brand.menus', 'write', 'edit')
  if ('error' in auth) return auth.error
  try {
    const body = await guardJson(req)
    const db = getDb()
    const result = await db.insert(navigationItems).values(body).returning()
    await logAction(auth.user, 'CREATE', 'navigation_items', result[0]?.id, null, body)
    return NextResponse.json(result[0])
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requirePermission('brand.menus', 'write', 'edit')
  if ('error' in auth) return auth.error
  try {
    const { id, ...data } = await guardJson(req)
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const db = getDb()
    await db.update(navigationItems).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(navigationItems.id, id))
    await logAction(auth.user, 'UPDATE', 'navigation_items', id, null, data)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission('brand.menus', 'write', 'delete')
  if ('error' in auth) return auth.error
  try {
    const { id } = await guardJson(req)
    const db = getDb()
    await db.delete(navigationItems).where(eq(navigationItems.id, id))
    await logAction(auth.user, 'DELETE', 'navigation_items', id)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
