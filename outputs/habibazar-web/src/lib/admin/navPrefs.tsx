'use client'

import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { workspaceForPath } from '@/lib/admin/workspaces'

interface NavPrefs {
  favorites: string[]
  recents: string[]
  searches: string[]
  commands: string[]
  popular: string[]
  badges: Record<string, number>
  collapsedGroups: string[]
  favWorkspaces: string[]
  recentWorkspaces: string[]
  isFavorite: (href: string) => boolean
  toggleFavorite: (href: string) => void
  clearRecents: () => void
  recordSearch: (term: string) => void
  recordCommand: (id: string) => void
  isGroupCollapsed: (group: string) => boolean
  toggleGroup: (group: string) => void
  isFavWorkspace: (id: string) => boolean
  toggleFavWorkspace: (id: string) => void
}

const Ctx = createContext<NavPrefs | null>(null)

export function NavPrefsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [favorites, setFavorites] = useState<string[]>([])
  const [recents, setRecents] = useState<string[]>([])
  const [searches, setSearches] = useState<string[]>([])
  const [commands, setCommands] = useState<string[]>([])
  const [popular, setPopular] = useState<string[]>([])
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([])
  const [favWorkspaces, setFavWorkspaces] = useState<string[]>([])
  const [recentWorkspaces, setRecentWorkspaces] = useState<string[]>([])
  const [badges, setBadges] = useState<Record<string, number>>({})
  const lastVisit = useRef<string>('')
  const lastWs = useRef<string>('')

  useEffect(() => {
    fetch('/api/admin/nav-prefs').then(r => r.json())
      .then(d => { setFavorites(d.favorites ?? []); setRecents(d.recents ?? []); setSearches(d.searches ?? []); setCommands(d.commands ?? []); setPopular(d.popular ?? []); setCollapsedGroups(d.ui?.collapsedGroups ?? []); setFavWorkspaces(d.ui?.favWorkspaces ?? []); setRecentWorkspaces(d.ui?.recentWorkspaces ?? []) })
      .catch(() => {})
  }, [])

  // Record the recently-used workspace when the active workspace changes.
  useEffect(() => {
    if (!pathname.startsWith('/admin') || pathname === '/admin/login') return
    const wsId = workspaceForPath(pathname).id
    if (lastWs.current === wsId) return
    lastWs.current = wsId
    const t = setTimeout(() => {
      fetch('/api/admin/nav-prefs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'visitWorkspace', workspace: wsId }) })
        .then(r => r.json()).then(d => { if (d.ui?.recentWorkspaces) setRecentWorkspaces(d.ui.recentWorkspaces) }).catch(() => {})
    }, 700)
    return () => clearTimeout(t)
  }, [pathname])

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

  const recordCommand = useCallback((id: string) => {
    if (!id) return
    setCommands(prev => [id, ...prev.filter(c => c !== id)].slice(0, 8)) // optimistic
    fetch('/api/admin/nav-prefs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'runCommand', command: id }) })
      .then(r => r.json()).then(d => { if (d.commands) setCommands(d.commands) }).catch(() => {})
  }, [])

  const toggleGroup = useCallback((group: string) => {
    setCollapsedGroups(prev => prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]) // optimistic
    fetch('/api/admin/nav-prefs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggleGroup', group }) })
      .then(r => r.json()).then(d => { if (d.ui?.collapsedGroups) setCollapsedGroups(d.ui.collapsedGroups) }).catch(() => {})
  }, [])

  const toggleFavWorkspace = useCallback((id: string) => {
    setFavWorkspaces(prev => prev.includes(id) ? prev.filter(x => x !== id) : [id, ...prev]) // optimistic
    fetch('/api/admin/nav-prefs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggleFavWorkspace', workspace: id }) })
      .then(r => r.json()).then(d => { if (d.ui?.favWorkspaces) setFavWorkspaces(d.ui.favWorkspaces) }).catch(() => {})
  }, [])

  const isFavorite = useCallback((href: string) => favorites.includes(href), [favorites])
  const isGroupCollapsed = useCallback((group: string) => collapsedGroups.includes(group), [collapsedGroups])
  const isFavWorkspace = useCallback((id: string) => favWorkspaces.includes(id), [favWorkspaces])

  return <Ctx.Provider value={{ favorites, recents, searches, commands, popular, badges, collapsedGroups, favWorkspaces, recentWorkspaces, isFavorite, toggleFavorite, clearRecents, recordSearch, recordCommand, isGroupCollapsed, toggleGroup, isFavWorkspace, toggleFavWorkspace }}>{children}</Ctx.Provider>
}

export function useNavPrefs(): NavPrefs {
  return useContext(Ctx) ?? { favorites: [], recents: [], searches: [], commands: [], popular: [], badges: {}, collapsedGroups: [], favWorkspaces: [], recentWorkspaces: [], isFavorite: () => false, toggleFavorite: () => {}, clearRecents: () => {}, recordSearch: () => {}, recordCommand: () => {}, isGroupCollapsed: () => false, toggleGroup: () => {}, isFavWorkspace: () => false, toggleFavWorkspace: () => {} }
}
