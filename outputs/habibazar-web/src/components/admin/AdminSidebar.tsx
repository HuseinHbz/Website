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
    group: { en: 'Requests', fa: 'درخواست‌ها' },
    items: [
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
      { labelEn: 'Audit Center', labelFa: 'مرکز حسابرسی', href: '/admin/audit', icon: '▦' },
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
}

export function AdminSidebar({ collapsed, onToggle, locale, isRTL, onOpenCmd }: Props) {
  const pathname = usePathname()

  const sidePosition = isRTL
    ? `fixed top-0 right-0 h-screen ${collapsed ? 'w-16' : 'w-60'}`
    : `fixed top-0 left-0 h-screen ${collapsed ? 'w-16' : 'w-60'}`
  const borderSide = isRTL ? 'border-l' : 'border-r'

  return (
    <aside
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`${sidePosition} bg-[#0c0c14] ${borderSide} border-[#1e1e2e] flex flex-col z-50 transition-all duration-300`}
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-[#1e1e2e] gap-3 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
          HBZ
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-white truncate">
              {isRTL ? 'مرکز کنترل' : 'Control Center'}
            </div>
            <div className="text-[10px] text-slate-500 truncate">HBZ Technology</div>
          </div>
        )}
        <button
          onClick={onToggle}
          className={`${isRTL ? 'mr-auto' : 'ml-auto'} text-slate-500 hover:text-white transition-colors flex-shrink-0`}
          title={collapsed ? (isRTL ? 'باز کردن' : 'Expand') : (isRTL ? 'بستن' : 'Collapse')}
        >
          {collapsed ? (isRTL ? '‹' : '›') : (isRTL ? '›' : '‹')}
        </button>
      </div>

      {/* Command palette shortcut */}
      {!collapsed && (
        <div className="px-3 pt-3 pb-1">
          <button
            onClick={onOpenCmd}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-300 transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span>🔍</span>
            <span className="flex-1 text-start">{isRTL ? 'جستجوی سریع...' : 'Quick search...'}</span>
            <kbd className="text-[10px] px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>⌘K</kbd>
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
        {NAV.map((section) => (
          <div key={section.group.en}>
            {!collapsed && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 px-2 mb-1">
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
                      className={`flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-all ${
                        active
                          ? 'bg-indigo-500/20 text-indigo-400 font-medium'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                      title={collapsed ? label : undefined}
                    >
                      <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
                      {!collapsed && <span className="truncate">{label}</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-[#1e1e2e] space-y-1">
        {collapsed && (
          <button
            onClick={onOpenCmd}
            className="w-full flex items-center justify-center py-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all"
            title={isRTL ? 'جستجوی سریع' : 'Quick search'}
          >
            🔍
          </button>
        )}
        <Link
          href="/fa"
          target="_blank"
          className="flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-slate-500 hover:text-white hover:bg-white/5 transition-all"
          title={isRTL ? 'مشاهده سایت عمومی' : 'View Public Site'}
        >
          <span>↗</span>
          {!collapsed && <span>{isRTL ? 'مشاهده سایت عمومی' : 'View Public Site'}</span>}
        </Link>
      </div>
    </aside>
  )
}
