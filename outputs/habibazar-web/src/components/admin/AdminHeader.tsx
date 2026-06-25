'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminUser } from '@/lib/admin/auth'

interface Props {
  user: AdminUser
  title: string
}

export function AdminHeader({ user, title }: Props) {
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
  const roleLabel: Record<string, string> = {
    super_admin: 'Super Admin',
    administrator: 'Administrator',
    editor: 'Editor',
  }

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-[#1e1e2e] bg-[#0c0c14]/80 backdrop-blur-sm">
      <h1 className="text-base font-semibold text-white">{title}</h1>
      <div className="flex items-center gap-4">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${roleColors[user.role] || 'text-slate-400 bg-slate-400/10'}`}>
          {roleLabel[user.role] || user.role}
        </span>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm text-slate-300 hidden md:block">{user.name}</span>
        </div>
        <button
          onClick={handleLogout}
          disabled={loading}
          className="text-xs text-slate-500 hover:text-red-400 transition-colors px-2 py-1 rounded"
        >
          {loading ? '...' : 'Sign Out'}
        </button>
      </div>
    </header>
  )
}
