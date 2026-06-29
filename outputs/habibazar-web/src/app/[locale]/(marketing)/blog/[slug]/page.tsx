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

function renderMarkdown(text: string, isRTL: boolean): string {
  // Protect code blocks first — replace with placeholders
  const codeBlocks: string[] = []
  let html = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, lang, code) => {
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .trimEnd()
    const idx = codeBlocks.length
    codeBlocks.push(
      `<div class="code-wrap"><div class="code-header"><span class="code-lang">${(lang || 'text').toUpperCase()}</span><button class="copy-btn" onclick="navigator.clipboard.writeText(this.closest('.code-wrap').querySelector('code').innerText)">Copy</button></div><pre class="code-block" dir="ltr"><code>${escaped}</code></pre></div>`
    )
    return `\x00CODE${idx}\x00`
  })

  // Inline code
  html = html.replace(/`([^`\n]+)`/g, '<code class="inline-code" dir="ltr">$1</code>')

  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4 class="md-h4">$1</h4>')
  html = html.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote class="md-blockquote">$1</blockquote>')

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr class="md-hr" />')

  // Tables
  html = html.replace(/(\|.+\|\n\|[-| :]+\|\n(?:\|.+\|\n?)*)/g, (table) => {
    const lines = table.trim().split('\n')
    if (lines.length < 3) return table
    const ths = lines[0].split('|').filter((c) => c.trim()).map((c) => `<th>${c.trim()}</th>`).join('')
    const trs = lines.slice(2).map((row) =>
      `<tr>${row.split('|').filter((c) => c.trim()).map((c) => `<td>${c.trim()}</td>`).join('')}</tr>`
    ).join('')
    return `<div class="table-wrap"><table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`
  })

  // Unordered lists — handle multi-line blocks
  html = html.replace(/((?:^[ \t]*[-*] .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').filter(l => l.trim()).map(line =>
      `<li>${line.replace(/^[ \t]*[-*] /, '')}</li>`
    ).join('')
    return `<ul class="md-ul">${items}</ul>\n`
  })

  // Ordered lists
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').filter(l => l.trim()).map(line =>
      `<li>${line.replace(/^\d+\. /, '')}</li>`
    ).join('')
    return `<ol class="md-ol">${items}</ol>\n`
  })

  // Paragraphs — only plain text lines not already wrapped in HTML
  html = html.replace(/^(?!\x00CODE|<[a-zA-Z/])(.+)$/gm, '<p>$1</p>')

  // Restore code blocks
  html = html.replace(/\x00CODE(\d+)\x00/g, (_m, idx) => codeBlocks[parseInt(idx)])

  // Clean up extra blank lines
  html = html.replace(/\n{3,}/g, '\n\n')

  return html
}

const PROSE_STYLES = `
  .prose-content {
    font-size: 1rem;
    line-height: 1.85;
    color: #cbd5e1;
  }
  .prose-content h1.md-h1 {
    font-size: 1.9rem;
    font-weight: 800;
    color: #f1f5f9;
    margin: 2.5rem 0 1rem;
    line-height: 1.3;
    letter-spacing: -0.02em;
  }
  .prose-content h2.md-h2 {
    font-size: 1.4rem;
    font-weight: 700;
    color: #f1f5f9;
    margin: 2.5rem 0 0.9rem;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid rgba(99,102,241,0.25);
    line-height: 1.35;
  }
  .prose-content h3.md-h3 {
    font-size: 1.15rem;
    font-weight: 700;
    color: #e2e8f0;
    margin: 2rem 0 0.6rem;
    line-height: 1.4;
  }
  .prose-content h4.md-h4 {
    font-size: 1rem;
    font-weight: 600;
    color: #a5b4fc;
    margin: 1.5rem 0 0.4rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 0.85rem;
  }
  .prose-content p {
    color: #cbd5e1;
    line-height: 1.9;
    margin: 0.9rem 0;
    font-size: 1rem;
  }
  .prose-content strong {
    color: #f1f5f9;
    font-weight: 600;
  }
  .prose-content em {
    font-style: italic;
    color: #a5b4fc;
  }
  .prose-content .md-ul,
  .prose-content .md-ol {
    color: #cbd5e1;
    padding-inline-start: 1.75rem;
    margin: 1rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .prose-content .md-ul li {
    list-style: none;
    padding-inline-start: 0.5rem;
    position: relative;
    line-height: 1.75;
  }
  .prose-content .md-ul li::before {
    content: '▸';
    color: #6366f1;
    position: absolute;
    inset-inline-start: -1.1rem;
    font-size: 0.75rem;
    top: 0.25rem;
  }
  .prose-content .md-ol {
    list-style: decimal;
  }
  .prose-content .md-ol li {
    line-height: 1.75;
  }
  .prose-content .md-blockquote {
    border-inline-start: 3px solid #6366f1;
    background: rgba(99,102,241,0.06);
    padding: 0.75rem 1.25rem;
    margin: 1.25rem 0;
    border-radius: 0 0.5rem 0.5rem 0;
    color: #94a3b8;
    font-style: italic;
  }
  .prose-content .md-hr {
    border: none;
    border-top: 1px solid rgba(255,255,255,0.08);
    margin: 2rem 0;
  }
  .prose-content .code-wrap {
    margin: 1.75rem 0;
    border-radius: 0.75rem;
    overflow: hidden;
    border: 1px solid rgba(99,102,241,0.2);
    background: #090910;
  }
  .prose-content .code-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    background: rgba(99,102,241,0.12);
    border-bottom: 1px solid rgba(99,102,241,0.15);
  }
  .prose-content .code-lang {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #818cf8;
  }
  .prose-content .copy-btn {
    font-size: 0.7rem;
    color: #64748b;
    cursor: pointer;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 4px;
    padding: 0.15rem 0.5rem;
    transition: color 0.2s, border-color 0.2s;
  }
  .prose-content .copy-btn:hover {
    color: #a5b4fc;
    border-color: rgba(165,180,252,0.3);
  }
  .prose-content .code-block {
    background: transparent;
    padding: 1.1rem 1.25rem;
    overflow-x: auto;
    font-size: 0.83rem;
    line-height: 1.65;
    margin: 0;
  }
  .prose-content .code-block code {
    color: #a5b4fc;
    font-family: 'JetBrains Mono', 'Fira Code', Consolas, 'Courier New', monospace;
    white-space: pre;
    display: block;
  }
  .prose-content .inline-code {
    background: rgba(99,102,241,0.12);
    color: #a5b4fc;
    padding: 0.15em 0.45em;
    border-radius: 0.3em;
    font-size: 0.875em;
    font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
    border: 1px solid rgba(99,102,241,0.2);
  }
  .prose-content .table-wrap {
    overflow-x: auto;
    margin: 1.5rem 0;
    border-radius: 0.65rem;
    border: 1px solid rgba(255,255,255,0.07);
  }
  .prose-content table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.875rem;
    min-width: 400px;
  }
  .prose-content thead {
    background: rgba(99,102,241,0.12);
  }
  .prose-content th {
    color: #a5b4fc;
    padding: 0.7rem 1rem;
    text-align: start;
    font-weight: 600;
    font-size: 0.8rem;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }
  .prose-content td {
    padding: 0.6rem 1rem;
    color: #94a3b8;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    line-height: 1.5;
  }
  .prose-content tr:last-child td {
    border-bottom: none;
  }
  .prose-content tr:hover td {
    background: rgba(255,255,255,0.02);
    color: #cbd5e1;
  }
