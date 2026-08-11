import { describe, it, expect } from 'vitest'
import { articleSchema } from '../schema'

describe('articleSchema', () => {
  const base = {
    title: 'Building a Multi-Site Network',
    description: 'A guide',
    url: 'https://example.com/en/blog/post',
  }

  it('normalizes the app\'s "YYYY-MM-DD HH:MM:SS" DB timestamp format to real ISO 8601', () => {
    const s = articleSchema({ ...base, datePublished: '2026-08-11 12:14:58' })
    expect(s.datePublished).toBe('2026-08-11T12:14:58Z')
    expect(s.dateModified).toBe('2026-08-11T12:14:58Z')
  })

  it('leaves an already-ISO8601 date unchanged', () => {
    const s = articleSchema({ ...base, datePublished: '2026-08-11T12:14:58.000Z' })
    expect(s.datePublished).toBe('2026-08-11T12:14:58.000Z')
  })

  it('falls back dateModified to datePublished when omitted', () => {
    const s = articleSchema({ ...base, datePublished: '2026-08-11 12:14:58' })
    expect(s.dateModified).toBe(s.datePublished)
  })

  it('uses a distinct dateModified when provided', () => {
    const s = articleSchema({ ...base, datePublished: '2026-08-01 09:00:00', dateModified: '2026-08-10 10:00:00' })
    expect(s.datePublished).toBe('2026-08-01T09:00:00Z')
    expect(s.dateModified).toBe('2026-08-10T10:00:00Z')
  })

  it('produces the correct @type and required schema.org fields', () => {
    const s = articleSchema({ ...base, datePublished: '2026-08-11 12:14:58', image: 'https://example.com/cover.png' })
    expect(s['@context']).toBe('https://schema.org')
    expect(s['@type']).toBe('Article')
    expect(s.headline).toBe(base.title)
    expect(s.image).toBe('https://example.com/cover.png')
    expect(s.author['@type']).toBe('Person')
    expect(s.publisher['@type']).toBe('Organization')
  })

  it('falls back to the default OG image when none is given', () => {
    const s = articleSchema({ ...base, datePublished: '2026-08-11 12:14:58' })
    expect(s.image).toMatch(/og-image\.png$/)
  })
})
