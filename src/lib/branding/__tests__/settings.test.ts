import { describe, it, expect } from 'vitest'
import { resolvePageTitle, resolveTitleTemplate, versionedLogoUrl, DEFAULT_BRAND, type BrandSettings } from '../settings'

function brand(overrides: Partial<BrandSettings> = {}): BrandSettings {
  return { ...DEFAULT_BRAND, ...overrides }
}

describe('resolvePageTitle', () => {
  it('substitutes {{pageTitle}} and {{brandName}} for the given locale', () => {
    const b = brand({
      pageTitleTemplateEn: '{{pageTitle}} | {{brandName}}',
      brandNameEn: 'Husein Habibazar',
    })
    expect(resolvePageTitle('Services', b, 'en')).toBe('Services | Husein Habibazar')
  })
  it('uses the fa fields when locale is fa', () => {
    const b = brand({
      pageTitleTemplateFa: '{{pageTitle}} — {{brandName}}',
      brandNameFa: 'حسین حبیب‌آذر',
    })
    expect(resolvePageTitle('خدمات', b, 'fa')).toBe('خدمات — حسین حبیب‌آذر')
  })
  it('the default template reproduces the exact pre-existing "%s | HBZ" output', () => {
    const b = DEFAULT_BRAND
    expect(resolvePageTitle('Services', b, 'en')).toBe('Services | HBZ')
    expect(resolvePageTitle('خدمات', b, 'fa')).toBe('خدمات | HBZ')
  })
})

describe('resolveTitleTemplate', () => {
  it('turns {{pageTitle}} into the Next.js %s placeholder', () => {
    const b = brand({ pageTitleTemplateEn: '{{pageTitle}} | {{brandName}}', brandNameEn: 'HBZ Technology' })
    expect(resolveTitleTemplate(b, 'en')).toBe('%s | HBZ Technology')
  })
  it('default template produces "%s | HBZ" — identical to the previous hardcoded template', () => {
    expect(resolveTitleTemplate(DEFAULT_BRAND, 'en')).toBe('%s | HBZ')
    expect(resolveTitleTemplate(DEFAULT_BRAND, 'fa')).toBe('%s | HBZ')
  })
})

describe('versionedLogoUrl', () => {
  it('returns null when no custom logo is set (falls back to default favicon/badge)', () => {
    expect(versionedLogoUrl(brand({ logoUrl: '' }))).toBeNull()
  })
  it('appends a cache-busting ?v= query when a logo is set', () => {
    const url = versionedLogoUrl(brand({ logoUrl: '/uploads/branding/logo-abc.png', logoVersion: '12345' }))
    expect(url).toBe('/uploads/branding/logo-abc.png?v=12345')
  })
  it('uses & instead of ? if the logo URL already carries a query string', () => {
    const url = versionedLogoUrl(brand({ logoUrl: '/uploads/branding/logo.png?x=1', logoVersion: '9' }))
    expect(url).toBe('/uploads/branding/logo.png?x=1&v=9')
  })
})

describe('DEFAULT_BRAND', () => {
  it('matches the exact pre-existing hardcoded identity (no visible change before a first edit)', () => {
    expect(DEFAULT_BRAND.brandNameFa).toBe('حسین حبیب‌آذر')
    expect(DEFAULT_BRAND.brandNameEn).toBe('Husein Habibazar')
    expect(DEFAULT_BRAND.brandSubtitleFa).toBe('معمار زیرساخت')
    expect(DEFAULT_BRAND.brandSubtitleEn).toBe('Infrastructure Architect')
    expect(DEFAULT_BRAND.logoUrl).toBe('')
  })
})
