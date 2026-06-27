import { MetadataRoute } from 'next'
import { SITE } from '@/lib/site'

type Frequency =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never'

interface SitemapEntry {
  url: string
  lastModified: Date
  changeFrequency: Frequency
  priority: number
  alternates?: {
    languages: Record<string, string>
  }
}

const locales = ['fa', 'en'] as const

function buildUrl(path: string, locale: string) {
  return `${SITE.url}/${locale}${path === '/' ? '' : path}`
}

const routes: Array<{
  path: string
  changeFrequency: Frequency
  priority: number
}> = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/consultation', changeFrequency: 'monthly', priority: 0.8 },
  {
    path: '/consultation/intro-call',
    changeFrequency: 'monthly',
    priority: 0.7,
  },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: SitemapEntry[] = []

  for (const route of routes) {
    const languages: Record<string, string> = {}
    for (const locale of locales) {
      languages[locale] = buildUrl(route.path, locale)
    }

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

  return entries
}
