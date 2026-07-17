/**
 * Hero Template Registry (Phase 23).
 *
 * The single source of truth for the 30+ hero templates. Each template declares
 * its category, supported builder blocks, layout, and validation constraints
 * (used by the rule engine before publishing). The 20 legacy `Hero.tsx` variants
 * are registered here (compatibility preserved) plus 10 new premium templates.
 * Pure data + helpers → unit-tested.
 */
import type { HeroBlockType, HeroConfig } from './types'

export interface HeroTemplate {
  id: string
  nameEn: string
  nameFa: string
  category: 'corporate' | 'technology' | 'security' | 'cloud' | 'ai' | 'consulting' | 'portfolio' | 'media' | 'product' | 'classic'
  /** True for the 10 new premium templates added in Phase 23. */
  premium?: boolean
  /** Builder blocks this template can host. */
  blocks: HeroBlockType[]
  /** Validation constraints enforced by the rule engine. */
  constraints: {
    maxTitle: number
    maxSubtitle: number
    maxButtons: number
    maxCtaLen: number
    minFontSize: number
    maxFontSize: number
  }
  /** Background kinds this template supports. */
  backgrounds: ('solid' | 'gradient' | 'image' | 'video' | 'animation' | 'canvas')[]
}

const DEFAULT_CONSTRAINTS: HeroTemplate['constraints'] = {
  maxTitle: 80, maxSubtitle: 200, maxButtons: 3, maxCtaLen: 32, minFontSize: 24, maxFontSize: 96,
}
const COMMON_BLOCKS: HeroBlockType[] = ['text', 'button', 'stats', 'image', 'background', 'icon']

const legacy = (id: string, nameEn: string, nameFa: string, category: HeroTemplate['category']): HeroTemplate => ({
  id, nameEn, nameFa, category, blocks: COMMON_BLOCKS,
  constraints: { ...DEFAULT_CONSTRAINTS }, backgrounds: ['solid', 'gradient', 'image', 'animation'],
})

/** The 20 legacy `Hero.tsx` variants — kept for full backward compatibility. */
export const LEGACY_TEMPLATES: HeroTemplate[] = [
  legacy('split', 'Split', 'تقسیم‌شده', 'corporate'),
  legacy('minimal', 'Minimal Bold', 'مینیمال بولد', 'portfolio'),
  legacy('glass', 'Glassmorphism', 'شیشه‌ای', 'technology'),
  legacy('terminal', 'Terminal', 'ترمینال', 'technology'),
  legacy('bento', 'Bento Grid', 'بنتو گرید', 'product'),
  legacy('luxury', 'Dark Luxury', 'لوکس سینمایی', 'corporate'),
  legacy('neon', 'Neon Circuit', 'نئون', 'technology'),
  legacy('magazine', 'Magazine', 'مجله‌ای', 'media'),
  legacy('centered', 'Centered', 'مرکزی کلاسیک', 'classic'),
  legacy('gradient', 'Gradient Mesh', 'گرادیان مش', 'technology'),
  legacy('timeline', 'Timeline', 'تایم‌لاین', 'corporate'),
  legacy('diagonal', 'Diagonal', 'مورب', 'product'),
  legacy('code', 'Code Block', 'کد', 'technology'),
  legacy('portrait', 'Portrait', 'پرتره', 'portfolio'),
  legacy('metric', 'Big Metric', 'متریک', 'corporate'),
  legacy('wave', 'Wave', 'موج', 'media'),
  legacy('sidebar', 'Sidebar', 'سایدبار', 'classic'),
  legacy('holo', 'Holographic', 'هولوگرافیک', 'technology'),
  legacy('newspaper', 'Newspaper', 'روزنامه', 'media'),
  legacy('cyber', 'Cyber Grid', 'سایبر گرید', 'security'),
]

