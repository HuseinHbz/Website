import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const db = getDb().$client
    const row = db.prepare(`
      SELECT bp.*, bc.name_en as category_name_en, bc.name_fa as category_name_fa, bc.color as category_color
      FROM blog_posts bp
      LEFT JOIN blog_categories bc ON bc.id = bp.category_id
      WHERE bp.slug = ? AND bp.status = 'published'
    `).get(slug) as Record<string, unknown> | undefined

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
      id: row.id,
      slug: row.slug,
      titleEn: row.title_en,
      titleFa: row.title_fa,
      excerptEn: row.excerpt_en,
      excerptFa: row.excerpt_fa,
      contentEn: row.content_en,
      contentFa: row.content_fa,
      readTimeEn: row.read_time_en,
      readTimeFa: row.read_time_fa,
      publishedAtEn: row.published_at_en,
      publishedAtFa: row.published_at_fa,
      categoryId: row.category_id,
      categoryNameEn: row.category_name_en,
      categoryNameFa: row.category_name_fa,
      categoryColor: row.category_color,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
