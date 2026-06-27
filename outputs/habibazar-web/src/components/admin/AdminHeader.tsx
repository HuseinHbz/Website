'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminUser } from '@/lib/admin/auth'

interface Props {
  user: AdminUser
  title: string
  locale: 'fa' | 'en'
  onToggleLocale: () => void
}

export function AdminHeader({ user, title, locale, onToggleLocale }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    await fetch('/api/admin/auth/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  const roleColors: Record<string, string> = {
    super_admin: 'text-yellow-400 bg-yellow-400/10',
    administrator: 'text-blue-400 bg-blue-400/10',
    editor: 'text-green-400 bg-green-400/10',
  }
  const roleLabel: Record<string, Record<string, string>> = {
    fa: { super_admin: 'ادمین ارشد', administrator: 'مدیر', editor: 'ویرایشگر' },
    en: { super_admin: 'Super Admin', administrator: 'Administrator', editor: 'Editor' },
  }

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-[#1e1e2e] bg-[#0c0c14]/80 backdrop-blur-sm flex-shrink-0">
      <h1 className="text-base font-semibold text-white">{title}</h1>
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleLocale}
          className="text-xs font-bold px-2 py-1 rounded border border-[#2a2a3e] text-slate-400 hover:text-white hover:border-indigo-500 transition-all"
          title={locale === 'fa' ? 'Switch to English' : 'تغییر به فارسی'}
        >
          {locale === 'fa' ? 'EN' : 'FA'}
        </button>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${roleColors[user.role] || 'text-slate-400 bg-slate-400/10'}`}>
          {roleLabel[locale][user.role] || user.role}
        </span>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm text-slate-300 hidden md:block">{user.name}</span>
        </div>
        <button
          onClick={handleLogout}
          disabled={loading}
          className="text-xs text-slate-500 hover:text-red-400 transition-colors px-2 py-1 rounded"
        >
          {loading ? '...' : locale === 'fa' ? 'خروج' : 'Sign Out'}
        </button>
      </div>
    </header>
  )
}
