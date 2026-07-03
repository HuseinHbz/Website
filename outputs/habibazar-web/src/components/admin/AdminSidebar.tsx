'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  {
    group: { en: 'Overview', fa: 'خلاصه' },
    items: [
      { labelEn: 'Dashboard', labelFa: 'داشبورد', href: '/admin', icon: '◈' },
      { labelEn: 'Analytics', labelFa: 'آنالیتیکس', href: '/admin/dashboard', icon: '◉' },
    ],
  },
  {
    group: { en: 'Personal Brand', fa: 'برند شخصی' },
    items: [
      { labelEn: 'Executive Profile', labelFa: 'پروفایل اجرایی', href: '/admin/about', icon: '◍' },
      { labelEn: 'Leadership Journey', labelFa: 'مسیر رهبری', href: '/admin/timeline', icon: '◎' },
      { labelEn: 'Credentials', labelFa: 'گواهینامه‌ها و جوایز', href: '/admin/credentials', icon: '🏅' },
    ],
  },
  {
    group: { en: 'Content Hub', fa: 'مرکز محتوا' },
    items: [
      { labelEn: 'All Content', labelFa: 'همه محتوا', href: '/admin/content', icon: '📝' },
      { labelEn: 'Hero & Landing', labelFa: 'هیرو و صفحه اصلی', href: '/admin/hero', icon: '⬡' },
    ],
  },
  {
    group: { en: 'Technology', fa: 'فناوری' },
    items: [
      { labelEn: 'Technology Catalog', labelFa: 'کاتالوگ فناوری', href: '/admin/technologies', icon: '⚙️' },
      { labelEn: 'Solutions', labelFa: 'راهکارها', href: '/admin/solutions', icon: '💡' },
      { labelEn: 'Industries', labelFa: 'صنایع', href: '/admin/industries', icon: '🏭' },
    ],
  },
  {
    group: { en: 'Portfolio', fa: 'پورتفولیو' },
    items: [
      { labelEn: 'Case Studies', labelFa: 'مطالعات موردی', href: '/admin/projects', icon: '◆' },
      { labelEn: 'Success Stories', labelFa: 'داستان‌های موفقیت', href: '/admin/testimonials', icon: '⭐' },
    ],
  },
  {
    group: { en: 'Organizations', fa: 'سازمان‌ها' },
    items: [
      { labelEn: 'Organization Hub', labelFa: 'مرکز سازمان‌ها', href: '/admin/organizations', icon: '🏢' },
    ],
  },
  {
    group: { en: 'Products', fa: 'محصولات' },
    items: [
      { labelEn: 'Products & Platform', labelFa: 'محصولات و پلتفرم', href: '/admin/products', icon: '📦' },
    ],
  },
  {
    group: { en: 'Academy', fa: 'آکادمی' },
    items: [
      { labelEn: 'Courses & Learning', labelFa: 'دوره‌ها و یادگیری', href: '/admin/academy', icon: '🎓' },
    ],
  },
  {
    group: { en: 'Community', fa: 'جامعه' },
    items: [
      { labelEn: 'Events & Webinars', labelFa: 'رویدادها و وبینارها', href: '/admin/events-mgr', icon: '🗓️' },
    ],
  },
  {
    group: { en: 'Enterprise', fa: 'سازمانی' },
    items: [
      { labelEn: 'HBZ Organization', labelFa: 'پروفایل شرکت', href: '/admin/organization', icon: '🏛️' },
      { labelEn: 'Sites', labelFa: 'سایت‌ها', href: '/admin/sites', icon: '🌐' },
      { labelEn: 'Workspaces', labelFa: 'فضاهای کاری', href: '/admin/workspaces', icon: '🗃️' },
      { labelEn: 'Partners', labelFa: 'شرکا', href: '/admin/partners', icon: '🤝' },
      { labelEn: 'Integrations', labelFa: 'یکپارچه‌سازی‌ها', href: '/admin/integrations', icon: '🔌' },
    ],
  },
  {
    group: { en: 'Operations', fa: 'عملیات' },
    items: [
      { labelEn: 'Operations Center', labelFa: 'مرکز عملیات', href: '/admin/operations', icon: '🖥️' },
    ],
  },
  {
    group: { en: 'Builder & Media', fa: 'سازنده و رسانه' },
    items: [
      { labelEn: 'Section Builder', labelFa: 'سازنده بخش‌ها', href: '/admin/sections', icon: '🧩' },
      { labelEn: 'Page Builder', labelFa: 'سازنده صفحات', href: '/admin/pages', icon: '📄' },
      { labelEn: 'Form Builder', labelFa: 'سازنده فرم', href: '/admin/forms', icon: '📋' },
      { labelEn: 'Menu Builder', labelFa: 'سازنده منو', href: '/admin/menus', icon: '☰' },
      { labelEn: 'Media Center', labelFa: 'مرکز رسانه', href: '/admin/media', icon: '▤' },
      { labelEn: 'Page Templates', labelFa: 'قالب‌های صفحه', href: '/admin/templates', icon: '🗂️' },
    ],
  },
  {
    group: { en: 'Business', fa: 'کسب‌وکار' },
    items: [
      { labelEn: 'CRM — Leads', labelFa: 'مدیریت سرنخ‌ها (CRM)', href: '/admin/crm', icon: '📇' },
      { labelEn: 'Asset Center (ERP)', labelFa: 'مرکز دارایی‌ها (ERP)', href: '/admin/assets', icon: '🖧' },
      { labelEn: 'Contact Requests', labelFa: 'درخواست‌های تماس', href: '/admin/contacts', icon: '✉' },
      { labelEn: 'Consultations', labelFa: 'مشاوره‌ها', href: '/admin/consultations', icon: '◎' },
    ],
  },
  {
    group: { en: 'AI Platform', fa: 'پلتفرم هوش مصنوعی' },
    items: [
      { labelEn: 'AI Control Center', labelFa: 'مرکز کنترل هوش مصنوعی', href: '/admin/ai-control', icon: '🤖' },
      { labelEn: 'AI Knowledge Base', labelFa: 'پایگاه دانش هوش مصنوعی', href: '/admin/ai-kb', icon: '📚' },
    ],
  },
  {
    group: { en: 'System', fa: 'سیستم' },
    items: [
      { labelEn: 'SEO Control Center', labelFa: 'مرکز کنترل سئو', href: '/admin/seo', icon: '◎' },
      { labelEn: 'System Settings', labelFa: 'تنظیمات سیستم', href: '/admin/settings', icon: '⚙' },
      { labelEn: 'User Management', labelFa: 'مدیریت کاربران', href: '/admin/users', icon: '◉' },
      { labelEn: 'Security & 2FA', labelFa: 'امنیت و ۲FA', href: '/admin/security', icon: '🔐' },
      { labelEn: 'Security Operations (SOC)', labelFa: 'مرکز عملیات امنیت (SOC)', href: '/admin/soc', icon: '🛡️' },
      { labelEn: 'Audit Center', labelFa: 'مرکز حسابرسی', href: '/admin/audit', icon: '▦' },
      { labelEn: 'Logs & Monitoring', labelFa: 'لاگ‌ها و پایش زنده', href: '/admin/logs-monitoring', icon: '📡' },
      { labelEn: 'Database Center', labelFa: 'مرکز دیتابیس', href: '/admin/database', icon: '🗄️' },
      { labelEn: 'Backup & Recovery', labelFa: 'پشتیبان‌گیری و بازیابی', href: '/admin/backup', icon: '💾' },
    ],
  },
]