/** 10 new premium templates. */
export const PREMIUM_TEMPLATES: HeroTemplate[] = [
  {
    id: 'executive', nameEn: 'Executive Corporate', nameFa: 'اجرایی سازمانی', category: 'corporate', premium: true,
    blocks: [...COMMON_BLOCKS, 'logos', 'testimonials'],
    constraints: { maxTitle: 70, maxSubtitle: 180, maxButtons: 2, maxCtaLen: 28, minFontSize: 32, maxFontSize: 88 },
    backgrounds: ['solid', 'gradient', 'image'],
  },
  {
    id: 'tech-enterprise', nameEn: 'Technology Enterprise', nameFa: 'فناوری سازمانی', category: 'technology', premium: true,
    blocks: [...COMMON_BLOCKS, 'technologies', 'features', 'particles'],
    constraints: { ...DEFAULT_CONSTRAINTS }, backgrounds: ['gradient', 'animation', 'canvas'],
  },
  {
    id: 'ai-platform', nameEn: 'AI Platform', nameFa: 'پلتفرم هوش مصنوعی', category: 'ai', premium: true,
    blocks: [...COMMON_BLOCKS, 'features', 'particles', 'card'],
    constraints: { ...DEFAULT_CONSTRAINTS, maxTitle: 72 }, backgrounds: ['gradient', 'animation', 'canvas', 'video'],
  },
  {
    id: 'cyber-security', nameEn: 'Cyber Security', nameFa: 'امنیت سایبری', category: 'security', premium: true,
    blocks: [...COMMON_BLOCKS, 'features', 'particles'],
    constraints: { ...DEFAULT_CONSTRAINTS }, backgrounds: ['animation', 'canvas', 'gradient'],
  },
  {
    id: 'cloud-infra', nameEn: 'Cloud Infrastructure', nameFa: 'زیرساخت ابری', category: 'cloud', premium: true,
    blocks: [...COMMON_BLOCKS, 'technologies', 'logos'],
    constraints: { ...DEFAULT_CONSTRAINTS }, backgrounds: ['gradient', 'animation', 'image'],
  },
  {
    id: 'consulting', nameEn: 'Consulting', nameFa: 'مشاوره', category: 'consulting', premium: true,
    blocks: [...COMMON_BLOCKS, 'testimonials', 'timeline'],
    constraints: { maxTitle: 70, maxSubtitle: 200, maxButtons: 2, maxCtaLen: 30, minFontSize: 30, maxFontSize: 84 },
    backgrounds: ['solid', 'image', 'gradient'],
  },
  {
    id: 'portfolio-minimal', nameEn: 'Minimal Portfolio', nameFa: 'نمونه‌کار مینیمال', category: 'portfolio', premium: true,
    blocks: ['text', 'button', 'image', 'icon', 'background'],
    constraints: { maxTitle: 60, maxSubtitle: 160, maxButtons: 2, maxCtaLen: 24, minFontSize: 36, maxFontSize: 120 },
    backgrounds: ['solid', 'gradient'],
  },
  {
    id: 'video-fullscreen', nameEn: 'Fullscreen Video', nameFa: 'ویدیو تمام‌صفحه', category: 'media', premium: true,
    blocks: ['text', 'button', 'video', 'background'],
    constraints: { ...DEFAULT_CONSTRAINTS, maxButtons: 2 }, backgrounds: ['video', 'image'],
  },
  {
    id: 'split-screen', nameEn: 'Split Screen', nameFa: 'صفحه دوتکه', category: 'product', premium: true,
    blocks: [...COMMON_BLOCKS, 'features', 'card'],
    constraints: { ...DEFAULT_CONSTRAINTS }, backgrounds: ['solid', 'gradient', 'image'],
  },
  {
    id: 'product-showcase', nameEn: 'Product Showcase', nameFa: 'نمایش محصول', category: 'product', premium: true,
    blocks: [...COMMON_BLOCKS, 'pricing', 'features', 'card'],
    constraints: { ...DEFAULT_CONSTRAINTS }, backgrounds: ['gradient', 'image', 'animation'],
  },
]

/** 20 further premium templates (Phase 25) — one per enterprise vertical.
 * `category` maps onto an existing layout family (it only drives public layout). */
const prem = (id: string, nameEn: string, nameFa: string, category: HeroTemplate['category'], backgrounds: HeroTemplate['backgrounds'], blocks: HeroBlockType[] = COMMON_BLOCKS): HeroTemplate =>
  ({ id, nameEn, nameFa, category, premium: true, blocks, constraints: { ...DEFAULT_CONSTRAINTS }, backgrounds })

