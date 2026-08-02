import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { blogPosts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('brand.blog', 'read')
  if ('error' in auth) return auth.error
  const { id } = await params
  const db = getDb()
  const post = (await db.select().from(blogPosts).where(eq(blogPosts.id, Number(id))))[0]
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(post)
}
