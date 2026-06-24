'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Pagination as PaginationType } from '@/lib/types'

interface PaginationProps {
  pagination: PaginationType
}

export function Pagination({ pagination }: PaginationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const { page, pages, total, hasNext, hasPrev } = pagination

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(p))
    router.push(`${pathname}?${params.toString()}`)
  }

  if (pages <= 1) return null

  // Build page numbers to show (window of 5 around current)
  const pageNumbers: (number | '...')[] = []
  if (pages <= 7) {
    for (let i = 1; i <= pages; i++) pageNumbers.push(i)
  } else {
    pageNumbers.push(1)
    if (page > 3) pageNumbers.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) {
      pageNumbers.push(i)
    }
    if (page < pages - 2) pageNumbers.push('...')
    pageNumbers.push(pages)
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <p className="text-xs text-text-muted">
        {total} total record{total !== 1 ? 's' : ''}
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => goToPage(page - 1)}
          disabled={!hasPrev}
          className={cn(
            'px-2.5 py-1.5 rounded text-xs transition-colors',
            hasPrev
              ? 'text-text-secondary hover:text-text-primary hover:bg-surface2'
              : 'text-text-muted cursor-not-allowed opacity-40'
          )}
        >
          Previous
        </button>

        {pageNumbers.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-xs text-text-muted">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => goToPage(p)}
              className={cn(
                'w-8 h-8 rounded text-xs font-medium transition-colors',
                p === page
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface2'
              )}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => goToPage(page + 1)}
          disabled={!hasNext}
          className={cn(
            'px-2.5 py-1.5 rounded text-xs transition-colors',
            hasNext
              ? 'text-text-secondary hover:text-text-primary hover:bg-surface2'
              : 'text-text-muted cursor-not-allowed opacity-40'
          )}
        >
          Next
        </button>
      </div>
    </div>
  )
}
