import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { blogPosts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const post = await db.select().from(blogPosts).where(eq(blogPosts.id, Number(id))).get()
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(post)
}
