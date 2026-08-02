'use client'

import { useState, useEffect } from 'react'
import { setDefaultCurrency, setDefaultLocale } from '@/lib/format'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { AdminSidebar } from './AdminSidebar'
import { AdminHeader } from './AdminHeader'
import { CommandPalette } from './CommandPalette'
import { Breadcrumb } from './Breadcrumb'
import { AdminLocaleProvider } from '@/lib/admin/locale'
import { NavPrefsProvider } from '@/lib/admin/navPrefs'
import { CurrencyDisplayProvider } from '@/lib/admin/currencyDisplay'
import type { AdminUser } from '@/lib/admin/auth'

interface Props {
  user: AdminUser
  title: string
  children: React.ReactNode
}

export function AdminShell({ user, title, children }: Props) {
  // Currency formatting standard (26.7): configure fmtMoney from ERP settings.
  useEffect(() => {
    fetch('/api/admin/erp/settings').then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setDefaultCurrency(d.displayCurrency || d.defaultCurrency, d.decimalPrecision) })
      .catch(() => {})
  }, [])
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [locale, setLocale] = useState<'fa' | 'en'>('fa')
  const [cmdOpen, setCmdOpen] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('admin_locale') as 'fa' | 'en' | null
    if (stored) setLocale(stored)
  }, [])

  // BUG-018 (26.26b): shape money digits to match the UI locale (fa → Persian digits).
  useEffect(() => { setDefaultLocale(locale) }, [locale])

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
    <NavPrefsProvider>
    <div className="min-h-screen bg-background text-text-primary flex" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Skip navigation link (WCAG) */}
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:start-2 focus:bg-brand focus:text-text-primary focus:px-3 focus:py-2 focus:rounded-lg">
        {isRTL ? 'پرش به محتوا' : 'Skip to content'}
      </a>
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
        role={user.role}
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
        <main id="admin-main" className="flex-1 overflow-auto p-4 lg:p-6">
          <AdminLocaleProvider locale={locale}>
            <CurrencyDisplayProvider userId={user.id}>
              <TwoFaGate locale={locale} />
              <Breadcrumb locale={locale} />
              {children}
            </CurrencyDisplayProvider>
          </AdminLocaleProvider>
        </main>
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} locale={locale} role={user.role} />
    </div>
    </NavPrefsProvider>
  )
}

/**
 * 26.28 بند ۱.۵ — mandatory-2FA gateway. When the policy is on and the signed-in
 * user holds a financial-sensitive op without TOTP enabled, a blocking banner
 * pushes them to Security to enable it (their sensitive ops already 403).
 */
function TwoFaGate({ locale }: { locale: 'fa' | 'en' }) {
  const [needed, setNeeded] = useState(false)
  useEffect(() => {
    let alive = true
    fetch('/api/admin/auth/me').then(r => r.ok ? r.json() : null)
      .then(j => { if (alive && j?.needs2fa) setNeeded(true) })
      .catch(() => null)
    return () => { alive = false }
  }, [])
  if (!needed) return null
  return (
    <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 flex items-center justify-between gap-4" role="alert">
      <div>
        <p className="text-sm font-bold text-red-400">
          {locale === 'fa' ? 'فعال‌سازی ورود دومرحله‌ای الزامی است' : 'Two-factor authentication is required'}
        </p>
        <p className="text-xs text-text-secondary mt-1">
          {locale === 'fa'
            ? 'حساب شما عملیات مالی حساس دارد؛ تا فعال‌سازی 2FA این عملیات مسدود (۴۰۳) هستند.'
            : 'Your account holds sensitive financial operations; they stay blocked (403) until you enable 2FA.'}
        </p>
      </div>
      <Link href="/admin/security" className="shrink-0 px-3 py-2 rounded-lg bg-red-500/20 text-red-300 text-xs font-bold hover:bg-red-500/30 transition-colors">
        {locale === 'fa' ? 'فعال‌سازی 2FA ←' : 'Enable 2FA →'}
      </Link>
    </div>
  )
}