export const PREMIUM_TEMPLATES_V2: HeroTemplate[] = [
  prem('devops-pipeline', 'DevOps Pipeline', 'خط لوله DevOps', 'technology', ['gradient', 'animation', 'canvas'], [...COMMON_BLOCKS, 'technologies', 'features']),
  prem('networking-grid', 'Networking Grid', 'شبکه‌بندی', 'cloud', ['animation', 'canvas', 'gradient'], [...COMMON_BLOCKS, 'technologies']),
  prem('infrastructure-core', 'Infrastructure Core', 'هستهٔ زیرساخت', 'cloud', ['gradient', 'image', 'animation'], [...COMMON_BLOCKS, 'stats', 'logos']),
  prem('modern-startup', 'Modern Startup', 'استارتاپ مدرن', 'product', ['gradient', 'animation'], [...COMMON_BLOCKS, 'features', 'card']),
  prem('enterprise-suite', 'Enterprise Suite', 'مجموعهٔ سازمانی', 'corporate', ['solid', 'gradient', 'image'], [...COMMON_BLOCKS, 'logos', 'testimonials']),
  prem('creative-agency', 'Creative Agency', 'آژانس خلاق', 'media', ['gradient', 'image', 'video'], [...COMMON_BLOCKS, 'card', 'logos']),
  prem('minimal-mono', 'Minimal Mono', 'مینیمال تک‌رنگ', 'portfolio', ['solid', 'gradient'], ['text', 'button', 'image', 'icon', 'background']),
  prem('dark-executive', 'Dark Executive', 'اجرایی تیره', 'corporate', ['solid', 'gradient', 'image'], [...COMMON_BLOCKS, 'stats']),
  prem('light-editorial', 'Light Editorial', 'روشن مطبوعاتی', 'media', ['solid', 'gradient', 'image'], [...COMMON_BLOCKS, 'card']),
  prem('healthcare-trust', 'Healthcare Trust', 'سلامت مطمئن', 'corporate', ['solid', 'gradient', 'image'], [...COMMON_BLOCKS, 'features', 'stats']),
  prem('education-campus', 'Education Campus', 'کمپ آموزشی', 'corporate', ['gradient', 'image'], [...COMMON_BLOCKS, 'features', 'stats']),
  prem('industrial-heavy', 'Industrial', 'صنعتی', 'product', ['image', 'gradient', 'solid'], [...COMMON_BLOCKS, 'stats']),
  prem('construction-build', 'Construction', 'ساخت‌وساز', 'product', ['image', 'gradient'], [...COMMON_BLOCKS, 'stats']),
  prem('government-civic', 'Government', 'دولتی', 'corporate', ['solid', 'gradient', 'image'], [...COMMON_BLOCKS, 'features']),
  prem('finance-markets', 'Finance & Markets', 'مالی و بازار', 'corporate', ['gradient', 'animation', 'solid'], [...COMMON_BLOCKS, 'stats', 'features']),
  prem('insurance-shield', 'Insurance', 'بیمه', 'corporate', ['solid', 'gradient', 'image'], [...COMMON_BLOCKS, 'features']),
  prem('retail-commerce', 'Retail Commerce', 'خرده‌فروشی', 'product', ['gradient', 'image', 'animation'], [...COMMON_BLOCKS, 'pricing', 'card']),
  prem('manufacturing-line', 'Manufacturing', 'تولید', 'product', ['image', 'gradient'], [...COMMON_BLOCKS, 'stats', 'technologies']),
  prem('energy-power', 'Energy & Power', 'انرژی', 'cloud', ['gradient', 'animation', 'image'], [...COMMON_BLOCKS, 'stats']),
  prem('saas-hybrid', 'SaaS Hybrid', 'سس هیبرید', 'product', ['gradient', 'animation', 'canvas'], [...COMMON_BLOCKS, 'pricing', 'features', 'card']),
]

export const HERO_TEMPLATES: HeroTemplate[] = [...LEGACY_TEMPLATES, ...PREMIUM_TEMPLATES, ...PREMIUM_TEMPLATES_V2]

const BY_ID = new Map(HERO_TEMPLATES.map(t => [t.id, t]))

export function getTemplate(id: string): HeroTemplate | undefined { return BY_ID.get(id) }
export function isKnownTemplate(id: string): boolean { return BY_ID.has(id) }
export function templatesByCategory(category: string): HeroTemplate[] {
  return HERO_TEMPLATES.filter(t => t.category === category)
}
export const HERO_CATEGORIES = [...new Set(HERO_TEMPLATES.map(t => t.category))]

/** A minimal valid default config for a given template (used by "new hero"). */
export function defaultConfig(templateId: string): HeroConfig {
  const t = getTemplate(templateId) ?? HERO_TEMPLATES[0]
  const emptyL = { headline: '', subheadline: '', ctas: [], stats: [] }
  return {
    template: t.id,
    content: { en: { ...emptyL }, fa: { ...emptyL } },
    style: { titleSize: 56, subtitleSize: 20, minHeightVh: 100, buttonRadius: 12, buttonSize: 'lg' },
    blocks: [],
  }
}
