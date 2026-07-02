'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { AdminSidebar } from './AdminSidebar'
import { AdminHeader } from './AdminHeader'
import { CommandPalette } from './CommandPalette'
import { AdminLocaleProvider } from '@/lib/admin/locale'
import type { AdminUser } from '@/lib/admin/auth'

interface Props {
  user: AdminUser
  title: string
  children: React.ReactNode
}

export function AdminShell({ user, title, children }: Props) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [locale, setLocale] = useState<'fa' | 'en'>('fa')
  const [cmdOpen, setCmdOpen] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('admin_locale') as 'fa' | 'en' | null
    if (stored) setLocale(stored)
  }, [])

  // Auto-collapse sidebar on small screens
  useEffect(() => {
    function onResize() {
      if (window.innerWidth < 1024) setCollapsed(true)
    }
    onResize()
    window.addEventListener('resize', onResize, { passive: true })
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Ctrl+K / Cmd+K opens command palette
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(v => !v)
      }
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function toggleLocale() {
    const next = locale === 'fa' ? 'en' : 'fa'
    setLocale(next)
    localStorage.setItem('admin_locale', next)
  }

  const isRTL = locale === 'fa'

  return (
    <div className="min-h-screen bg-background text-text-primary flex" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <AdminSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        locale={locale}
        isRTL={isRTL}
        onOpenCmd={() => setCmdOpen(true)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div
        className={`flex-1 flex flex-col transition-all duration-300 min-w-0 ${
          isRTL
            ? collapsed ? 'lg:mr-16' : 'lg:mr-60'
            : collapsed ? 'lg:ml-16' : 'lg:ml-60'
        }`}
      >
        <AdminHeader
          user={user}
          title={title}
          locale={locale}
          onToggleLocale={toggleLocale}
          onOpenCmd={() => setCmdOpen(true)}
          onMobileOpen={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <AdminLocaleProvider locale={locale}>
            {children}
          </AdminLocaleProvider>
        </main>
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} locale={locale} />
    </div>
  )
}