interface Props {
  collapsed: boolean
  onToggle: () => void
  locale: 'fa' | 'en'
  isRTL: boolean
  onOpenCmd: () => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function AdminSidebar({ collapsed, onToggle, locale, isRTL, onOpenCmd, mobileOpen = false, onMobileClose }: Props) {
  const pathname = usePathname()

  // Desktop: fixed sidebar, width controlled by collapsed
  // Mobile: full-width overlay drawer, controlled by mobileOpen
  const desktopPos = isRTL
    ? `lg:right-0 lg:left-auto lg:${collapsed ? 'w-16' : 'w-60'}`
    : `lg:left-0 lg:right-auto lg:${collapsed ? 'w-16' : 'w-60'}`

  const mobileTranslate = isRTL
    ? mobileOpen ? 'translate-x-0' : 'translate-x-full'
    : mobileOpen ? 'translate-x-0' : '-translate-x-full'

  const borderSide = isRTL ? 'border-l' : 'border-r'

  return (
    <aside
      dir={isRTL ? 'rtl' : 'ltr'}
      className={[
        'fixed top-0 h-screen bg-surface-2 flex flex-col z-50 transition-all duration-300',
        borderSide, 'border-border',
        // Mobile: full width drawer from edge
        'w-72 lg:w-auto',
        isRTL ? 'right-0' : 'left-0',
        // Mobile slide in/out
        `${mobileTranslate} lg:translate-x-0`,
        // Desktop: collapsed or expanded
        desktopPos,
      ].join(' ')}
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-border gap-3 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-brand-hover flex items-center justify-center text-white text-xs font-black flex-shrink-0">
          HBZ
        </div>
        {(!collapsed || mobileOpen) && (
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-text-primary truncate">
              {isRTL ? 'مرکز کنترل' : 'Control Center'}
            </div>
            <div className="text-[10px] text-text-tertiary truncate">HBZ Technology</div>
          </div>
        )}
        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="lg:hidden text-text-muted hover:text-text-primary transition-colors flex-shrink-0 p-1"
          aria-label="Close sidebar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {/* Desktop collapse toggle */}
        <button
          onClick={onToggle}
          className={`hidden lg:block ${isRTL ? 'mr-auto' : 'ml-auto'} text-text-muted hover:text-text-primary transition-colors flex-shrink-0 p-1`}
          title={collapsed ? (isRTL ? 'باز کردن' : 'Expand') : (isRTL ? 'بستن' : 'Collapse')}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (isRTL ? '‹' : '›') : (isRTL ? '›' : '‹')}
        </button>
      </div>

      {/* Command palette shortcut */}
      {(!collapsed || mobileOpen) && (
        <div className="px-3 pt-3 pb-1">
          <button
            onClick={onOpenCmd}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-text-tertiary hover:text-text-secondary transition-all bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06]"
          >
            <span>🔍</span>
            <span className="flex-1 text-start">{isRTL ? 'جستجوی سریع...' : 'Quick search...'}</span>
            <kbd className="text-[10px] px-1 py-0.5 rounded bg-white/[0.08] border border-white/[0.1]">⌘K</kbd>
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
        {NAV.map((section) => (
          <div key={section.group.en}>
            {(!collapsed || mobileOpen) && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-disabled px-2 mb-1">
                {locale === 'fa' ? section.group.fa : section.group.en}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
                const label = locale === 'fa' ? item.labelFa : item.labelEn
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-all min-h-[40px] ${
                        active
                          ? 'bg-brand/20 text-brand font-medium'
                          : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                      }`}
                      title={(collapsed && !mobileOpen) ? label : undefined}
                    >
                      <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
                      {(!collapsed || mobileOpen) && <span className="truncate">{label}</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-1">
        {(collapsed && !mobileOpen) && (
          <button
            onClick={onOpenCmd}
            className="w-full flex items-center justify-center py-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-white/5 transition-all min-h-[40px]"
            title={isRTL ? 'جستجوی سریع' : 'Quick search'}
          >
            🔍
          </button>
        )}
        <Link
          href="/fa"
          target="_blank"
          className="flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-text-tertiary hover:text-text-primary hover:bg-white/5 transition-all min-h-[40px]"
          title={isRTL ? 'مشاهده سایت عمومی' : 'View Public Site'}
        >
          <span>↗</span>
          {(!collapsed || mobileOpen) && <span>{isRTL ? 'مشاهده سایت عمومی' : 'View Public Site'}</span>}
        </Link>
      </div>
    </aside>
  )
}
