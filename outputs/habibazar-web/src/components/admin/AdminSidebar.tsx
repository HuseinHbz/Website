'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo, useState } from 'react'
import {
  visibleWorkspaces, visibleGroups, workspaceForPath, workspaceHome,
  quickActionsFor, allNavItems, type WsItem,
} from '@/lib/admin/workspaces'
import { useNavPrefs } from '@/lib/admin/navPrefs'

interface Props {
  collapsed: boolean
  onToggle: () => void
  locale: 'fa' | 'en'
  isRTL: boolean
  role: string
  onOpenCmd: () => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function AdminSidebar({ collapsed, onToggle, locale, isRTL, role, onOpenCmd, mobileOpen = false, onMobileClose }: Props) {
  const pathname = usePathname()
  const ws = workspaceForPath(pathname)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [q, setQ] = useState('')
  const { favorites, recents, isFavorite, toggleFavorite } = useNavPrefs()
  const expanded = !collapsed || mobileOpen

  const groups = useMemo(() => visibleGroups(role, ws), [role, ws])
  const workspaces = useMemo(() => visibleWorkspaces(role), [role])
  const quickActions = useMemo(() => quickActionsFor(role, ws.id), [role, ws.id])
  const itemByHref = useMemo(() => new Map(allNavItems().map(i => [i.href, i as WsItem])), [])

  const query = q.trim().toLowerCase()
  const searchResults = useMemo(() => {
    if (!query) return []
    return groups.flatMap(g => g.items).filter(it =>
      it.labelEn.toLowerCase().includes(query) || it.labelFa.includes(q.trim()))
  }, [query, q, groups])

  const favItems = favorites.map(h => itemByHref.get(h)).filter(Boolean) as WsItem[]
  const recentItems = recents.map(h => itemByHref.get(h)).filter(Boolean) as WsItem[]

  const desktopPos = isRTL
    ? `lg:right-0 lg:left-auto lg:${collapsed ? 'w-16' : 'w-60'}`
    : `lg:left-0 lg:right-auto lg:${collapsed ? 'w-16' : 'w-60'}`
  const mobileTranslate = isRTL ? (mobileOpen ? 'translate-x-0' : 'translate-x-full') : (mobileOpen ? 'translate-x-0' : '-translate-x-full')
  const borderSide = isRTL ? 'border-l' : 'border-r'

  const NavLink = ({ item, star = true }: { item: WsItem; star?: boolean }) => {
    const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
    const label = locale === 'fa' ? item.labelFa : item.labelEn
    return (
      <div className="group/nav flex items-center">
        <Link
          href={item.href}
          aria-current={active ? 'page' : undefined}
          className={`flex-1 flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-all min-h-[40px] ${active ? 'bg-brand/20 text-brand font-medium' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`}
          title={(collapsed && !mobileOpen) ? label : undefined}
        >
          <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
          {expanded && <span className="truncate">{label}</span>}
        </Link>
        {expanded && star && (
          <button
            onClick={() => toggleFavorite(item.href)}
            aria-label={isFavorite(item.href) ? 'Unpin' : 'Pin'}
            className={`px-1 text-sm shrink-0 transition-opacity ${isFavorite(item.href) ? 'text-warning-text opacity-100' : 'text-text-disabled opacity-0 group-hover/nav:opacity-100 hover:text-warning-text'}`}
          >{isFavorite(item.href) ? '★' : '☆'}</button>
        )}
      </div>
    )
  }

  const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      {expanded && <p className="text-[10px] font-bold uppercase tracking-widest text-text-disabled px-2 mb-1">{label}</p>}
      <ul className="space-y-0.5">{children}</ul>
    </div>
  )

