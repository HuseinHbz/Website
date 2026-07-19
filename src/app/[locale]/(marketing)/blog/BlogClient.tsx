'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Post {
  title: string
  category: string
  categoryDisplay: string
  publishedAt: string
  readTime: string
  excerpt: string
  color: string
  slug: string | null
}

interface Category {
  name: string
  icon: string
  color: string
  count: number
}

interface Props {
  posts: Post[]
  categories: Category[]
  locale: string
  isRTL: boolean
}

export default function BlogClient({ posts, categories, locale, isRTL }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const filtered = activeCategory
    ? posts.filter(p => p.category === activeCategory || p.categoryDisplay === activeCategory)
    : posts

  return (
    <>
      {/* Category filter */}
      <div className="mb-16">
        <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted mb-6">
          {isRTL ? 'مرور بر اساس دسته‌بندی' : 'Browse by Category'}
        </h2>
        <div className="flex flex-wrap gap-3">
          {/* All button */}
          <button
            onClick={() => setActiveCategory(null)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl cursor-pointer hover:scale-105 transition-all"
            style={activeCategory === null
              ? { background: '#6366f1', border: '1px solid #6366f1', color: '#fff' }
              : { background: '#6366f115', border: '1px solid #6366f130', color: '#6366f1' }
            }
          >
            <span className="text-sm font-medium">{isRTL ? 'همه' : 'All'}</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#6366f120', color: '#6366f1' }}>
              {posts.length}
            </span>
          </button>

          {categories.map((cat) => {
            const isActive = activeCategory === cat.name
            const catPosts = posts.filter(p => p.category === cat.name || p.categoryDisplay === cat.name)
            return (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(isActive ? null : cat.name)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl cursor-pointer hover:scale-105 transition-all"
                style={isActive
                  ? { background: cat.color, border: `1px solid ${cat.color}`, color: '#fff' }
                  : { background: `${cat.color}15`, border: `1px solid ${cat.color}30` }
                }
              >
                <span>{cat.icon}</span>
                <span className="text-sm font-medium" style={isActive ? { color: '#fff' } : { color: cat.color }}>{cat.name}</span>
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: `${cat.color}20`, color: isActive ? '#fff' : cat.color }}>
                  {catPosts.length > 0 ? catPosts.length : cat.count || 0}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Posts grid */}
      <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted mb-6">
        {activeCategory
          ? isRTL ? `مقالات: ${activeCategory}` : `Articles: ${activeCategory}`
          : isRTL ? 'آخرین مقالات' : 'Latest Articles'}
        <span className="ml-2 normal-case font-normal text-text-muted/60">({filtered.length})</span>
      </h2>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-text-muted">
          <div className="text-4xl mb-4">📭</div>
          <p>{isRTL ? 'مقاله‌ای در این دسته‌بندی یافت نشد' : 'No articles found in this category'}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((post, i) => {
            const card = (
              <article className="service-card group cursor-pointer h-full">
                <div
                  className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
                  style={{ background: `linear-gradient(90deg, ${post.color}, transparent)` }}
                />
                <div className="flex items-center justify-between mb-4">
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                    style={{ background: `${post.color}15`, color: post.color }}
                  >
                    {post.category || post.categoryDisplay}
                  </span>
                  <span className="text-xs text-text-muted">{post.readTime}</span>
                </div>
                <h3 className="text-base font-bold text-text-primary mb-3 group-hover:text-accent transition-colors leading-snug">
                  {post.title}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed mb-4 line-clamp-3">
                  {post.excerpt}
                </p>
                <div className="flex items-center justify-between pt-3 border-t border-border/50 mt-auto">
                  <span className="text-xs text-text-muted">{post.publishedAt}</span>
                  <span className="text-xs text-accent font-medium group-hover:text-accent-hover transition-colors">
                    {isRTL ? 'خواندن مقاله ←' : 'Read Article →'}
                  </span>
                </div>
              </article>
            )
            return post.slug
              ? <Link key={i} href={`/${locale}/blog/${post.slug}`} className="block">{card}</Link>
              : <div key={i}>{card}</div>
          })}
        </div>
      )}
    </>
  )
}
