import { NextRequest, NextResponse } from 'next/server'
import { ensureSlug, ensureUniqueSlug } from '@/lib/admin/slug'
import { apiError, guardJson, forbidden, unauthorized, checkTreePermission } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { blogPosts, blogCategories } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getAdminUser, canDo } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'
import { runOnce } from '@/lib/api/idempotency'

export async function GET() {
  const db = await getDb()
  const posts = await db.select({
    id: blogPosts.id,
    slug: blogPosts.slug,
    titleEn: blogPosts.titleEn,
    titleFa: blogPosts.titleFa,
    status: blogPosts.status,
    featured: blogPosts.featured,
    views: blogPosts.views,
    categoryId: blogPosts.categoryId,
    publishedAtEn: blogPosts.publishedAtEn,
    createdAt: blogPosts.createdAt,
    updatedAt: blogPosts.updatedAt,
  }).from(blogPosts).orderBy(desc(blogPosts.createdAt))
  const cats = await db.select().from(blogCategories)
  return NextResponse.json({ posts, categories: cats })
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()
    { const deny = await checkTreePermission(user, 'brand.blog', 'write'); if (deny) return deny }
    const body = await guardJson(req)
    // strip id if accidentally sent
    const { id: _id, views: _v, ...data } = body
    const db = getDb()
    const result = await runOnce(user?.id, 'blog', body, async () => db.insert(blogPosts).values({ ...await ensureUniqueSlug(data as Record<string, unknown>, 'blog_posts', 'post'), updatedBy: user?.id } as never).returning())
    await logAction(user, 'CREATE', 'blog_posts', result[0]?.id, null, data)
    return NextResponse.json(result[0])
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return unauthorized()
  { const deny = await checkTreePermission(user, 'brand.blog', 'write'); if (deny) return deny }
  const { id, ...data } = await guardJson(req)
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const db = getDb()
  await db.update(blogPosts).set({ ...data, updatedAt: new Date().toISOString(), updatedBy: user?.id }).where(eq(blogPosts.id, id))
  await logAction(user, 'UPDATE', 'blog_posts', id, null, data)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getAdminUser()
  if (!user || !canDo(user.role, 'delete')) return forbidden('Delete requires an administrator role')
  const { id } = await guardJson(req)
  const db = getDb()
  await db.delete(blogPosts).where(eq(blogPosts.id, id))
  await logAction(user, 'DELETE', 'blog_posts', id)
  return NextResponse.json({ ok: true })
}
