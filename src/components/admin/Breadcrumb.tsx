'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { breadcrumbFor } from '@/lib/admin/workspaces'

/** Auto-generated breadcrumb: Workspaces › Workspace › Module. */
export function Breadcrumb({ locale }: { locale: 'fa' | 'en' }) {
  const pathname = usePathname()
  if (pathname === '/admin/home') return null
  const crumbs = breadcrumbFor(pathname)
  if (crumbs.length <= 1) return null
  const isRTL = locale === 'fa'
  const sep = isRTL ? '‹' : '›'
  return (
    <nav aria-label={isRTL ? 'مسیر' : 'Breadcrumb'} className="mb-4">
      <ol className="flex items-center gap-1.5 text-xs text-text-tertiary flex-wrap">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          const label = isRTL ? c.labelFa : c.labelEn
          return (
            <li key={`${c.href}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden className="text-text-disabled">{sep}</span>}
              {last
                ? <span className="text-text-secondary font-medium" aria-current="page">{label}</span>
                : <Link href={c.href} className="hover:text-text-primary transition-colors">{label}</Link>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
