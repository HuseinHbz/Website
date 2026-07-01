'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'dark' | 'light' | 'system' | 'high-contrast'

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: 'dark' | 'light' | 'high-contrast'
  setTheme: (t: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  resolvedTheme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

const STORAGE_KEY = 'hbz-theme'

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(resolved: 'dark' | 'light' | 'high-contrast') {
  const root = document.documentElement
  root.setAttribute('data-theme', resolved)
  root.style.colorScheme = resolved === 'light' ? 'light' : 'dark'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light' | 'high-contrast'>('dark')

  const resolve = useCallback((t: Theme): 'dark' | 'light' | 'high-contrast' => {
    if (t === 'system') return getSystemTheme()
    if (t === 'high-contrast') return 'high-contrast'
    return t
  }, [])

  const setTheme = useCallback((t: Theme) => {
    const resolved = resolve(t)
    setThemeState(t)
    setResolvedTheme(resolved)
    applyTheme(resolved)
    try { localStorage.setItem(STORAGE_KEY, t) } catch {}
  }, [resolve])

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }, [resolvedTheme, setTheme])

  useEffect(() => {
    let saved: Theme = 'dark'
    try { saved = (localStorage.getItem(STORAGE_KEY) as Theme) || 'dark' } catch {}
    const resolved = resolve(saved)
    setThemeState(saved)
    setResolvedTheme(resolved)
    applyTheme(resolved)

    // Listen for system theme changes
    if (saved === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => {
        const r = getSystemTheme()
        setResolvedTheme(r)
        applyTheme(r)
      }
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [resolve])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// Theme toggle button component
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      aria-label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      className={`
        inline-flex items-center justify-center w-9 h-9 rounded-lg
        text-text-secondary hover:text-text-primary
        hover:bg-white/5 transition-all duration-normal
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2
        focus-visible:ring-offset-background
        ${className}
      `}
    >
      {resolvedTheme === 'dark' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  )
}
