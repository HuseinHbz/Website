/**
 * Catalog of the Hero's layout variants (`Hero.tsx`'s VARIANTS map — split,
 * minimal, glass, terminal, ...). These 20 layouts already existed in code
 * (selected via the `hero_variant` site_settings key, read in page.tsx) but
 * had no admin UI to pick one — this is that catalog, consumed by the new
 * "Layout" tab in `/admin/hero` (HeroCenter).
 */
export interface HeroLayout {
  id: string
  nameEn: string
  nameFa: string
}

export const HERO_LAYOUTS: HeroLayout[] = [
  { id: 'split',     nameEn: 'Split (text + orbit network)', nameFa: 'دوستونه (متن + شبکه مداری)' },
  { id: 'minimal',   nameEn: 'Minimal Bold',                 nameFa: 'مینیمال پررنگ' },
  { id: 'glass',     nameEn: 'Glassmorphism Card',           nameFa: 'کارت شیشه‌ای' },
  { id: 'terminal',  nameEn: 'Terminal',                     nameFa: 'ترمینال' },
  { id: 'bento',     nameEn: 'Bento Grid',                   nameFa: 'شبکه بنتو' },
  { id: 'luxury',    nameEn: 'Dark Luxury',                  nameFa: 'لوکس تیره' },
  { id: 'neon',      nameEn: 'Neon Circuit',                 nameFa: 'مدار نئون' },
  { id: 'magazine',  nameEn: 'Magazine / Editorial',         nameFa: 'مجله‌ای' },
  { id: 'centered',  nameEn: 'Centered Full',                nameFa: 'مرکزچین کامل' },
  { id: 'gradient',  nameEn: 'Gradient Mesh',                nameFa: 'شبکه گرادیانی' },
  { id: 'timeline',  nameEn: 'Career Timeline',               nameFa: 'خط زمانی حرفه‌ای' },
  { id: 'diagonal',  nameEn: 'Diagonal Split',                nameFa: 'دوستونه مورب' },
  { id: 'code',      nameEn: 'Code Block',                    nameFa: 'بلوک کد' },
  { id: 'portrait',  nameEn: 'Portrait Card',                 nameFa: 'کارت پرتره' },
  { id: 'metric',    nameEn: 'Big Metric',                    nameFa: 'اعداد بزرگ' },
  { id: 'wave',      nameEn: 'Dark Wave',                     nameFa: 'موج تیره' },
  { id: 'sidebar',   nameEn: 'Sidebar Nav',                   nameFa: 'نوار کناری' },
  { id: 'holo',      nameEn: 'Holographic',                   nameFa: 'هولوگرافیک' },
  { id: 'newspaper', nameEn: 'Dark Newspaper',                nameFa: 'روزنامه‌ای تیره' },
  { id: 'cyber',     nameEn: 'Cyber Grid',                    nameFa: 'شبکه سایبری' },
]

export const DEFAULT_HERO_LAYOUT = 'split'

export function heroLayoutById(id: string | null | undefined): HeroLayout | null {
  if (!id) return null
  return HERO_LAYOUTS.find(l => l.id === id) ?? null
}
