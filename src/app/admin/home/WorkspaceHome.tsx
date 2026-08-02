'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAdminLocale } from '@/lib/admin/locale'
import { WORKSPACES, workspaceHome, visibleWorkspaces, type GrantMap } from '@/lib/admin/workspaces'
import type { AdminUser } from '@/lib/admin/auth'

export function WorkspaceHome({ role }: { role: AdminUser['role'] }) {
  const locale = useAdminLocale()
  const isRTL = locale === 'fa'
  const moduleCount = (w: (typeof WORKSPACES)[number]) => w.groups.reduce((s, g) => s + g.items.length, 0)
  // BUG-011 (26.26): single source of truth — the dashboard grid and the sidebar
  // switcher BOTH read visibleWorkspaces(role); the grid no longer shows every
  // workspace regardless of RBAC (which both leaked unauthorized entries AND made
  // the grid count differ from the role-filtered dropdown).
  // 26.27: tree grants — a none workspace never renders here either.
  const [grants, setGrants] = useState<GrantMap | undefined>(undefined)
  useEffect(() => {
    let alive = true
    fetch('/api/admin/auth/me').then(r => r.ok ? r.json() : null).then(j => {
      if (alive && j?.grants && Object.keys(j.grants).length > 0) setGrants(j.grants)
    }).catch(() => null)
    return () => { alive = false }
  }, [])
  const workspaces = visibleWorkspaces(role, grants)

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{isRTL ? 'فضاهای کاری سازمانی' : 'Enterprise Workspaces'}</h1>
        <p className="text-sm text-text-secondary mt-1">
          {isRTL
            ? 'یک فضای کاری را انتخاب کنید. هر فضا ناوبری، جستجو و داشبورد مستقل خود را دارد.'
            : 'Pick a workspace. Each has its own navigation, search scope and dashboard.'}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {workspaces.map(w => (
          <Link
            key={w.id}
            href={workspaceHome(w)}
            className="group rounded-2xl border border-border bg-surface-2 p-5 hover:border-brand/40 hover:bg-surface transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-xl group-hover:bg-brand/15 transition-colors">{w.icon}</div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-text-primary truncate">{isRTL ? w.nameFa : w.nameEn}</h2>
                <p className="text-xs text-text-tertiary mt-0.5 line-clamp-2">{isRTL ? w.descFa : w.descEn}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-text-tertiary">
              <span>{moduleCount(w)} {isRTL ? 'ماژول' : 'modules'}</span>
              <span className="text-brand opacity-0 group-hover:opacity-100 transition-opacity">{isRTL ? 'ورود ←' : 'Open →'}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
