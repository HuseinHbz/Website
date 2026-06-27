'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  {
    group: { en: 'Overview', fa: 'خلاصه' },
    items: [
      { labelEn: 'Dashboard', labelFa: 'داشبورد', href: '/admin', icon: '◈' },
      { labelEn: 'Analytics', labelFa: 'آمار', href: '/admin/dashboard', icon: '◉' },
    ],
  },
  {
    group: { en: 'Content', fa: 'محتوا' },
    items: [
      { labelEn: 'Hero Section', labelFa: 'بخش هیرو', href: '/admin/hero', icon: '⬡' },
      { labelEn: 'About / Bio', labelFa: 'درباره / بیوگرافی', href: '/admin/about', icon: '◍' },
      { labelEn: 'Career Timeline', labelFa: 'تایم‌لاین شغلی', href: '/admin/timeline', icon: '◎' },
      { labelEn: 'Skills', labelFa: 'مهارت‌ها', href: '/admin/skills', icon: '◈' },
      { labelEn: 'Services', labelFa: 'خدمات', href: '/admin/services', icon: '◉' },
      { labelEn: 'Projects', labelFa: 'پروژه‌ها', href: '/admin/projects', icon: '◆' },
      { labelEn: 'Clients', labelFa: 'مشتریان', href: '/admin/clients', icon: '◇' },
    ],
  },
  {
    group: { en: 'Blog', fa: 'وبلاگ' },
    items: [
      { labelEn: 'Blog Posts', labelFa: 'پست‌های وبلاگ', href: '/admin/blog', icon: '▣' },
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
    group: { en: 'Media & AI', fa: 'رسانه و هوش مصنوعی' },
    items: [
      { labelEn: 'Media Manager', labelFa: 'مدیریت رسانه', href: '/admin/media', icon: '▤' },
      { labelEn: 'AI Knowledge Base', labelFa: 'پایگاه دانش AI', href: '/admin/ai-kb', icon: '◈' },
    ],
  },
  {
    group: { en: 'System', fa: 'سیستم' },
    items: [
      { labelEn: 'SEO Settings', labelFa: 'تنظیمات سئو', href: '/admin/seo', icon: '◎' },
      { labelEn: 'Site Settings', labelFa: 'تنظیمات سایت', href: '/admin/settings', icon: '⚙' },
      { labelEn: 'Users & Roles', labelFa: 'کاربران و نقش‌ها', href: '/admin/users', icon: '◉' },
      { labelEn: 'Audit Logs', labelFa: 'لاگ‌های حسابرسی', href: '/admin/audit', icon: '▦' },
    ],
  },
]

interface Props {
  collapsed: boolean
  onToggle: () => void
  locale: 'fa' | 'en'
  isRTL: boolean
}

export function AdminSidebar({ collapsed, onToggle, locale, isRTL }: Props) {
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
              {isRTL ? 'پنل ادمین' : 'Admin Panel'}
            </div>
            <div className="text-[10px] text-slate-500 truncate">habibazar.ir</div>
          </div>
        )}
        <button
          onClick={onToggle}
          className={`${isRTL ? 'mr-auto' : 'ml-auto'} text-slate-500 hover:text-white transition-colors flex-shrink-0`}
          title={collapsed ? (isRTL ? 'باز کردن' : 'Expand') : (isRTL ? 'بستن' : 'Collapse')}
        >
          {collapsed
            ? (isRTL ? '‹' : '›')
            : (isRTL ? '›' : '‹')
          }
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
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
      <div className="p-3 border-t border-[#1e1e2e]">
        <Link
          href="/fa"
          target="_blank"
          className="flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-slate-500 hover:text-white hover:bg-white/5 transition-all"
          title={isRTL ? 'مشاهده سایت' : 'View Public Site'}
        >
          <span>↗</span>
          {!collapsed && <span>{isRTL ? 'مشاهده سایت' : 'View Public Site'}</span>}
        </Link>
      </div>
    </aside>
  )
}
