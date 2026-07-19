import { describe, it, expect } from 'vitest'
import { buildEntry, type Source } from '../sync'

const blog: Source = { type: 'blog', table: 'blog_posts', where: '', titleCols: ['title_en', 'title_fa'], bodyCols: ['excerpt_en', 'content_en'] }

describe('CMS → KB sync mapping', () => {
  it('builds a stable cms:// source key for dedup/idempotency', () => {
    const e = buildEntry(blog, { id: 12, title_en: 'BGP Basics', excerpt_en: 'intro', content_en: 'body' })!
    expect(e.sourceUrl).toBe('cms://blog/12')
    expect(e.title).toBe('BGP Basics')
    expect(e.tags).toBe('cms,blog')
    expect(e.content).toContain('BGP Basics')
    expect(e.content).toContain('intro')
  })

  it('is deterministic — same row yields the same key (idempotent upsert)', () => {
    const row = { id: 5, title_en: 'X' }
    expect(buildEntry(blog, row)!.sourceUrl).toBe(buildEntry(blog, row)!.sourceUrl)
  })

  it('falls back to the Persian title when English is empty', () => {
    const e = buildEntry(blog, { id: 3, title_en: '', title_fa: 'شبکه' })!
    expect(e.title).toBe('شبکه')
  })

  it('returns null when there is no title or id (skip, never a broken entry)', () => {
    expect(buildEntry(blog, { id: 1, title_en: '', title_fa: '' })).toBeNull()
    expect(buildEntry(blog, { title_en: 'no id' })).toBeNull()
  })

  it('strips HTML and caps very long content', () => {
    const e = buildEntry(blog, { id: 9, title_en: 'T', content_en: '<p>hello <b>world</b></p>' + 'x'.repeat(5000) })!
    expect(e.content).not.toMatch(/<[^>]+>/)
    expect(e.content).toContain('hello world')
    expect(e.content.length).toBeLessThanOrEqual(2000)
  })
})
