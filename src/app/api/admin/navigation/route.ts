import { NextRequest, NextResponse } from 'next/server'
import { apiError, guardJson, requirePermission } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { navigationItems } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { logAction } from '@/lib/admin/audit'
import { isKnownRoute, unknownRouteMessage } from '@/lib/publicRoutes'
import { pgQuery } from '@/lib/db'

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


/**
 * 26.33 BUG-203 — a menu item pointing at a page that does not exist saved
 * silently and only surfaced as a 404 for visitors. Validate on write, and say
 * WHY (26.29 error contract) instead of accepting a broken link.
 *
 * Dynamic detail pages are real routes too, so DB-backed slugs count as known.
 */
async function assertKnownHref(href: unknown, fa: boolean): Promise<NextResponse | null> {
  if (typeof href !== 'string' || !href.trim()) return null   // a parent/heading row carries no href
  const dynamic: string[] = []
  for (const [table, prefix] of [['pages', ''], ['solutions', '/solutions'], ['blog_posts', '/blog']] as const) {
    const rows = await pgQuery<{ slug: string }>(`SELECT slug FROM ${table}`).catch(() => [])
    for (const r of rows) if (r.slug) dynamic.push(`${prefix}/${r.slug}`)
  }
  if (isKnownRoute(href, dynamic)) return null
  return NextResponse.json({ error: unknownRouteMessage(href, fa) }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission('brand.menus', 'write', 'edit')
  if ('error' in auth) return auth.error
  try {
    const body = await guardJson(req)
    const bad = await assertKnownHref(body.href, req.headers.get('accept-language')?.startsWith('fa') ?? true)
    if (bad) return bad
    const db = getDb()
    // The footer builder never offers a parent picker (only header items
    // nest), so a footer row can only ever get a parentId by hand-editing
    // the request or by a leftover value surviving a location switch. A
    // stray parentId pointing at a HEADER item is invisible in BOTH admin
    // views: buildNavTree() promotes it to a phantom top-level footer
    // column on the public site (its parent isn't in the footer-scoped
    // row set), while the admin tree hides it because its parent isn't in
    // the footer top-level list either. Force it null at write time.
    const values = body.location === 'footer' ? { ...body, parentId: null } : body
    const result = await db.insert(navigationItems).values(values).returning()
    await logAction(auth.user, 'CREATE', 'navigation_items', result[0]?.id, null, values)
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
    { const bad = await assertKnownHref(data.href, req.headers.get('accept-language')?.startsWith('fa') ?? true); if (bad) return bad }
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    // Same orphan guard as POST — also covers the edit path where an item's
    // location is switched to 'footer' while a header-scoped parentId is
    // still sitting on the record.
    if (data.location === 'footer') data.parentId = null
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
