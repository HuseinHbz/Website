'use client'

import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

interface NavPrefs {
  favorites: string[]
  recents: string[]
  searches: string[]
  badges: Record<string, number>
  collapsedGroups: string[]
  isFavorite: (href: string) => boolean
  toggleFavorite: (href: string) => void
  clearRecents: () => void
  recordSearch: (term: string) => void
  isGroupCollapsed: (group: string) => boolean
  toggleGroup: (group: string) => void
}

const Ctx = createContext<NavPrefs | null>(null)

export function NavPrefsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [favorites, setFavorites] = useState<string[]>([])
  const [recents, setRecents] = useState<string[]>([])
  const [searches, setSearches] = useState<string[]>([])
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([])
  const [badges, setBadges] = useState<Record<string, number>>({})
  const lastVisit = useRef<string>('')

  useEffect(() => {
    fetch('/api/admin/nav-prefs').then(r => r.json())
      .then(d => { setFavorites(d.favorites ?? []); setRecents(d.recents ?? []); setSearches(d.searches ?? []); setCollapsedGroups(d.ui?.collapsedGroups ?? []) })
      .catch(() => {})
  }, [])

  // Live notification badges (new contacts/consultations/leads, failed backups,
  // DLQ) — refreshed on mount + every 60s + on route change.
  useEffect(() => {
    let alive = true
    const pull = () => fetch('/api/admin/nav-badges').then(r => r.json()).then(d => { if (alive) setBadges(d.badges ?? {}) }).catch(() => {})
    pull()
    const id = setInterval(pull, 60_000)
    return () => { alive = false; clearInterval(id) }
  }, [pathname])

  // Record a visit when the admin route changes (deduped, ignores the home grid).
  useEffect(() => {
    if (!pathname.startsWith('/admin') || pathname === '/admin/home' || pathname === '/admin/login') return
    if (lastVisit.current === pathname) return
    lastVisit.current = pathname
    const t = setTimeout(() => {
      fetch('/api/admin/nav-prefs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'visit', href: pathname }) })
        .then(r => r.json()).then(d => { if (d.recents) setRecents(d.recents) }).catch(() => {})
    }, 600)
    return () => clearTimeout(t)
  }, [pathname])

  const toggleFavorite = useCallback((href: string) => {
    setFavorites(prev => prev.includes(href) ? prev.filter(h => h !== href) : [href, ...prev]) // optimistic
    fetch('/api/admin/nav-prefs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggleFavorite', href }) })
      .then(r => r.json()).then(d => { if (d.favorites) setFavorites(d.favorites) }).catch(() => {})
  }, [])

  const clearRecents = useCallback(() => {
    setRecents([])
    fetch('/api/admin/nav-prefs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'clearRecents' }) }).catch(() => {})
  }, [])

  const recordSearch = useCallback((term: string) => {
    const t = term.trim()
    if (t.length < 2) return
    setSearches(prev => [t, ...prev.filter(s => s.toLowerCase() !== t.toLowerCase())].slice(0, 8)) // optimistic
    fetch('/api/admin/nav-prefs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'search', term: t }) })
      .then(r => r.json()).then(d => { if (d.searches) setSearches(d.searches) }).catch(() => {})
  }, [])

  const toggleGroup = useCallback((group: string) => {
    setCollapsedGroups(prev => prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]) // optimistic
    fetch('/api/admin/nav-prefs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggleGroup', group }) })
      .then(r => r.json()).then(d => { if (d.ui?.collapsedGroups) setCollapsedGroups(d.ui.collapsedGroups) }).catch(() => {})
  }, [])

  const isFavorite = useCallback((href: string) => favorites.includes(href), [favorites])
  const isGroupCollapsed = useCallback((group: string) => collapsedGroups.includes(group), [collapsedGroups])

  return <Ctx.Provider value={{ favorites, recents, searches, badges, collapsedGroups, isFavorite, toggleFavorite, clearRecents, recordSearch, isGroupCollapsed, toggleGroup }}>{children}</Ctx.Provider>
}

export function useNavPrefs(): NavPrefs {
  return useContext(Ctx) ?? { favorites: [], recents: [], searches: [], badges: {}, collapsedGroups: [], isFavorite: () => false, toggleFavorite: () => {}, clearRecents: () => {}, recordSearch: () => {}, isGroupCollapsed: () => false, toggleGroup: () => {} }
}
