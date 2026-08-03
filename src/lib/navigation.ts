export interface NavItem {
  key: string
  labelFa: string
  labelEn: string
  href: string
  external?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'home',          labelFa: 'خانه',       labelEn: 'Home',         href: '/' },
  { key: 'about',         labelFa: 'درباره',     labelEn: 'About',        href: '/about' },
  { key: 'services',      labelFa: 'خدمات',      labelEn: 'Services',     href: '/services' },
  { key: 'case-studies',  labelFa: 'مطالعات موردی', labelEn: 'Case Studies', href: '/case-studies' },
  { key: 'blog',          labelFa: 'مرکز دانش',  labelEn: 'Knowledge Center', href: '/blog' },
  { key: 'ai',            labelFa: 'دستیار هوشمند', labelEn: 'AI Assistant', href: '/ai' },
  { key: 'consultation',  labelFa: 'مشاوره',     labelEn: 'Consultation', href: '/consultation' },
]

/* ── 26.31 — the DB-backed menu structure lives here because BOTH the server
   loader (publicNav.ts) and the client Header/Footer need it. Keeping it in a
   db-importing module pulled the `pg` driver into the client bundle. ── */

export interface NavNode extends NavItem {
  children: NavItem[]
}

export interface NavRow {
  id: number
  labelEn: string
  labelFa: string
  href: string
  location: string
  parentId: number | null
  sortOrder: number
}

/** The built-in structure — also the fallback and the seed source (بند ۲). */
export const DEFAULT_HEADER: NavNode[] = [
  { key: 'home', labelFa: 'خانه', labelEn: 'Home', href: '/', children: [] },
  { key: 'about', labelFa: 'درباره', labelEn: 'About', href: '/about', children: [] },
  {
    key: 'services', labelFa: 'خدمات', labelEn: 'Services', href: '/services',
    children: [
      { key: 'services-all', labelFa: 'خدمات', labelEn: 'Services', href: '/services' },
      { key: 'solutions', labelFa: 'راهکارها', labelEn: 'Solutions', href: '/solutions' },
      { key: 'industries', labelFa: 'صنایع', labelEn: 'Industries', href: '/industries' },
      { key: 'products', labelFa: 'محصولات', labelEn: 'Products', href: '/products' },
    ],
  },
  {
    key: 'work', labelFa: 'نمونه‌کارها', labelEn: 'Our Work', href: '/case-studies',
    children: [
      { key: 'case-studies', labelFa: 'مطالعات موردی', labelEn: 'Case Studies', href: '/case-studies' },
      { key: 'technologies', labelFa: 'فناوری‌ها', labelEn: 'Technologies', href: '/technologies' },
    ],
  },
  {
    key: 'knowledge', labelFa: 'دانش', labelEn: 'Knowledge', href: '/blog',
    children: [
      { key: 'blog', labelFa: 'مرکز دانش', labelEn: 'Knowledge Center', href: '/blog' },
      { key: 'docs', labelFa: 'مستندات', labelEn: 'Documentation', href: '/docs' },
      { key: 'academy', labelFa: 'آکادمی', labelEn: 'Academy', href: '/academy' },
      { key: 'events', labelFa: 'رویدادها', labelEn: 'Events', href: '/events' },
    ],
  },
  { key: 'ai', labelFa: 'دستیار هوشمند', labelEn: 'AI Assistant', href: '/ai', children: [] },
  { key: 'consultation', labelFa: 'مشاوره', labelEn: 'Consultation', href: '/consultation', children: [] },
]

/** Footer columns — every public page is reachable from here (بند ۳, SEO). */
export const DEFAULT_FOOTER: NavNode[] = [
  {
    key: 'f-services', labelFa: 'خدمات', labelEn: 'Services', href: '/services',
    children: [
      { key: 'f-services-all', labelFa: 'خدمات', labelEn: 'Services', href: '/services' },
      { key: 'f-solutions', labelFa: 'راهکارها', labelEn: 'Solutions', href: '/solutions' },
      { key: 'f-industries', labelFa: 'صنایع', labelEn: 'Industries', href: '/industries' },
      { key: 'f-products', labelFa: 'محصولات', labelEn: 'Products', href: '/products' },
    ],
  },
  {
    key: 'f-work', labelFa: 'نمونه‌کارها', labelEn: 'Our Work', href: '/case-studies',
    children: [
      { key: 'f-case-studies', labelFa: 'مطالعات موردی', labelEn: 'Case Studies', href: '/case-studies' },
      { key: 'f-projects', labelFa: 'پروژه‌ها', labelEn: 'Projects', href: '/projects' },
      { key: 'f-technologies', labelFa: 'فناوری‌ها', labelEn: 'Technologies', href: '/technologies' },
    ],
  },
  {
    key: 'f-knowledge', labelFa: 'دانش', labelEn: 'Knowledge', href: '/blog',
    children: [
      { key: 'f-blog', labelFa: 'مرکز دانش', labelEn: 'Knowledge Center', href: '/blog' },
      { key: 'f-docs', labelFa: 'مستندات', labelEn: 'Documentation', href: '/docs' },
      { key: 'f-academy', labelFa: 'آکادمی', labelEn: 'Academy', href: '/academy' },
      { key: 'f-events', labelFa: 'رویدادها', labelEn: 'Events', href: '/events' },
    ],
  },
  {
    key: 'f-company', labelFa: 'شرکت', labelEn: 'Company', href: '/about',
    children: [
      { key: 'f-about', labelFa: 'درباره', labelEn: 'About', href: '/about' },
      { key: 'f-ai', labelFa: 'دستیار هوشمند', labelEn: 'AI Assistant', href: '/ai' },
      { key: 'f-search', labelFa: 'جستجو', labelEn: 'Search', href: '/search' },
      { key: 'f-consultation', labelFa: 'مشاوره', labelEn: 'Consultation', href: '/consultation' },
    ],
  },
]

/**
 * Pure: rows → a two-level menu. Exported for unit tests.
 * Only `active` rows should ever be passed in (the query filters them).
 */
export function buildNavTree(rows: NavRow[], fallback: NavNode[]): NavNode[] {
  if (!rows || rows.length === 0) return fallback
  const byId = new Map(rows.map(r => [r.id, r]))
  const roots = rows.filter(r => r.parentId == null || !byId.has(r.parentId))
  const toItem = (r: NavRow): NavItem => ({
    key: `db-${r.id}`, labelFa: r.labelFa, labelEn: r.labelEn, href: r.href,
  })
  const sorted = <T extends { sortOrder: number; id: number }>(a: T[]) =>
    [...a].sort((x, y) => x.sortOrder - y.sortOrder || x.id - y.id)
  return sorted(roots).map(r => ({
    ...toItem(r),
    children: sorted(rows.filter(c => c.parentId === r.id)).map(toItem),
  }))
}

