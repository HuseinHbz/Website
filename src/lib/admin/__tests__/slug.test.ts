import { describe, it, expect } from 'vitest'
import { slugify, slugFrom, ensureSlug, nextFreeSlug, slugWasDerived } from '../slug'

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

/**
 * 26.32 — the module audit hit `Duplicate slug` on nine modules whose form has
 * no slug field, so the operator was told to fix an invisible value. A DERIVED
 * slug is disambiguated; an operator-typed slug still collides loudly.
 */
describe('nextFreeSlug / slugWasDerived (26.32)', () => {
  it('returns the base when it is free', () => {
    expect(nextFreeSlug('guide', [])).toBe('guide')
  })
  it('suffixes past a collision', () => {
    expect(nextFreeSlug('guide', ['guide'])).toBe('guide-2')
  })
  it('keeps counting past a run of taken variants', () => {
    expect(nextFreeSlug('guide', ['guide', 'guide-2', 'guide-3'])).toBe('guide-4')
  })
  it('is unaffected by unrelated slugs', () => {
    expect(nextFreeSlug('guide', ['other', 'guidebook'])).toBe('guide')
  })
  it('knows an operator-typed slug from a derived one', () => {
    expect(slugWasDerived({ titleEn: 'X' })).toBe(true)
    expect(slugWasDerived({ slug: 'my-choice' })).toBe(false)
    expect(slugWasDerived({ slug: '   ' })).toBe(true)
  })
})
