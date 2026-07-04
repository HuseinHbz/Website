import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { aiKnowledgeBase, projects, blogPosts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

type SearchResult = {
  type: 'knowledge' | 'project' | 'blog'
  id: number
  title: string
  excerpt: string
  url?: string
  score: number
}

function scoreText(text: string, terms: string[]): number {
  if (!text) return 0
  const lower = text.toLowerCase()
  return terms.reduce((s, t) => s + (lower.includes(t) ? 1 : 0), 0)
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') || ''
  const locale = (req.nextUrl.searchParams.get('locale') || 'en') as 'en' | 'fa'
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '10')
  if (!query.trim()) return NextResponse.json([])

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const db = getDb()
  const results: SearchResult[] = []

  // Search knowledge base
  const kbItems = await db.select().from(aiKnowledgeBase).where(eq(aiKnowledgeBase.active, true))
  for (const item of kbItems) {
    const score = scoreText(item.title, terms) * 3 + scoreText(item.content || '', terms) + scoreText(item.tags || '', terms) * 2
    if (score > 0) {
      results.push({
        type: 'knowledge',
        id: item.id,
        title: item.title,
        excerpt: (item.content || '').slice(0, 200),
        score: score + item.priority,
      })
    }
  }

  // Search case studies
  const caseStudies = await db.select().from(projects)
  for (const p of caseStudies) {
    const title = locale === 'fa' ? (p.nameFa || p.nameEn) : p.nameEn
    const desc = locale === 'fa' ? (p.challengeFa || p.solutionFa || '') : (p.challengeEn || p.solutionEn || '')
    const score = scoreText(title, terms) * 3 + scoreText(desc, terms) + scoreText(p.industryEn || '', terms)
    if (score > 0) {
      results.push({ type: 'project', id: p.id, title, excerpt: desc.slice(0, 200), url: `/case-studies/${p.slug}`, score })
    }
  }

  // Search blog
  const posts = await db.select().from(blogPosts).where(eq(blogPosts.status, 'published'))
  for (const post of posts) {
    const title = locale === 'fa' ? (post.titleFa || post.titleEn) : post.titleEn
    const excerpt = locale === 'fa' ? (post.excerptFa || post.excerptEn || '') : (post.excerptEn || '')
    const score = scoreText(title, terms) * 3 + scoreText(excerpt, terms)
    if (score > 0) {
      results.push({ type: 'blog', id: post.id, title, excerpt: excerpt.slice(0, 200), url: `/blog/${post.slug}`, score })
    }
  }

  results.sort((a, b) => b.score - a.score)
  return NextResponse.json(results.slice(0, limit))
}
