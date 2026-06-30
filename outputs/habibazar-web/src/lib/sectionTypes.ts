export type SectionTypeId =
  | 'hero'
  | 'about'
  | 'features'
  | 'services'
  | 'pricing'
  | 'team'
  | 'testimonials'
  | 'portfolio'
  | 'blog_preview'
  | 'cta'
  | 'faq'
  | 'stats'
  | 'timeline'
  | 'skills'
  | 'certifications'
  | 'clients'
  | 'contact'
  | 'newsletter'
  | 'video'
  | 'gallery'
  | 'custom_html'

export type SectionVariant = string

export interface SectionTypeConfig {
  id: SectionTypeId
  labelEn: string
  labelFa: string
  icon: string
  variants: { value: string; label: string }[]
  themes: string[]
  animations: string[]
  hasMedia: boolean
  hasBg: boolean
  category: 'hero' | 'content' | 'social' | 'conversion' | 'media' | 'advanced'
}

export const SECTION_TYPES: SectionTypeConfig[] = [
  {
    id: 'hero',
    labelEn: 'Hero Banner',
    labelFa: 'بنر اصلی',
    icon: '🌟',
    variants: [
      { value: 'default', label: 'Full Width' },
      { value: 'split', label: 'Split Layout' },
      { value: 'minimal', label: 'Minimal' },
      { value: 'video_bg', label: 'Video Background' },
    ],
    themes: ['dark', 'light', 'gradient', 'transparent'],
    animations: ['fade', 'slide_up', 'zoom', 'none'],
    hasMedia: true,
    hasBg: true,
    category: 'hero',
  },
  {
    id: 'about',
    labelEn: 'About / Bio',
    labelFa: 'درباره / بیو',
    icon: '👤',
    variants: [
      { value: 'default', label: 'Standard' },
      { value: 'card', label: 'Card Style' },
      { value: 'timeline', label: 'With Timeline' },
    ],
    themes: ['dark', 'light', 'gradient'],
    animations: ['fade', 'slide_left', 'none'],
    hasMedia: true,
    hasBg: true,
    category: 'content',
  },
  {
    id: 'features',
    labelEn: 'Features Grid',
    labelFa: 'ویژگی‌ها',
    icon: '⚡',
    variants: [
      { value: 'default', label: '3-Column Grid' },
      { value: 'two_col', label: '2-Column Grid' },
      { value: 'list', label: 'List Style' },
      { value: 'icon_top', label: 'Icon Top' },
    ],
    themes: ['dark', 'light', 'gradient'],
    animations: ['fade', 'stagger', 'none'],
    hasMedia: false,
    hasBg: true,
    category: 'content',
  },
  {
    id: 'services',
    labelEn: 'Services',
    labelFa: 'خدمات',
    icon: '🛠',
    variants: [
      { value: 'default', label: 'Card Grid' },
      { value: 'horizontal', label: 'Horizontal List' },
      { value: 'tabbed', label: 'Tabbed' },
    ],
    themes: ['dark', 'light', 'gradient'],
    animations: ['fade', 'stagger', 'none'],
    hasMedia: false,
    hasBg: true,
    category: 'content',
  },
  {
    id: 'pricing',
    labelEn: 'Pricing Plans',
    labelFa: 'تعرفه‌ها',
    icon: '💰',
    variants: [
      { value: 'default', label: '3-Tier' },
      { value: 'comparison', label: 'Comparison Table' },
      { value: 'simple', label: 'Simple List' },
    ],
    themes: ['dark', 'light'],
    animations: ['fade', 'none'],
    hasMedia: false,
    hasBg: true,
    category: 'conversion',
  },
  {
    id: 'team',
    labelEn: 'Team Members',
    labelFa: 'تیم',
    icon: '👥',
    variants: [
      { value: 'default', label: 'Card Grid' },
      { value: 'compact', label: 'Compact' },
    ],
    themes: ['dark', 'light'],
    animations: ['fade', 'stagger', 'none'],
    hasMedia: false,
    hasBg: true,
    category: 'social',
  },
  {
    id: 'testimonials',
    labelEn: 'Testimonials',
    labelFa: 'نظرات مشتریان',
    icon: '💬',
    variants: [
      { value: 'default', label: 'Slider' },
      { value: 'grid', label: 'Grid' },
      { value: 'quote', label: 'Big Quote' },
    ],
    themes: ['dark', 'light', 'gradient'],
    animations: ['fade', 'none'],
    hasMedia: false,
    hasBg: true,
    category: 'social',
  },
  {
    id: 'portfolio',
    labelEn: 'Portfolio / Projects',
    labelFa: 'پروژه‌ها',
    icon: '🗂',
    variants: [
      { value: 'default', label: 'Masonry Grid' },
      { value: 'carousel', label: 'Carousel' },
      { value: 'list', label: 'List View' },
    ],
    themes: ['dark', 'light'],
    animations: ['fade', 'stagger', 'none'],
    hasMedia: false,
    hasBg: true,
    category: 'content',
  },
  {
    id: 'blog_preview',
    labelEn: 'Blog Preview',
    labelFa: 'پیش‌نمایش وبلاگ',
    icon: '📝',
    variants: [
      { value: 'default', label: 'Latest Posts' },
      { value: 'featured', label: 'Featured' },
      { value: 'category', label: 'By Category' },
    ],
    themes: ['dark', 'light'],
    animations: ['fade', 'none'],
    hasMedia: false,
    hasBg: true,
    category: 'content',
  },
  {
    id: 'cta',
    labelEn: 'Call to Action',
    labelFa: 'فراخوان',
    icon: '🎯',
    variants: [
      { value: 'default', label: 'Banner' },
      { value: 'centered', label: 'Centered' },
      { value: 'split', label: 'Split' },
    ],
    themes: ['dark', 'light', 'gradient', 'accent'],
    animations: ['fade', 'zoom', 'none'],
    hasMedia: true,
    hasBg: true,
    category: 'conversion',
  },
  {
    id: 'faq',
    labelEn: 'FAQ',
    labelFa: 'سوالات متداول',
    icon: '❓',
    variants: [
      { value: 'default', label: 'Accordion' },
      { value: 'two_col', label: '2-Column' },
      { value: 'tabs', label: 'Tabbed' },
    ],
    themes: ['dark', 'light'],
    animations: ['fade', 'none'],
    hasMedia: false,
    hasBg: true,
    category: 'content',
  },
  {
    id: 'stats',
    labelEn: 'Stats / Numbers',
    labelFa: 'آمار و اعداد',
    icon: '📊',
    variants: [
      { value: 'default', label: 'Counter Row' },
      { value: 'cards', label: 'Stat Cards' },
      { value: 'minimal', label: 'Minimal' },
    ],
    themes: ['dark', 'light', 'gradient'],
    animations: ['count_up', 'fade', 'none'],
    hasMedia: false,
    hasBg: true,
    category: 'content',
  },
  {
    id: 'timeline',
    labelEn: 'Timeline',
    labelFa: 'تایم‌لاین',
    icon: '📅',
    variants: [
      { value: 'default', label: 'Vertical' },
      { value: 'horizontal', label: 'Horizontal' },
      { value: 'compact', label: 'Compact' },
    ],
    themes: ['dark', 'light'],
    animations: ['fade', 'stagger', 'none'],
    hasMedia: false,
    hasBg: true,
    category: 'content',
  },
  {
    id: 'skills',
    labelEn: 'Skills',
    labelFa: 'مهارت‌ها',
    icon: '🧠',
    variants: [
      { value: 'default', label: 'Progress Bars' },
      { value: 'grid', label: 'Skill Grid' },
      { value: 'radar', label: 'Radar Chart' },
    ],
    themes: ['dark', 'light'],
    animations: ['fade', 'progress', 'none'],
    hasMedia: false,
    hasBg: true,
    category: 'content',
  },
  {
    id: 'certifications',
    labelEn: 'Certifications',
    labelFa: 'گواهینامه‌ها',
    icon: '🏆',
    variants: [
      { value: 'default', label: 'Badge Grid' },
      { value: 'list', label: 'List' },
    ],
    themes: ['dark', 'light'],
    animations: ['fade', 'stagger', 'none'],
    hasMedia: false,
    hasBg: true,
    category: 'social',
  },
  {
    id: 'clients',
    labelEn: 'Clients / Logos',
    labelFa: 'مشتریان',
    icon: '🤝',
    variants: [
      { value: 'default', label: 'Logo Grid' },
      { value: 'marquee', label: 'Scrolling Marquee' },
      { value: 'cards', label: 'Client Cards' },
    ],
    themes: ['dark', 'light'],
    animations: ['fade', 'none'],
    hasMedia: false,
    hasBg: true,
    category: 'social',
  },
  {
    id: 'contact',
    labelEn: 'Contact Form',
    labelFa: 'فرم تماس',
    icon: '📧',
    variants: [
      { value: 'default', label: 'Full Form' },
      { value: 'minimal', label: 'Minimal' },
      { value: 'split', label: 'Split with Info' },
    ],
    themes: ['dark', 'light'],
    animations: ['fade', 'none'],
    hasMedia: false,
    hasBg: true,
    category: 'conversion',
  },
  {
    id: 'newsletter',
    labelEn: 'Newsletter',
    labelFa: 'خبرنامه',
    icon: '📬',
    variants: [
      { value: 'default', label: 'Inline' },
      { value: 'centered', label: 'Centered Banner' },
    ],
    themes: ['dark', 'light', 'accent'],
    animations: ['fade', 'none'],
    hasMedia: false,
    hasBg: true,
    category: 'conversion',
  },
  {
    id: 'video',
    labelEn: 'Video Section',
    labelFa: 'بخش ویدیو',
    icon: '🎬',
    variants: [
      { value: 'default', label: 'Embed' },
      { value: 'popup', label: 'Popup Player' },
      { value: 'autoplay', label: 'Autoplay Background' },
    ],
    themes: ['dark', 'light'],
    animations: ['fade', 'none'],
    hasMedia: true,
    hasBg: true,
    category: 'media',
  },
  {
    id: 'gallery',
    labelEn: 'Photo Gallery',
    labelFa: 'گالری تصاویر',
    icon: '🖼',
    variants: [
      { value: 'default', label: 'Masonry' },
      { value: 'grid', label: 'Uniform Grid' },
      { value: 'slider', label: 'Slider' },
    ],
    themes: ['dark', 'light'],
    animations: ['fade', 'none'],
    hasMedia: true,
    hasBg: true,
    category: 'media',
  },
  {
    id: 'custom_html',
    labelEn: 'Custom HTML / Embed',
    labelFa: 'HTML سفارشی',
    icon: '💻',
    variants: [
      { value: 'default', label: 'Full Width' },
      { value: 'contained', label: 'Contained' },
    ],
    themes: ['dark', 'light', 'transparent'],
    animations: ['fade', 'none'],
    hasMedia: false,
    hasBg: false,
    category: 'advanced',
  },
]

export const SECTION_TYPE_MAP = Object.fromEntries(
  SECTION_TYPES.map((t) => [t.id, t])
) as Record<SectionTypeId, SectionTypeConfig>

export const SECTION_CATEGORIES = [
  { id: 'hero', label: 'Hero', icon: '🌟' },
  { id: 'content', label: 'Content', icon: '📄' },
  { id: 'social', label: 'Social Proof', icon: '👥' },
  { id: 'conversion', label: 'Conversion', icon: '🎯' },
  { id: 'media', label: 'Media', icon: '🎬' },
  { id: 'advanced', label: 'Advanced', icon: '💻' },
] as const
