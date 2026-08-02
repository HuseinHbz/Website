import { describe, it, expect } from 'vitest'
import { slugify, slugFrom, ensureSlug } from '../slug'

describe('26.29 — slug auto-fill (BUG-101..109 root cause)', () => {
  it('slugifies latin titles', () => {
    expect(slugify('  Enterprise Networking  ')).toBe('enterprise-networking')
    expect(slugify('VMware vSphere 8.0!')).toBe('vmware-vsphere-80')
    expect(slugify('A---B__C')).toBe('a-b-c')
  })

  it('keeps Persian letters (a Persian-only title still yields a slug)', () => {
    expect(slugify('شبکه سازمانی')).toBe('شبکه-سازمانی')
    expect(slugify('زیرساخت‌ ابری')).toBe('زیرساخت-ابری')   // ZWNJ → dash
  })

  it('slugFrom picks the first usable candidate', () => {
    expect(slugFrom('', null, 'My Title', 'other')).toBe('my-title')
    expect(slugFrom(undefined, '   ', 'خدمات')).toBe('خدمات')
    expect(slugFrom('', null, undefined)).toBe('')
  })

  it('ensureSlug derives a slug when the form left it blank', () => {
    expect(ensureSlug({ nameEn: 'Cisco Catalyst' }).slug).toBe('cisco-catalyst')
    expect(ensureSlug({ titleEn: 'Case Study One' }).slug).toBe('case-study-one')
    expect(ensureSlug({ nameFa: 'راهکار امنیت' }).slug).toBe('راهکار-امنیت')
  })

  it('never overwrites a slug the operator typed', () => {
    expect(ensureSlug({ slug: 'my-custom', nameEn: 'Something Else' }).slug).toBe('my-custom')
    expect(ensureSlug({ slug: '  Mixed Case  ', nameEn: 'X' }).slug).toBe('mixed-case')
  })

  it('always produces SOMETHING so a NOT NULL insert can never 500', () => {
    const s = ensureSlug({}, 'tech').slug as string
    expect(s.startsWith('tech-')).toBe(true)
    expect(s.length).toBeGreaterThan(5)
    // symbols-only title would slugify to empty → still gets a fallback
    const s2 = ensureSlug({ nameEn: '!!!' }, 'item').slug as string
    expect(s2.startsWith('item-')).toBe(true)
  })

  it('leaves the rest of the payload untouched', () => {
    const out = ensureSlug({ nameEn: 'A', active: true, sortOrder: 3 })
    expect(out.active).toBe(true)
    expect(out.sortOrder).toBe(3)
  })
})
