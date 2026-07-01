import { Fragment } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
  label: string
  href?: string
  icon?: React.ReactNode
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[]
  separator?: React.ReactNode
  className?: string
}

const DefaultSeparator = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden className="text-text-disabled">
    <path d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06L7.28 11.78a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06z"/>
  </svg>
)

export function Breadcrumb({ items, separator, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center', className)}>
      <ol className="flex items-center flex-wrap gap-1">
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <Fragment key={i}>
              <li className="flex items-center">
                {item.href && !isLast ? (
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-1.5 text-sm text-text-tertiary',
                      'hover:text-text-primary transition-colors duration-fast',
                      'focus-visible:outline-none focus-visible:underline',
                    )}
                  >
                    {item.icon && <span className="text-xs" aria-hidden>{item.icon}</span>}
                    {item.label}
                  </Link>
                ) : (
                  <span
                    aria-current={isLast ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-1.5 text-sm',
                      isLast ? 'text-text-primary font-medium' : 'text-text-tertiary',
                    )}
                  >
                    {item.icon && <span className="text-xs" aria-hidden>{item.icon}</span>}
                    {item.label}
                  </span>
                )}
              </li>
              {!isLast && (
                <li aria-hidden className="flex items-center">
                  {separator ?? <DefaultSeparator />}
                </li>
              )}
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