  return (
    <aside
      dir={isRTL ? 'rtl' : 'ltr'}
      aria-label={isRTL ? 'ناوبری اصلی' : 'Main navigation'}
      className={['fixed top-0 h-screen bg-surface-2 flex flex-col z-50 transition-all duration-300', borderSide, 'border-border', 'w-72 lg:w-auto', isRTL ? 'right-0' : 'left-0', `${mobileTranslate} lg:translate-x-0`, desktopPos].join(' ')}
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-border gap-3 flex-shrink-0">
        <Link href="/admin/home" className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-brand-hover flex items-center justify-center text-white text-xs font-black flex-shrink-0" title={isRTL ? 'همه فضاهای کاری' : 'All workspaces'}>HBZ</Link>
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

      {/* Workspace switcher (RBAC-filtered) */}
      {expanded && (
        <div className="px-3 pt-3 pb-1 relative">
          <button onClick={() => setSwitcherOpen(o => !o)} aria-haspopup="listbox" aria-expanded={switcherOpen}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-brand/10 border border-brand/25 text-text-primary hover:bg-brand/15 transition-all">
            <span className="text-base">{ws.icon}</span>
            <span className="flex-1 text-start font-semibold truncate">{isRTL ? ws.nameFa : ws.nameEn}</span>
            <span className="text-text-tertiary text-xs">{switcherOpen ? '▲' : '▼'}</span>
          </button>
          {switcherOpen && (
            <div role="listbox" className="absolute z-50 left-3 right-3 mt-1 max-h-[60vh] overflow-y-auto rounded-lg bg-surface border border-border shadow-2xl py-1">
              {workspaces.map(w => (
                <Link key={w.id} href={workspaceHome(w)} onClick={() => setSwitcherOpen(false)} role="option" aria-selected={w.id === ws.id}
                  className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${w.id === ws.id ? 'bg-brand/15 text-brand' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`}>
                  <span className="w-5 text-center">{w.icon}</span><span className="flex-1 truncate">{isRTL ? w.nameFa : w.nameEn}</span>
                </Link>
              ))}
              <Link href="/admin/home" onClick={() => setSwitcherOpen(false)} className="flex items-center gap-2 px-3 py-2 text-xs text-text-tertiary hover:text-text-primary border-t border-border mt-1 pt-2">
                <span className="w-5 text-center">▦</span>{isRTL ? 'همه فضاهای کاری' : 'All workspaces'}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Sidebar search + command palette */}
      {expanded && (
        <div className="px-3 pt-1 pb-1 space-y-1.5">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={isRTL ? 'جستجو در این فضا...' : 'Search this workspace...'}
            aria-label={isRTL ? 'جستجوی ناوبری' : 'Navigation search'}
            className="w-full px-3 py-1.5 rounded-lg text-xs bg-white/[0.04] border border-white/[0.08] text-text-primary placeholder:text-text-disabled outline-none focus:border-brand/40"
          />
          <button onClick={onOpenCmd} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-text-tertiary hover:text-text-secondary transition-all bg-white/[0.02] border border-white/[0.06]">
            <span>⌘</span><span className="flex-1 text-start">{isRTL ? 'دستورات (Ctrl+K)' : 'Commands (Ctrl+K)'}</span>
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
        {query ? (
          <Section label={isRTL ? 'نتایج جستجو' : 'Search results'}>
            {searchResults.length === 0
              ? <li className="px-2 py-2 text-xs text-text-tertiary">{isRTL ? 'یافت نشد' : 'No matches'}</li>
              : searchResults.map(it => <li key={it.href}><NavLink item={it} /></li>)}
          </Section>
        ) : (
          <>
            <Section label={isRTL ? 'داشبورد' : 'Dashboard'}>
              <li><NavLink item={{ labelEn: 'Dashboard', labelFa: 'داشبورد', href: `/admin/dashboards/${ws.id}`, icon: '▦' }} star={false} /></li>
            </Section>
            {favItems.length > 0 && (
              <Section label={isRTL ? 'موارد دلخواه' : 'Favorites'}>
                {favItems.map(it => <li key={it.href}><NavLink item={it} /></li>)}
              </Section>
            )}
            {quickActions.length > 0 && (
              <Section label={isRTL ? 'اقدامات سریع' : 'Quick actions'}>
                {quickActions.map(a => <li key={a.href}><NavLink item={{ labelEn: a.labelEn, labelFa: a.labelFa, href: a.href, icon: a.icon }} star={false} /></li>)}
              </Section>
            )}
            {groups.map(section => (
              <Section key={section.en} label={locale === 'fa' ? section.fa : section.en}>
                {section.items.map(item => <li key={item.href}><NavLink item={item} /></li>)}
              </Section>
            ))}
            {recentItems.length > 0 && (
              <Section label={isRTL ? 'اخیر' : 'Recent'}>
                {recentItems.slice(0, 6).map(it => <li key={it.href}><NavLink item={it} star={false} /></li>)}
              </Section>
            )}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-1">
        {(collapsed && !mobileOpen) && (
          <button onClick={onOpenCmd} className="w-full flex items-center justify-center py-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-white/5 transition-all min-h-[40px]" title={isRTL ? 'جستجوی سریع' : 'Quick search'}>🔍</button>
        )}
        <Link href="/fa" target="_blank" className="flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-text-tertiary hover:text-text-primary hover:bg-white/5 transition-all min-h-[40px]" title={isRTL ? 'مشاهده سایت عمومی' : 'View Public Site'}>
          <span>↗</span>{expanded && <span>{isRTL ? 'مشاهده سایت عمومی' : 'View Public Site'}</span>}
        </Link>
      </div>
    </aside>
  )
}
