'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { getInitials } from '@/lib/utils'
import type { User } from '@/lib/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'

interface TopBarProps {
  user: User
  title?: string
}

export function TopBar({ user, title }: TopBarProps) {
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await fetch(`${API_URL}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // ignore
    }
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 bg-surface border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
      {/* Left: title or breadcrumb */}
      <div className="flex items-center gap-3 ml-10 lg:ml-0">
        {title && (
          <h2 className="text-sm font-semibold text-text-secondary hidden sm:block">
            {title}
          </h2>
        )}
      </div>

      {/* Right: user info + logout */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">
            {getInitials(user.name)}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-medium text-text-primary leading-none">{user.name}</p>
            <p className="text-xs text-text-muted leading-none mt-0.5">{user.email}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          <span className="hidden sm:inline">{loggingOut ? 'Logging out...' : 'Logout'}</span>
        </button>
      </div>
    </header>
  )
}
