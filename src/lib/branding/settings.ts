/**
 * Brand & Identity settings — the central, server-only source of truth for
 * every piece of site identity that used to be a hardcoded literal ("HBZ",
 * "حسین حبیب‌آذر", "معمار زیرساخت", the browser tab title, the favicon).
 *
 * Reuses the project's existing `site_settings` key/value table (no parallel
 * "branding" table) — same pattern as every other settings-backed feature
 * (hero_variant, logo_text, ai_provider, …). `DEFAULT_BRAND` is the exact
 * current hardcoded content (`src/lib/site.ts` + the literals that used to
 * live in Header.tsx/Footer.tsx/[locale]/layout.tsx), so an empty/missing
 * key never changes what a visitor sees — only an explicit admin edit does.
 *
 * `getBrandSettings()` is wrapped in React's `cache()`: within a single
 * request/render pass every caller (root layout metadata, Header, Footer,
 * JSON-LD, …) shares ONE query instead of one each.
 */
import { cache } from 'react'
import { eq, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { siteSettings } from '@/lib/db/schema'
import { SITE } from '@/lib/site'

export interface BrandSettings {
  brandNameFa: string
  brandNameEn: string
  brandSubtitleFa: string
  brandSubtitleEn: string
  homepageTitleFa: string
  homepageTitleEn: string
  /** `{{pageTitle}}` / `{{brandName}}` tokens — resolved by `resolvePageTitle()`. */
  pageTitleTemplateFa: string
  pageTitleTemplateEn: string
  logoUrl: string
  logoAltFa: string
  logoAltEn: string
  /** epoch ms of the last logo change — cache-busting query string, never a build/restart. */
  logoVersion: string
}

/** The exact pre-existing hardcoded identity (`lib/site.ts` + Header/Footer/[locale]/layout.tsx
 *  literals) — the safe fallback for every field, and the seed the admin form starts from. */
export const DEFAULT_BRAND: BrandSettings = {
  brandNameFa: SITE.nameFa,
  brandNameEn: SITE.nameFull,
  brandSubtitleFa: 'معمار زیرساخت',
  brandSubtitleEn: 'Infrastructure Architect',
  homepageTitleFa: 'حسین حبیب‌آذر (HBZ) — معمار زیرساخت و مشاور امنیت شبکه',
  homepageTitleEn: 'Husein Habibazar (HBZ) — Infrastructure Architect & Network Security Consultant',
  // Baked-in "HBZ" suffix (not the {{brandName}} token) so the DEFAULT template
  // reproduces today's exact output (`%s | HBZ`, [locale]/layout.tsx) byte for
  // byte. {{brandName}} is still fully supported the moment an admin types it
  // into a custom template — it resolves to brandNameFa/brandNameEn below.
  pageTitleTemplateFa: '{{pageTitle}} | HBZ',
  pageTitleTemplateEn: '{{pageTitle}} | HBZ',
  logoUrl: '',
  logoAltFa: 'لوگوی HBZ',
  logoAltEn: 'HBZ logo',
  logoVersion: '0',
}

/** site_settings key ↔ BrandSettings field. The ONE place this mapping lives. */
const KEY_MAP: Record<keyof BrandSettings, string> = {
  brandNameFa: 'brand_name_fa',
  brandNameEn: 'brand_name_en',
  brandSubtitleFa: 'brand_subtitle_fa',
  brandSubtitleEn: 'brand_subtitle_en',
  homepageTitleFa: 'homepage_title_fa',
  homepageTitleEn: 'homepage_title_en',
  pageTitleTemplateFa: 'page_title_template_fa',
  pageTitleTemplateEn: 'page_title_template_en',
  // `logo_url` already existed as a dead (never-read) site_settings key
  // (seed.ts) — reused rather than duplicated.
  logoUrl: 'logo_url',
  logoAltFa: 'logo_alt_fa',
  logoAltEn: 'logo_alt_en',
  logoVersion: 'logo_version',
}

export const BRAND_SETTING_KEYS = Object.values(KEY_MAP)

/** Server-only, request-memoized read of every brand field, defaults filled in. */
export const getBrandSettings = cache(async (): Promise<BrandSettings> => {
  try {
    const db = getDb()
    const rows = await db.select().from(siteSettings).where(inArray(siteSettings.key, BRAND_SETTING_KEYS))
    const byKey = new Map(rows.map(r => [r.key, r.value ?? '']))
    const out = { ...DEFAULT_BRAND }
    for (const field of Object.keys(KEY_MAP) as (keyof BrandSettings)[]) {
      const v = byKey.get(KEY_MAP[field])
      if (v) out[field] = v
    }
    return out
  } catch {
    // R4 — the site never renders without an identity, even if the DB is down.
    return DEFAULT_BRAND
  }
})

/** Resolve `{{pageTitle}}`/`{{brandName}}` into the Next.js `title.template`
 *  grammar (`%s`) + the actually-substituted string, for a given page title. */
export function resolvePageTitle(pageTitle: string, brand: BrandSettings, locale: string): string {
  const isFa = locale === 'fa'
  const template = isFa ? brand.pageTitleTemplateFa : brand.pageTitleTemplateEn
  const brandName = isFa ? brand.brandNameFa : brand.brandNameEn
  return template.replace('{{pageTitle}}', pageTitle).replace('{{brandName}}', brandName)
}

/** Same substitution, but leaves `%s` for Next's own template engine to fill —
 *  used for the ROOT `metadata.title.template` (child pages just return a
 *  short string and Next composes it). */
export function resolveTitleTemplate(brand: BrandSettings, locale: string): string {
  const isFa = locale === 'fa'
  const template = isFa ? brand.pageTitleTemplateFa : brand.pageTitleTemplateEn
  const brandName = isFa ? brand.brandNameFa : brand.brandNameEn
  return template.replace('{{pageTitle}}', '%s').replace('{{brandName}}', brandName)
}

/** `logoUrl` with a cache-busting query string so a browser/CDN never keeps
 *  serving a stale favicon/logo after a replace — no rebuild/restart needed. */
export function versionedLogoUrl(brand: BrandSettings): string | null {
  if (!brand.logoUrl) return null
  const sep = brand.logoUrl.includes('?') ? '&' : '?'
  return `${brand.logoUrl}${sep}v=${brand.logoVersion}`
}

export async function writeBrandSettings(patch: Partial<Record<keyof BrandSettings, string>>, updatedBy: string | null) {
  const db = getDb()
  for (const field of Object.keys(patch) as (keyof BrandSettings)[]) {
    const key = KEY_MAP[field]
    const value = patch[field] ?? ''
    const existing = (await db.select().from(siteSettings).where(eq(siteSettings.key, key)))[0]
    if (existing) {
      await db.update(siteSettings).set({ value, group: 'branding', updatedAt: new Date().toISOString(), updatedBy: updatedBy ?? undefined }).where(eq(siteSettings.key, key))
    } else {
      await db.insert(siteSettings).values({ key, value, group: 'branding', updatedBy: updatedBy ?? undefined })
    }
  }
}
