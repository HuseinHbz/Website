import { MetadataRoute } from 'next'
import { SITE } from '@/lib/site'
import { getDb } from '@/lib/db/index'
import { solutions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

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

const staticRoutes: Array<{ path: string; changeFrequency: Frequency; priority: number }> = [
  { path: '/',                    changeFrequency: 'weekly',  priority: 1.0 },
  { path: '/about',               changeFrequency: 'monthly', priority: 0.8 },
  { path: '/solutions',           changeFrequency: 'weekly',  priority: 0.9 },
  { path: '/technologies',        changeFrequency: 'monthly', priority: 0.7 },
  { path: '/industries',          changeFrequency: 'monthly', priority: 0.7 },
  { path: '/case-studies',        changeFrequency: 'weekly',  priority: 0.9 },
  { path: '/blog',                changeFrequency: 'daily',   priority: 0.8 },
  { path: '/products',            changeFrequency: 'monthly', priority: 0.7 },
  { path: '/services',            changeFrequency: 'monthly', priority: 0.7 },
  { path: '/projects',            changeFrequency: 'monthly', priority: 0.7 },
  { path: '/consultation',        changeFrequency: 'monthly', priority: 0.8 },
  { path: '/consultation/intro-call', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/search',              changeFrequency: 'weekly',  priority: 0.5 },
]

function getDynamicSlugs(): string[] {
  try {
    const db = getDb()
    return db.select({ slug: solutions.slug }).from(solutions)
      .where(eq(solutions.active, true)).all()
      .map(r => r.slug)
  } catch {
    return []
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
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
  const slugs = getDynamicSlugs()
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

  return entries
}
