/**
 * 26.33 BUG-203 root fix — the single list of real public routes.
 *
 * The Menu Builder took `href` as free text with no validation, so an operator
 * could save a link to a page that does not exist and only discover it as a 404
 * on the live site — a silent failure, and the same shape as 26.31's orphan
 * Menu Builder (build something in the admin, nothing honours it).
 *
 * The canonical list already existed in `sitemap.ts`; duplicating it here would
 * just create a second thing to forget. So the list lives here and `sitemap.ts`
 * imports it — one source of truth, which is also what makes the 26.31 rule
 * ("every public page reachable from menu or footer") checkable.
 *
 * Client-safe: no database import, so the Menu Builder can use it directly.
 */

export type Frequency = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'

export interface PublicRoute {
  path: string
  labelEn: string
  labelFa: string
  changeFrequency: Frequency
  priority: number
}

/** Every statically-routed public page. Adding a page means adding it here. */
export const PUBLIC_ROUTES: PublicRoute[] = [
  { path: '/', labelEn: 'Home', labelFa: 'خانه', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/about', labelEn: 'About', labelFa: 'دربارهٔ ما', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/solutions', labelEn: 'Solutions', labelFa: 'راهکارها', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/technologies', labelEn: 'Technologies', labelFa: 'فناوری‌ها', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/industries', labelEn: 'Industries', labelFa: 'صنایع', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/case-studies', labelEn: 'Case Studies', labelFa: 'مطالعات موردی', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/blog', labelEn: 'Knowledge Center', labelFa: 'مرکز دانش', changeFrequency: 'daily', priority: 0.8 },
  { path: '/products', labelEn: 'Products', labelFa: 'محصولات', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/services', labelEn: 'Services', labelFa: 'خدمات', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/projects', labelEn: 'Projects', labelFa: 'پروژه‌ها', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/consultation', labelEn: 'Consultation', labelFa: 'مشاوره', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/consultation/intro-call', labelEn: 'Intro call', labelFa: 'جلسهٔ آشنایی', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/search', labelEn: 'Search', labelFa: 'جستجو', changeFrequency: 'weekly', priority: 0.5 },
  { path: '/docs', labelEn: 'Documentation', labelFa: 'مستندات', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/academy', labelEn: 'Academy', labelFa: 'آموزش', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/events', labelEn: 'Events', labelFa: 'رویدادها', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/ai', labelEn: 'AI Assistant', labelFa: 'دستیار هوشمند', changeFrequency: 'monthly', priority: 0.6 },
]

/** True for an absolute external link — always allowed, but marked as external. */
export function isExternalHref(href: string): boolean {
  return /^(https?:)?\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('tel:')
}

/**
 * Is this internal href a page that actually exists?
 *
 * `dynamicSlugs` carries the DB-backed detail routes (`/blog/<slug>`,
 * `/solutions/<slug>`, custom pages), which the caller supplies because only
 * the server can know them. Pure, so the rule is unit-testable.
 */
export function isKnownRoute(href: string, dynamicPaths: Iterable<string> = []): boolean {
  if (!href) return false
  if (isExternalHref(href)) return true
  if (!href.startsWith('/')) return false
  const path = href.split(/[?#]/)[0].replace(/\/+$/, '') || '/'
  if (PUBLIC_ROUTES.some(r => r.path === path)) return true
  for (const d of dynamicPaths) {
    if ((d.startsWith('/') ? d : `/${d}`).replace(/\/+$/, '') === path) return true
  }
  return false
}

/** Human explanation for a rejected href, in the operator's language. */
export function unknownRouteMessage(href: string, fa: boolean): string {
  return fa
    ? `صفحه‌ای با نشانی «${href}» وجود ندارد. یک صفحهٔ موجود انتخاب کنید یا اول آن صفحه را بسازید.`
    : `No page exists at “${href}”. Pick an existing page, or create that page first.`
}
