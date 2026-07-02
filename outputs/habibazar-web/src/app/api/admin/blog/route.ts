import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { blogPosts, blogCategories } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  const db = getDb()
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
  }).from(blogPosts).orderBy(desc(blogPosts.createdAt)).all()
  const cats = await db.select().from(blogCategories).all()
  return NextResponse.json({ posts, categories: cats })
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAdminUser()
    const body = await req.json()
    // strip id if accidentally sent
    const { id: _id, views: _v, ...data } = body
    const db = getDb()
    const result = await db.insert(blogPosts).values({ ...data, updatedBy: user?.id }).returning()
    await logAction(user, 'CREATE', 'blog_posts', result[0]?.id, null, data)
    return NextResponse.json(result[0])
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  const { id, ...data } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const db = getDb()
  await db.update(blogPosts).set({ ...data, updatedAt: new Date().toISOString(), updatedBy: user?.id }).where(eq(blogPosts.id, id))
  await logAction(user, 'UPDATE', 'blog_posts', id, null, data)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getAdminUser()
  const { id } = await req.json()
  const db = getDb()
  await db.delete(blogPosts).where(eq(blogPosts.id, id))
  await logAction(user, 'DELETE', 'blog_posts', id)
  return NextResponse.json({ ok: true })
}