`

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
  const excerpt = isRTL ? post.excerptFa : post.excerptEn
  const content = isRTL ? post.contentFa : post.contentEn
  const readTime = isRTL ? post.readTimeFa : post.readTimeEn
  const publishedAt = isRTL ? post.publishedAtFa : post.publishedAtEn
  const catName = isRTL ? post.categoryNameFa : post.categoryNameEn
  const color = post.categoryColor || '#6366f1'

  return (
    <div className="pt-16 min-h-screen" dir={isRTL ? 'rtl' : 'ltr'}>
      <style>{PROSE_STYLES}</style>

      {/* Hero */}
      <section className="relative overflow-hidden py-20" style={{ background: 'linear-gradient(180deg, #07070d 0%, #0d0d17 100%)' }}>
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}80, transparent)` }} />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />

        <div className="container-site relative z-10 max-w-4xl">
          {/* Back link */}
          <Link
            href={`/${locale}/blog`}
            className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-accent transition-colors mb-10 group"
          >
            <span className="group-hover:-translate-x-1 transition-transform inline-block">←</span>
            {isRTL ? 'بازگشت به وبلاگ' : 'Back to Blog'}
          </Link>

          {/* Category badge */}
          {catName && (
            <div className="mb-5">
              <span
                className="text-xs font-bold px-3 py-1.5 rounded-full tracking-wider uppercase"
                style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
              >
                {catName}
              </span>
            </div>
          )}

          {/* Title */}
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-text-primary leading-tight mb-6" style={{ letterSpacing: '-0.02em' }}>
            {title}
          </h1>

          {/* Excerpt */}
          {excerpt && (
            <p className="text-lg text-text-secondary leading-relaxed mb-8 max-w-3xl" style={{ opacity: 0.8 }}>
              {excerpt}
            </p>
          )}

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-5 text-sm text-text-muted">
            {publishedAt && (
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {publishedAt}
              </div>
            )}
            {readTime && (
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                {readTime}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-16" style={{ background: 'linear-gradient(180deg, #0a0a14 0%, #080810 100%)' }}>
        <div className="container-site max-w-4xl">

          {content ? (
            <article
              className="prose-content"
              dir={isRTL ? 'rtl' : 'ltr'}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content, isRTL) }}
            />
          ) : (
            <div className="text-center py-16 text-text-muted">
              <div className="text-5xl mb-4">📝</div>
              <p className="text-lg">{isRTL ? 'محتوا در حال آماده‌سازی است...' : 'Content coming soon...'}</p>
            </div>
          )}

          {/* Footer nav */}
          <div className="mt-20 pt-8 border-t border-border/20 flex items-center justify-between gap-4 flex-wrap">
            <Link
              href={`/${locale}/blog`}
              className="flex items-center gap-2 text-sm text-text-muted hover:text-accent transition-colors group"
            >
              <span className="group-hover:-translate-x-1 transition-transform inline-block">←</span>
              {isRTL ? 'همه مقالات' : 'All Articles'}
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
