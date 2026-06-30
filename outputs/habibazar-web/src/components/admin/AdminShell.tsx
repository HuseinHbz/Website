'use client'

import { useState, useEffect } from 'react'
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
  const [collapsed, setCollapsed] = useState(false)
  const [locale, setLocale] = useState<'fa' | 'en'>('fa')
  const [cmdOpen, setCmdOpen] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('admin_locale') as 'fa' | 'en' | null
    if (stored) setLocale(stored)
  }, [])

  // Ctrl+K / Cmd+K opens command palette
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(v => !v)
      }
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
    <div className="min-h-screen bg-[#080810] text-white flex" dir={isRTL ? 'rtl' : 'ltr'}>
      <AdminSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        locale={locale}
        isRTL={isRTL}
        onOpenCmd={() => setCmdOpen(true)}
      />
      <div
        className={`flex-1 flex flex-col transition-all duration-300 min-w-0 ${
          isRTL
            ? collapsed ? 'mr-16' : 'mr-60'
            : collapsed ? 'ml-16' : 'ml-60'
        }`}
      >
        <AdminHeader
          user={user}
          title={title}
          locale={locale}
          onToggleLocale={toggleLocale}
          onOpenCmd={() => setCmdOpen(true)}
        />
        <main className="flex-1 overflow-auto p-6">
          <AdminLocaleProvider locale={locale}>
            {children}
          </AdminLocaleProvider>
        </main>
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} locale={locale} />
    </div>
  )
}
