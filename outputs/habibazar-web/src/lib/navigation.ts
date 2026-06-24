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
  { key: 'projects',      labelFa: 'پروژه‌ها',   labelEn: 'Projects',     href: '/projects' },
  { key: 'blog',          labelFa: 'بلاگ',       labelEn: 'Blog',         href: '/blog' },
  { key: 'consultation',  labelFa: 'مشاوره',     labelEn: 'Consultation', href: '/consultation' },
]
