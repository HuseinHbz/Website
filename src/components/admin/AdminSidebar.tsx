'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, useRef, useEffect } from 'react'
import {
  visibleWorkspaces, visibleGroups, workspaceForPath, workspaceHome, resolveActiveHref,
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
  const searchParams = useSearchParams()
  const activeTab = searchParams?.get('tab') ?? null
  const router = useRouter()
  // BUG-010 second root (26.26b بند ۲.۱): resolve the workspace context-aware —
  // a cross-listed page keeps the user in the workspace they were already in,
  // instead of jumping to the first-listed owner (the reported Treasury/BI jump).
  const lastWsRef = useRef<string | null>(null)
  const ws = workspaceForPath(pathname, lastWsRef.current)
  useEffect(() => { lastWsRef.current = ws.id }, [ws.id])
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [wsQuery, setWsQuery] = useState('')
  const [wsSel, setWsSel] = useState(0)
  const [q, setQ] = useState('')
  const wsSearchRef = useRef<HTMLInputElement>(null)
  const { favorites, recents, badges, isFavorite, toggleFavorite, isGroupCollapsed, toggleGroup, favWorkspaces, recentWorkspaces, isFavWorkspace, toggleFavWorkspace } = useNavPrefs()
  const expanded = !collapsed || mobileOpen

  // Tree keyboard navigation over the sidebar: ↑/↓ rove between links + group
  // headers; ←/→ collapse/expand the focused group (direction is RTL-aware);
  // Enter activates natively; Esc blurs.
  function onNavKey(e: React.KeyboardEvent<HTMLElement>) {
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('a[href], button[data-group]'))
    const el = document.activeElement as HTMLElement | null
    const idx = el ? items.indexOf(el) : -1
    if (e.key === 'Escape') { el?.blur(); return }
    if (idx < 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(idx + 1, items.length - 1)]?.focus(); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[Math.max(idx - 1, 0)]?.focus(); return }
    const g = el?.dataset.group
    if (g) {
      const collapseKey = isRTL ? 'ArrowRight' : 'ArrowLeft'
      const expandKey = isRTL ? 'ArrowLeft' : 'ArrowRight'
      if (e.key === collapseKey && !isGroupCollapsed(g)) { e.preventDefault(); toggleGroup(g) }
      else if (e.key === expandKey && isGroupCollapsed(g)) { e.preventDefault(); toggleGroup(g) }
    }
  }

  // 26.27: explicit tree grants — a none node never renders in the nav
  const [grants, setGrants] = useState<Record<string, 'none' | 'read' | 'write'> | undefined>(undefined)
  useEffect(() => {
    let alive = true
    fetch('/api/admin/auth/me').then(r => r.ok ? r.json() : null).then(j => {
      if (alive && j?.grants && Object.keys(j.grants).length > 0) setGrants(j.grants)
    }).catch(() => { /* role-default nav */ })
    return () => { alive = false }
  }, [])
  const groups = useMemo(() => visibleGroups(role, ws, grants), [role, ws, grants])
  const workspaces = useMemo(() => visibleWorkspaces(role, grants), [role, grants])

  // Advanced switcher: search + favorites + recent + all (permission-filtered).
  const switcher = useMemo(() => {
    const qq = wsQuery.trim().toLowerCase()
    const match = (w: (typeof workspaces)[number]) => !qq || w.nameEn.toLowerCase().includes(qq) || w.nameFa.includes(wsQuery.trim())
    const byId = new Map(workspaces.map(w => [w.id, w]))
    const favs = favWorkspaces.map(id => byId.get(id)).filter((w): w is (typeof workspaces)[number] => !!w).filter(match)
    const favSet = new Set(favs.map(w => w.id))
    const recent = recentWorkspaces.map(id => byId.get(id)).filter((w): w is (typeof workspaces)[number] => !!w && !favSet.has(w.id)).filter(match)
    const usedSet = new Set([...favSet, ...recent.map(w => w.id)])
    const rest = workspaces.filter(w => !usedSet.has(w.id)).filter(match)
    return { favs, recent, rest, flat: [...favs, ...recent, ...rest] }
  }, [workspaces, favWorkspaces, recentWorkspaces, wsQuery])

  useEffect(() => { if (switcherOpen) { setWsQuery(''); setWsSel(0); setTimeout(() => wsSearchRef.current?.focus(), 30) } }, [switcherOpen])

  function onSwitcherKey(e: React.KeyboardEvent) {
    const flat = switcher.flat
    if (e.key === 'ArrowDown') { e.preventDefault(); setWsSel(s => Math.min(s + 1, flat.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setWsSel(s => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); const w = flat[wsSel]; if (w) { setSwitcherOpen(false); router.push(workspaceHome(w)) } }
    else if (e.key === 'Escape') { e.preventDefault(); setSwitcherOpen(false) }
  }
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

  // Navigation Resolver Engine: pick the single active href across everything
  // the sidebar renders (nav groups, favorites, recents, quick actions).
  const activeHref = useMemo(() => resolveActiveHref(pathname, [
    ...groups.flatMap(g => g.items.map(i => i.href)),
    ...favItems.map(i => i.href),
    ...recentItems.map(i => i.href),
    ...quickActions.map(a => a.href),
  ], activeTab), [pathname, activeTab, groups, favItems, recentItems, quickActions])

  const desktopPos = isRTL
    ? `lg:right-0 lg:left-auto lg:${collapsed ? 'w-16' : 'w-60'}`
    : `lg:left-0 lg:right-auto lg:${collapsed ? 'w-16' : 'w-60'}`
  const mobileTranslate = isRTL ? (mobileOpen ? 'translate-x-0' : 'translate-x-full') : (mobileOpen ? 'translate-x-0' : '-translate-x-full')
  const borderSide = isRTL ? 'border-l' : 'border-r'

  const NavLink = ({ item, star = true }: { item: WsItem; star?: boolean }) => {
    // One winner per render: exact match beats nested; action links (?new=) never activate.
    const active = item.href === activeHref
    const label = locale === 'fa' ? item.labelFa : item.labelEn
    return (
      <div className="group/nav flex items-center">
        <Link
          href={item.href}
          aria-current={active ? 'page' : undefined}
          className={`relative flex-1 flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-all min-h-[40px] ${active ? 'bg-brand/20 text-brand font-medium' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`}
          title={(collapsed && !mobileOpen) ? label : undefined}
        >
          <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
          {expanded && <span className="truncate flex-1">{label}</span>}
          {(badges[item.href] ?? 0) > 0 && (
            <span className={`shrink-0 text-3xs font-bold rounded-full bg-danger text-white min-w-[16px] h-4 px-1 inline-flex items-center justify-center ${expanded ? '' : 'absolute top-1 end-1'}`} aria-label={`${badges[item.href]} new`}>
              {badges[item.href] > 99 ? '99+' : badges[item.href]}
            </span>
          )}
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

  const Section = ({ label, children, groupKey, badgeCount = 0 }: { label: string; children: React.ReactNode; groupKey?: string; badgeCount?: number }) => {
    const collapsible = !!groupKey && expanded
    const isCollapsed = collapsible && isGroupCollapsed(groupKey!)
    return (
      <div>
        {expanded && (collapsible ? (
          <button
            onClick={() => toggleGroup(groupKey!)}
            aria-expanded={!isCollapsed}
            data-group={groupKey}
            className="w-full flex items-center gap-1 px-2 mb-1 text-3xs font-bold uppercase tracking-widest text-text-disabled hover:text-text-tertiary transition-colors"
          >
            <span className="text-4xs">{isCollapsed ? '▸' : '▾'}</span>
            <span className="flex-1 text-start">{label}</span>
            {badgeCount > 0 && <span className="text-danger-text">●</span>}
          </button>
        ) : (
          <p className="text-3xs font-bold uppercase tracking-widest text-text-disabled px-2 mb-1">{label}</p>
        ))}
        {!isCollapsed && <ul className="space-y-0.5">{children}</ul>}
      </div>
    )
  }

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
            <div className="text-3xs text-text-tertiary truncate">HBZ Technology</div>
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
            <div role="listbox" aria-label={isRTL ? 'انتخاب فضای کاری' : 'Select workspace'} onKeyDown={onSwitcherKey}
              className="absolute z-50 left-3 right-3 mt-1 max-h-[70vh] overflow-y-auto rounded-lg bg-surface border border-border shadow-2xl py-1">
              <div className="px-2 py-1.5 sticky top-0 bg-surface">
                <input ref={wsSearchRef} value={wsQuery} onChange={e => { setWsQuery(e.target.value); setWsSel(0) }}
                  placeholder={isRTL ? 'جستجوی فضا...' : 'Search workspaces...'} aria-label={isRTL ? 'جستجوی فضای کاری' : 'Search workspaces'}
                  className="w-full px-2.5 py-1.5 rounded-md text-xs bg-white/[0.04] border border-white/[0.08] text-text-primary placeholder:text-text-disabled outline-none focus:border-brand/40" />
                {/* BUG-011 (26.26): explicit count so the scrollable list isn't
                    mistaken for the whole set (was read as "only 6"). */}
                <p className="text-4xs text-text-disabled px-1 pt-1">{workspaces.length} {isRTL ? 'فضای کاری — برای دیدن همه اسکرول کنید' : 'workspaces — scroll to see all'}</p>
              </div>
              {switcher.flat.length === 0 && <p className="px-3 py-3 text-xs text-text-tertiary text-center">{isRTL ? 'یافت نشد' : 'No workspaces'}</p>}
              {([['fav', switcher.favs, isRTL ? 'دلخواه' : 'Favorites'], ['recent', switcher.recent, isRTL ? 'اخیر' : 'Recent'], ['all', switcher.rest, isRTL ? 'همه' : 'All']] as const).map(([key, list, label]) => (
                list.length > 0 && (
                  <div key={key}>
                    <p className="text-4xs font-bold uppercase tracking-widest text-text-disabled px-3 pt-2 pb-0.5">{label}</p>
                    {list.map(w => {
                      const flatIdx = switcher.flat.indexOf(w)
                      const sel = flatIdx === wsSel
                      return (
                        <div key={w.id} className="group/wsw flex items-center">
                          <button role="option" aria-selected={sel} onMouseEnter={() => setWsSel(flatIdx)}
                            onClick={() => { setSwitcherOpen(false); router.push(workspaceHome(w)) }}
                            className={`flex-1 flex items-center gap-2 px-3 py-2 text-sm text-start transition-colors ${sel ? 'bg-brand/15 text-brand' : w.id === ws.id ? 'text-brand' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`}>
                            <span className="w-5 text-center">{w.icon}</span><span className="flex-1 truncate">{isRTL ? w.nameFa : w.nameEn}</span>
                          </button>
                          <button onClick={() => toggleFavWorkspace(w.id)} aria-label={isFavWorkspace(w.id) ? 'Unpin workspace' : 'Pin workspace'}
                            className={`px-2 text-sm shrink-0 ${isFavWorkspace(w.id) ? 'text-warning-text' : 'text-text-disabled opacity-0 group-hover/wsw:opacity-100 hover:text-warning-text'}`}>{isFavWorkspace(w.id) ? '★' : '☆'}</button>
                        </div>
                      )
                    })}
                  </div>
                )
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
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5" onKeyDown={onNavKey}>
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
              <Section key={section.en} label={locale === 'fa' ? section.fa : section.en} groupKey={`${ws.id}:${section.en}`} badgeCount={section.items.reduce((s, it) => s + (badges[it.href] ?? 0), 0)}>
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
