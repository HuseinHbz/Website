'use client'

import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

interface NavPrefs {
  favorites: string[]
  recents: string[]
  isFavorite: (href: string) => boolean
  toggleFavorite: (href: string) => void
  clearRecents: () => void
}

const Ctx = createContext<NavPrefs | null>(null)

export function NavPrefsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [favorites, setFavorites] = useState<string[]>([])
  const [recents, setRecents] = useState<string[]>([])
  const lastVisit = useRef<string>('')

  useEffect(() => {
    fetch('/api/admin/nav-prefs').then(r => r.json())
      .then(d => { setFavorites(d.favorites ?? []); setRecents(d.recents ?? []) })
      .catch(() => {})
  }, [])

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

  const isFavorite = useCallback((href: string) => favorites.includes(href), [favorites])

  return <Ctx.Provider value={{ favorites, recents, isFavorite, toggleFavorite, clearRecents }}>{children}</Ctx.Provider>
}

export function useNavPrefs(): NavPrefs {
  return useContext(Ctx) ?? { favorites: [], recents: [], isFavorite: () => false, toggleFavorite: () => {}, clearRecents: () => {} }
}
