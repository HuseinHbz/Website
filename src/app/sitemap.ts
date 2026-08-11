import { MetadataRoute } from 'next'
import { SITE } from '@/lib/site'
import { PUBLIC_ROUTES } from '@/lib/publicRoutes'
import { getDb } from '@/lib/db/index'
import { solutions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getPublicBlogPosts, getPublicProjects } from '@/lib/publicData'

type Frequency = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'

interface SitemapEntry {
  url: string
  lastModified: Date
  changeFrequency: Frequency
  priority: number
  alternates?: { languages: Record<string, string> }
}

const locales = ['fa', 'en'] as const

function buildUrl(path: string, locale: string) {
  return `${SITE.url}/${locale}${path === '/' ? '' : path}`
}

// 26.33 — the route list moved to `@/lib/publicRoutes` so the Menu Builder can
// validate against the SAME list instead of a second copy that drifts (BUG-203).
const staticRoutes: Array<{ path: string; changeFrequency: Frequency; priority: number }> =
  PUBLIC_ROUTES.map(r => ({ path: r.path, changeFrequency: r.changeFrequency, priority: r.priority }))
async function getDynamicSlugs(): Promise<string[]> {
  try {
    const db = getDb()
    return (await db.select({ slug: solutions.slug }).from(solutions)
      .where(eq(solutions.active, true)))
      .map(r => r.slug)
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: SitemapEntry[] = []

  for (const route of staticRoutes) {
    const languages: Record<string, string> = {}
    for (const locale of locales) languages[locale] = buildUrl(route.path, locale)

    for (const locale of locales) {
      entries.push({
        url: buildUrl(route.path, locale),
        lastModified: new Date(),
        changeFrequency: route.changeFrequency,
        priority: locale === SITE.locale.default ? route.priority : route.priority * 0.9,
        alternates: { languages },
      })
    }
  }

  // Dynamic solution pages
  const slugs = await getDynamicSlugs()
  for (const slug of slugs) {
    const languages: Record<string, string> = {}
    for (const locale of locales) languages[locale] = buildUrl(`/solutions/${slug}`, locale)

    for (const locale of locales) {
      entries.push({
        url: buildUrl(`/solutions/${slug}`, locale),
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: locale === SITE.locale.default ? 0.7 : 0.6,
        alternates: { languages },
      })
    }
  }

  // Blog posts and case studies — the site's two other dynamic-slug content
  // types (each already has its own generateMetadata/canonical, per-post
  // JSON-LD for blog) were missing from the sitemap entirely: search engines
  // had no authoritative discovery signal for a single published article or
  // case study, only whatever internal links happened to reach them.
  addDynamicGroup(entries, '/blog', (await getPublicBlogPosts()).map(p => p.slug), 0.65, 'weekly')
  addDynamicGroup(entries, '/case-studies', (await getPublicProjects() ?? []).map(p => p.slug), 0.7, 'monthly')

  return entries
}

function addDynamicGroup(entries: SitemapEntry[], basePath: string, slugs: string[], basePriority: number, changeFrequency: Frequency) {
  for (const slug of slugs) {
    const path = `${basePath}/${slug}`
    const languages: Record<string, string> = {}
    for (const locale of locales) languages[locale] = buildUrl(path, locale)

    for (const locale of locales) {
      entries.push({
        url: buildUrl(path, locale),
        lastModified: new Date(),
        changeFrequency,
        priority: locale === SITE.locale.default ? basePriority : basePriority * 0.9,
        alternates: { languages },
      })
    }
  }
}
