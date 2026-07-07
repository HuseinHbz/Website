'use client'

import Link from 'next/link'
import { useAdminLocale } from '@/lib/admin/locale'
import { WORKSPACES, workspaceHome } from '@/lib/admin/workspaces'

export function WorkspaceHome() {
  const locale = useAdminLocale()
  const isRTL = locale === 'fa'
  const moduleCount = (w: (typeof WORKSPACES)[number]) => w.groups.reduce((s, g) => s + g.items.length, 0)

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
        {WORKSPACES.map(w => (
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
