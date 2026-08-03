import { ensureSlug, ensureUniqueSlug } from '@/lib/admin/slug'
import { NextRequest, NextResponse } from 'next/server'
import { guardJson, forbidden, unauthorized, checkTreePermission, apiError, notFound, jsonOr404 } from '@/lib/api/respond'
import { getAdminUser, canDo } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'
import { getDb } from '@/lib/db'
import { content } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { runOnce } from '@/lib/api/idempotency'

export async function GET(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    { const deny = await checkTreePermission(user, 'brand.content', 'read'); if (deny) return deny }
    const db = getDb()
    const type = req.nextUrl.searchParams.get('type')
    const rows = type
      ? await db.select().from(content).where(eq(content.type, type as 'blog')).orderBy(desc(content.publishedAt))
      : await db.select().from(content).orderBy(desc(content.publishedAt))
    return NextResponse.json(rows)
  } catch (e: unknown) { return apiError(e) }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()
    { const deny = await checkTreePermission(user, 'brand.content', 'write'); if (deny) return deny }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await guardJson(req)
    const db = getDb()
    // 26.29: the form leaves slug blank → derive it instead of a 500 (BUG-101)
    const withSlug = await ensureUniqueSlug(body as Record<string, unknown>, 'content', 'content')
    const [row] = await runOnce(user.id, 'content', body, async () => db.insert(content).values({
      slug: withSlug.slug as string, type: body.type || 'blog',
      titleEn: body.titleEn, titleFa: body.titleFa,
      excerptEn: body.excerptEn, excerptFa: body.excerptFa,
      contentEn: body.contentEn, contentFa: body.contentFa,
      categoryId: body.categoryId, coverImage: body.coverImage,
      version: body.version, productId: body.productId,
      readTimeMinutes: body.readTimeMinutes,
      status: body.status || 'draft', featured: body.featured ?? false,
      seoTitle: body.seoTitle, seoDescription: body.seoDescription,
      sortOrder: body.sortOrder ?? 0,
      publishedAt: body.status === 'published' ? new Date().toISOString() : null,
      updatedBy: user.id,
    }).returning())
    await logAction(user, 'create', 'content', row.id)
    return NextResponse.json(row, { status: 201 })
  } catch (e: unknown) { return apiError(e) }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()
    { const deny = await checkTreePermission(user, 'brand.content', 'write'); if (deny) return deny }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await guardJson(req)
    const db = getDb()
    const existing = await db.select({ publishedAt: content.publishedAt, status: content.status })
      .from(content).where(eq(content.id, body.id)).limit(1)
    const wasPublished = existing[0]?.status === 'published'
    const [row] = await db.update(content).set({
      slug: body.slug, type: body.type,
      titleEn: body.titleEn, titleFa: body.titleFa,
      excerptEn: body.excerptEn, excerptFa: body.excerptFa,
      contentEn: body.contentEn, contentFa: body.contentFa,
      categoryId: body.categoryId, coverImage: body.coverImage,
      version: body.version, productId: body.productId,
      readTimeMinutes: body.readTimeMinutes,
      status: body.status, featured: body.featured,
      seoTitle: body.seoTitle, seoDescription: body.seoDescription,
      sortOrder: body.sortOrder,
      publishedAt: body.status === 'published' && !wasPublished ? new Date().toISOString() : existing[0]?.publishedAt,
      updatedBy: user.id,
    }).where(eq(content.id, body.id)).returning()
    if (!row) return notFound()
    await logAction(user, 'update', 'content', body.id)
    return jsonOr404(row)
  } catch (e: unknown) { return apiError(e) }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user || !canDo(user.role, 'delete')) return forbidden('Delete requires an administrator role')
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await guardJson(req)
    const db = getDb()
    await db.delete(content).where(eq(content.id, id))
    await logAction(user, 'delete', 'content', id)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) { return apiError(e) }
}
