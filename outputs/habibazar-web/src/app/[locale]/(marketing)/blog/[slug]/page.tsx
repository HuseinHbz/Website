'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface BlogPost {
  id: number
  slug: string
  titleEn: string
  titleFa: string
  excerptEn: string | null
  excerptFa: string | null
  contentEn: string | null
  contentFa: string | null
  readTimeEn: string | null
  readTimeFa: string | null
  publishedAtEn: string | null
  publishedAtFa: string | null
  categoryId: number | null
  categoryNameEn?: string
  categoryNameFa?: string
  categoryColor?: string
}

function renderMarkdown(text: string): string {
  let html = text

  // Code blocks (before other replacements)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `<pre class="code-block" data-lang="${lang || 'text'}"><code>${escaped}</code></pre>`
  })

  // Inline code
  html = html.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>')

  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4 class="md-h4">$1</h4>')
  html = html.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Tables
  html = html.replace(/\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)*)/g, (_m, header, rows) => {
    const ths = header.split('|').filter((c: string) => c.trim()).map((c: string) => `<th>${c.trim()}</th>`).join('')
    const trs = rows.trim().split('\n').map((row: string) =>
      `<tr>${row.split('|').filter((c: string) => c.trim()).map((c: string) => `<td>${c.trim()}</td>`).join('')}</tr>`
    ).join('')
    return `<div class="table-wrap"><table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`
  })

  // Unordered lists
  html = html.replace(/(^[-*] .+\n?)+/gm, (block) => {
    const items = block.trim().split('\n').map(line =>
      `<li>${line.replace(/^[-*] /, '')}</li>`
    ).join('')
    return `<ul class="md-ul">${items}</ul>`
  })

  // Ordered lists
  html = html.replace(/(^\d+\. .+\n?)+/gm, (block) => {
    const items = block.trim().split('\n').map(line =>
      `<li>${line.replace(/^\d+\. /, '')}</li>`
    ).join('')
    return `<ol class="md-ol">${items}</ol>`
  })

  // Paragraphs (lines not inside special elements)
  html = html.replace(/^(?!<[hH\d]|<ul|<ol|<li|<pre|<div|<table|<th|<tr|<td|<tb)(.+)$/gm, '<p>$1</p>')

  // Blank lines → spacing
  html = html.replace(/\n{2,}/g, '\n')

  return html
}

