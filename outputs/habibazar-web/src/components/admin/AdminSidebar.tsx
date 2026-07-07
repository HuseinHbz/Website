'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { WORKSPACES, workspaceForPath, workspaceHome } from '@/lib/admin/workspaces'

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
  const ws = workspaceForPath(pathname)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const expanded = !collapsed || mobileOpen

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
        'w-72 lg:w-auto',
        isRTL ? 'right-0' : 'left-0',
        `${mobileTranslate} lg:translate-x-0`,
        desktopPos,
      ].join(' ')}
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-border gap-3 flex-shrink-0">
        <Link href="/admin/home" className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-brand-hover flex items-center justify-center text-white text-xs font-black flex-shrink-0" title={isRTL ? 'همه فضاهای کاری' : 'All workspaces'}>
          HBZ
        </Link>
        {expanded && (
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-text-primary truncate">{isRTL ? 'مرکز کنترل' : 'Control Center'}</div>
            <div className="text-[10px] text-text-tertiary truncate">HBZ Technology</div>
          </div>
        )}
        <button onClick={onMobileClose} className="lg:hidden text-text-muted hover:text-text-primary transition-colors flex-shrink-0 p-1" aria-label="Close sidebar">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <button onClick={onToggle} className={`hidden lg:block ${isRTL ? 'mr-auto' : 'ml-auto'} text-text-muted hover:text-text-primary transition-colors flex-shrink-0 p-1`} title={collapsed ? (isRTL ? 'باز کردن' : 'Expand') : (isRTL ? 'بستن' : 'Collapse')} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? (isRTL ? '‹' : '›') : (isRTL ? '›' : '‹')}
        </button>
      </div>

      {/* Workspace switcher */}
      {expanded && (
        <div className="px-3 pt-3 pb-1 relative">
          <button
            onClick={() => setSwitcherOpen(o => !o)}
            aria-haspopup="listbox"
            aria-expanded={switcherOpen}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-brand/10 border border-brand/25 text-text-primary hover:bg-brand/15 transition-all"
          >
            <span className="text-base">{ws.icon}</span>
            <span className="flex-1 text-start font-semibold truncate">{isRTL ? ws.nameFa : ws.nameEn}</span>
            <span className="text-text-tertiary text-xs">{switcherOpen ? '▲' : '▼'}</span>
          </button>
          {switcherOpen && (
            <div role="listbox" className="absolute z-50 left-3 right-3 mt-1 max-h-[60vh] overflow-y-auto rounded-lg bg-surface border border-border shadow-2xl py-1">
              {WORKSPACES.map(w => {
                const active = w.id === ws.id
                return (
                  <Link
                    key={w.id}
                    href={workspaceHome(w)}
                    onClick={() => setSwitcherOpen(false)}
                    role="option"
                    aria-selected={active}
                    className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${active ? 'bg-brand/15 text-brand' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`}
                  >
                    <span className="w-5 text-center">{w.icon}</span>
                    <span className="flex-1 truncate">{isRTL ? w.nameFa : w.nameEn}</span>
                  </Link>
                )
              })}
              <Link href="/admin/home" onClick={() => setSwitcherOpen(false)} className="flex items-center gap-2 px-3 py-2 text-xs text-text-tertiary hover:text-text-primary border-t border-border mt-1 pt-2">
                <span className="w-5 text-center">▦</span>{isRTL ? 'همه فضاهای کاری' : 'All workspaces'}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Command palette shortcut */}
      {expanded && (
        <div className="px-3 pt-1 pb-1">
          <button onClick={onOpenCmd} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-text-tertiary hover:text-text-secondary transition-all bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06]">
            <span>🔍</span>
            <span className="flex-1 text-start">{isRTL ? 'جستجوی سریع...' : 'Quick search...'}</span>
            <kbd className="text-[10px] px-1 py-0.5 rounded bg-white/[0.08] border border-white/[0.1]">⌘K</kbd>
          </button>
        </div>
      )}

      {/* Workspace nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
        {(() => {
          const dashHref = `/admin/dashboards/${ws.id}`
          const active = pathname === dashHref
          return (
            <ul className="space-y-0.5">
              <li>
                <Link href={dashHref} className={`flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-all min-h-[40px] ${active ? 'bg-brand/20 text-brand font-medium' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`} title={(collapsed && !mobileOpen) ? (isRTL ? 'داشبورد' : 'Dashboard') : undefined}>
                  <span className="text-base w-5 text-center flex-shrink-0">▦</span>
                  {expanded && <span className="truncate">{isRTL ? 'داشبورد' : 'Dashboard'}</span>}
                </Link>
              </li>
            </ul>
          )
        })()}
        {ws.groups.map((section) => (
          <div key={section.en}>
            {expanded && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-disabled px-2 mb-1">
                {locale === 'fa' ? section.fa : section.en}
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
                      className={`flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-all min-h-[40px] ${active ? 'bg-brand/20 text-brand font-medium' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`}
                      title={(collapsed && !mobileOpen) ? label : undefined}
                    >
                      <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
                      {expanded && <span className="truncate">{label}</span>}
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
          <button onClick={onOpenCmd} className="w-full flex items-center justify-center py-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-white/5 transition-all min-h-[40px]" title={isRTL ? 'جستجوی سریع' : 'Quick search'}>🔍</button>
        )}
        <Link href="/fa" target="_blank" className="flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-text-tertiary hover:text-text-primary hover:bg-white/5 transition-all min-h-[40px]" title={isRTL ? 'مشاهده سایت عمومی' : 'View Public Site'}>
          <span>↗</span>
          {expanded && <span>{isRTL ? 'مشاهده سایت عمومی' : 'View Public Site'}</span>}
        </Link>
      </div>
    </aside>
  )
}
