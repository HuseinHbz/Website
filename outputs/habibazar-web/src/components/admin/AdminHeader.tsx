'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { AdminUser } from '@/lib/admin/auth'

interface Notification {
  id: string
  type: 'contact' | 'consultation' | 'security' | 'system' | 'info'
  titleEn: string
  titleFa: string
  time: string
  read: boolean
}

const TYPE_ICON: Record<string, string> = {
  contact: '✉',
  consultation: '📅',
  security: '🔐',
  system: '⚙',
  info: 'ℹ',
}
const TYPE_COLOR: Record<string, string> = {
  contact: 'text-blue-400',
  consultation: 'text-green-400',
  security: 'text-red-400',
  system: 'text-text-secondary',
  info: 'text-brand',
}

interface Props {
  user: AdminUser
  title: string
  locale: 'fa' | 'en'
  onToggleLocale: () => void
  onOpenCmd: () => void
  onMobileOpen?: () => void
}

export function AdminHeader({ user, title, locale, onToggleLocale, onOpenCmd, onMobileOpen }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const isRTL = locale === 'fa'

  const unread = notifications.filter(n => !n.read).length

  async function handleLogout() {
    setLoading(true)
    await fetch('/api/admin/auth/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  const roleColors: Record<string, string> = {
    super_admin: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    administrator: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    editor: 'text-green-400 bg-green-400/10 border-green-400/20',
  }
  const roleLabel: Record<string, Record<string, string>> = {
    fa: { super_admin: 'ادمین ارشد', administrator: 'مدیر', editor: 'ویرایشگر' },
    en: { super_admin: 'Super Admin', administrator: 'Administrator', editor: 'Editor' },
  }

  return (
    <header className="h-14 flex items-center justify-between px-4 lg:px-6 border-b border-border bg-surface-2/80 backdrop-blur-sm flex-shrink-0 gap-3 relative z-40">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile hamburger */}
        <button
          onClick={onMobileOpen}
          className="lg:hidden p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-all flex-shrink-0 min-w-[40px] min-h-[40px] flex items-center justify-center"
          aria-label={isRTL ? 'باز کردن منو' : 'Open sidebar'}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-text-primary truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Command Palette button */}
        <button
          onClick={onOpenCmd}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-text-muted hover:text-text-primary transition-all"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          title={isRTL ? 'جستجوی سریع (Ctrl+K)' : 'Quick search (Ctrl+K)'}
        >
          <span>🔍</span>
          <span className="hidden lg:inline">{isRTL ? 'جستجو...' : 'Search...'}</span>
          <kbd className="text-[10px] px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>⌘K</kbd>
        </button>

        {/* Locale toggle */}
        <button
          onClick={onToggleLocale}
          className="text-xs font-bold px-2 py-1 rounded border border-border text-text-secondary hover:text-white hover:border-brand transition-all"
        >
          {locale === 'fa' ? 'EN' : 'FA'}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(v => !v)}
            className="relative w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-white hover:bg-white/5 transition-all"
          >
            🔔
            {unread > 0 && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center bg-brand text-white">
                {unread}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
              <div
                className="absolute top-10 z-50 w-80 rounded-xl overflow-hidden shadow-2xl"
                style={{ [isRTL ? 'left' : 'right']: 0, background: '#0e0e1a', border: '1px solid rgba(99,102,241,0.2)' }}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <p className="text-sm font-semibold text-white">{isRTL ? 'اعلان‌ها' : 'Notifications'}</p>
                  {unread > 0 && (
                    <button
                      onClick={() => setNotifications(n => n.map(x => ({ ...x, read: true })))}
                      className="text-xs text-brand hover:text-brand"
                    >
                      {isRTL ? 'همه خواندم' : 'Mark all read'}
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 && (
                    <p className="px-4 py-6 text-center text-xs text-text-tertiary">
                      {isRTL ? 'اعلان جدیدی نیست' : 'No new notifications'}
                    </p>
                  )}
                  {notifications.map(n => (
                    <div
                      key={n.id}
                      className="flex items-start gap-3 px-4 py-3 border-b transition-colors"
                      style={{
                        borderColor: 'rgba(255,255,255,0.04)',
                        background: n.read ? 'transparent' : 'rgba(99,102,241,0.05)',
                      }}
                    >
                      <span className={`mt-0.5 shrink-0 ${TYPE_COLOR[n.type]}`}>{TYPE_ICON[n.type]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-text-primary leading-snug">{isRTL ? n.titleFa : n.titleEn}</p>
                        <p className="text-[10px] text-text-tertiary mt-0.5">{n.time}</p>
                      </div>
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />}
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2 text-center">
                  <Link href="/admin/audit" onClick={() => setNotifOpen(false)} className="text-xs text-brand hover:text-brand">
                    {isRTL ? 'مشاهده همه فعالیت‌ها' : 'View all activity'}
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Role badge */}
        <span className={`text-xs px-2 py-1 rounded-full font-medium border hidden md:inline-flex ${roleColors[user.role] || 'text-text-secondary bg-slate-400/10 border-slate-400/20'}`}>
          {roleLabel[locale][user.role] || user.role}
        </span>

        {/* User */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm text-text-primary hidden lg:block max-w-[100px] truncate">{user.name}</span>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          disabled={loading}
          className="text-xs text-text-muted hover:text-red-400 transition-colors px-2 py-1 rounded"
        >
          {loading ? '...' : isRTL ? 'خروج' : 'Sign Out'}
        </button>
      </div>
    </header>
  )
}