export default function BlogPostPage() {
  const params = useParams()
  const slug = params?.slug as string
  const locale = params?.locale as string
  const isRTL = locale === 'fa'

  const [post, setPost] = useState<BlogPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    fetch(`/api/blog/${slug}`)
      .then(r => {
        if (!r.ok) { setNotFound(true); setLoading(false); return null }
        return r.json()
      })
      .then(data => {
        if (data) setPost(data)
        setLoading(false)
      })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [slug])

  if (loading) {
    return (
      <div className="pt-24 min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound || !post) {
    return (
      <div className="pt-24 min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-6xl">📄</div>
        <h1 className="text-2xl font-bold text-text-primary">
          {isRTL ? 'مقاله یافت نشد' : 'Post not found'}
        </h1>
        <Link href={`/${locale}/blog`} className="text-accent hover:text-accent-hover">
          {isRTL ? '← بازگشت به وبلاگ' : '← Back to Blog'}
        </Link>
      </div>
    )
  }

  const title = isRTL ? post.titleFa : post.titleEn
  const content = isRTL ? post.contentFa : post.contentEn
  const readTime = isRTL ? post.readTimeFa : post.readTimeEn
  const publishedAt = isRTL ? post.publishedAtFa : post.publishedAtEn
  const catName = isRTL ? post.categoryNameFa : post.categoryNameEn
  const color = post.categoryColor || '#6366f1'

  return (
    <div className="pt-16 min-h-screen" dir={isRTL ? 'rtl' : 'ltr'}>
      <style>{`
        .prose-content h1.md-h1 { font-size:1.75rem; font-weight:800; color:var(--text-primary,#fff); margin:2rem 0 1rem; }
        .prose-content h2.md-h2 { font-size:1.35rem; font-weight:700; color:var(--text-primary,#fff); margin:2rem 0 0.75rem; padding-bottom:0.4rem; border-bottom:1px solid rgba(99,102,241,0.2); }
        .prose-content h3.md-h3 { font-size:1.1rem; font-weight:700; color:var(--text-primary,#fff); margin:1.5rem 0 0.5rem; }
        .prose-content h4.md-h4 { font-size:1rem; font-weight:600; color:var(--text-primary,#e2e8f0); margin:1.25rem 0 0.4rem; }
        .prose-content p { color:var(--text-secondary,#94a3b8); line-height:1.8; margin:0.75rem 0; }
        .prose-content strong { color:var(--text-primary,#fff); font-weight:600; }
        .prose-content em { font-style:italic; color:#a5b4fc; }
        .prose-content .md-ul, .prose-content .md-ol { color:var(--text-secondary,#94a3b8); padding-inline-start:1.5rem; margin:0.75rem 0; }
        .prose-content li { margin:0.3rem 0; line-height:1.7; }
        .prose-content .code-block { background:#0d0d1a; border:1px solid rgba(99,102,241,0.2); border-radius:0.75rem; padding:1.25rem; overflow-x:auto; margin:1.25rem 0; font-size:0.82rem; line-height:1.6; }
        .prose-content .code-block code { color:#a5b4fc; font-family:'JetBrains Mono',Consolas,monospace; white-space:pre; }
        .prose-content .code-block::before { content:attr(data-lang); display:block; font-size:0.65rem; color:#6366f1; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:0.75rem; opacity:0.7; }
        .prose-content .inline-code { background:rgba(99,102,241,0.15); color:#a5b4fc; padding:0.1em 0.4em; border-radius:0.3em; font-size:0.85em; font-family:'JetBrains Mono',Consolas,monospace; }
        .prose-content .table-wrap { overflow-x:auto; margin:1.25rem 0; }
        .prose-content table { border-collapse:collapse; width:100%; font-size:0.85rem; }
        .prose-content th { background:rgba(99,102,241,0.15); color:#a5b4fc; padding:0.6rem 0.9rem; text-align:start; font-weight:600; }
        .prose-content td { padding:0.5rem 0.9rem; color:var(--text-secondary,#94a3b8); border-bottom:1px solid rgba(255,255,255,0.05); }
        .prose-content tr:hover td { background:rgba(255,255,255,0.02); }
      `}</style>

      {/* Hero */}
      <section className="relative overflow-hidden py-20" style={{ background: 'linear-gradient(180deg, #07070d 0%, #0d0d17 100%)' }}>
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }} />

        <div className="container-site relative z-10 max-w-4xl">
          <Link
            href={`/${locale}/blog`}
            className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-accent transition-colors mb-8"
          >
            {isRTL ? '← بازگشت به وبلاگ' : '← Back to Blog'}
          </Link>

          {catName && (
            <div className="mb-4">
              <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: `${color}20`, color }}>
                {catName}
              </span>
            </div>
          )}

          <h1 className="text-3xl md:text-4xl font-black text-text-primary leading-tight mb-6">
            {title}
          </h1>

          <div className="flex items-center gap-4 text-sm text-text-muted">
            {publishedAt && <span>📅 {publishedAt}</span>}
            {readTime && <span>⏱ {readTime}</span>}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-16" style={{ background: '#0a0a14' }}>
        <div className="container-site max-w-4xl">
          {content ? (
            <article
              className="prose-content"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          ) : (
            <div className="text-center py-16 text-text-muted">
              <div className="text-4xl mb-4">📝</div>
              <p>{isRTL ? 'محتوا در حال آماده‌سازی است...' : 'Content coming soon...'}</p>
            </div>
          )}

          {/* Footer nav */}
          <div className="mt-16 pt-8 border-t border-border/30 flex items-center justify-between">
            <Link
              href={`/${locale}/blog`}
              className="flex items-center gap-2 text-sm text-text-muted hover:text-accent transition-colors"
            >
              {isRTL ? '← همه مقالات' : '← All Articles'}
            </Link>
            <Link
              href={`/${locale}/consultation`}
              className="btn-primary text-sm"
            >
              {isRTL ? 'مشاوره رایگان' : 'Free Consultation'}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
