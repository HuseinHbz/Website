import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { aiKnowledgeBase, projects, blogPosts, docs, courses, products, events, solutions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

type SearchResult = {
  type: string
  id: number
  title: string
  excerpt: string
  url: string
  icon: string
  score: number
}

function score(text: string | null | undefined, terms: string[]): number {
  if (!text) return 0
  const lower = text.toLowerCase()
  return terms.reduce((s, t) => s + (lower.includes(t) ? 1 : 0), 0)
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') || ''
  const locale = (req.nextUrl.searchParams.get('locale') || 'en') as 'en' | 'fa'
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20')
  const types = req.nextUrl.searchParams.get('types') // comma-separated filter
  if (!query.trim()) return NextResponse.json([])

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const db = getDb()
  const results: SearchResult[] = []
  const allowedTypes = types ? types.split(',') : null

  const should = (type: string) => !allowedTypes || allowedTypes.includes(type)

  // Knowledge Base
  if (should('knowledge')) {
    const kbItems = db.select().from(aiKnowledgeBase).where(eq(aiKnowledgeBase.active, true)).all()
    for (const item of kbItems) {
      const s = score(item.title, terms) * 3 + score(item.content, terms) + score(item.tags, terms) * 2
      if (s > 0) results.push({ type: 'knowledge', id: item.id, title: item.title, excerpt: (item.content || '').slice(0, 200), url: '/admin/ai-kb', icon: '📚', score: s + item.priority })
    }
  }

  // Docs
  if (should('docs')) {
    const allDocs = db.select().from(docs).where(eq(docs.status, 'published')).all()
    for (const d of allDocs) {
      const title = locale === 'fa' ? (d.titleFa || d.titleEn) : d.titleEn
      const s = score(title, terms) * 3 + score(d.excerptEn, terms) * 2 + score(d.contentEn, terms)
      if (s > 0) results.push({ type: 'docs', id: d.id, title, excerpt: (d.excerptEn || '').slice(0, 200), url: `/${locale}/docs/${d.slug}`, icon: '📄', score: s })
    }
  }

  // Products
  if (should('products')) {
    const allProducts = db.select().from(products).where(eq(products.active, true)).all()
    for (const p of allProducts) {
      const title = locale === 'fa' ? (p.nameFa || p.nameEn) : p.nameEn
      const s = score(title, terms) * 3 + score(p.taglineEn, terms) * 2 + score(p.descriptionEn, terms)
      if (s > 0) results.push({ type: 'products', id: p.id, title, excerpt: (p.taglineEn || '').slice(0, 200), url: `/${locale}/products/${p.slug}`, icon: p.icon || '📦', score: s })
    }
  }

  // Courses
  if (should('academy')) {
    const allCourses = db.select().from(courses).where(eq(courses.status, 'published')).all()
    for (const c of allCourses) {
      const title = locale === 'fa' ? (c.titleFa || c.titleEn) : c.titleEn
      const s = score(title, terms) * 3 + score(c.descriptionEn, terms)
      if (s > 0) results.push({ type: 'academy', id: c.id, title, excerpt: (c.descriptionEn || '').slice(0, 200), url: `/${locale}/academy/${c.slug}`, icon: '🎓', score: s })
    }
  }

  // Solutions
  if (should('solutions')) {
    const allSolutions = db.select().from(solutions).where(eq(solutions.active, true)).all()
    for (const sol of allSolutions) {
      const title = locale === 'fa' ? (sol.nameFa || sol.nameEn) : sol.nameEn
      const s = score(title, terms) * 3 + score(sol.taglineEn, terms) * 2
      if (s > 0) results.push({ type: 'solutions', id: sol.id, title, excerpt: (sol.taglineEn || '').slice(0, 200), url: `/${locale}/solutions/${sol.slug}`, icon: sol.icon || '💡', score: s })
    }
  }

  // Case Studies
  if (should('projects')) {
    const allProjects = db.select().from(projects).all()
    for (const p of allProjects) {
      const title = locale === 'fa' ? (p.nameFa || p.nameEn) : p.nameEn
      const desc = locale === 'fa' ? (p.challengeFa || '') : (p.challengeEn || '')
      const s = score(title, terms) * 3 + score(desc, terms) + score(p.industryEn, terms)
      if (s > 0) results.push({ type: 'projects', id: p.id, title, excerpt: desc.slice(0, 200), url: `/${locale}/case-studies/${p.slug}`, icon: '📊', score: s })
    }
  }

  // Blog
  if (should('blog')) {
    const allPosts = db.select().from(blogPosts).where(eq(blogPosts.status, 'published')).all()
    for (const post of allPosts) {
      const title = locale === 'fa' ? (post.titleFa || post.titleEn) : post.titleEn
      const excerpt = locale === 'fa' ? (post.excerptFa || post.excerptEn || '') : (post.excerptEn || '')
      const s = score(title, terms) * 3 + score(excerpt, terms)
      if (s > 0) results.push({ type: 'blog', id: post.id, title, excerpt: excerpt.slice(0, 200), url: `/${locale}/blog/${post.slug}`, icon: '📝', score: s })
    }
  }

  // Events
  if (should('events')) {
    const allEvents = db.select().from(events).all()
    for (const e of allEvents) {
      const title = locale === 'fa' ? (e.titleFa || e.titleEn) : e.titleEn
      const s = score(title, terms) * 3 + score(e.descriptionEn, terms)
      if (s > 0) results.push({ type: 'events', id: e.id, title, excerpt: (e.descriptionEn || '').slice(0, 200), url: `/${locale}/events/${e.slug}`, icon: '🗓️', score: s })
    }
  }

  results.sort((a, b) => b.score - a.score)
  return NextResponse.json(results.slice(0, limit))
}
