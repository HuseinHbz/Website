'use client'

import { cn } from '@/lib/utils'

export interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  siblingCount?: number
  className?: string
}

function range(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

function getPages(page: number, total: number, siblings: number): (number | '...')[] {
  const totalNumbers = siblings * 2 + 5
  if (total <= totalNumbers) return range(1, total)

  const leftSibling = Math.max(page - siblings, 1)
  const rightSibling = Math.min(page + siblings, total)

  const showLeft = leftSibling > 2
  const showRight = rightSibling < total - 1

  if (!showLeft && showRight) {
    return [...range(1, 3 + siblings * 2), '...', total]
  }
  if (showLeft && !showRight) {
    return [1, '...', ...range(total - (3 + siblings * 2) + 1, total)]
  }
  return [1, '...', ...range(leftSibling, rightSibling), '...', total]
}

const btnBase = cn(
  'inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-medium',
  'transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background',
)

export function Pagination({ page, totalPages, onPageChange, siblingCount = 1, className }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages = getPages(page, totalPages, siblingCount)

  return (
    <nav aria-label="Pagination" className={cn('flex items-center gap-1', className)}>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
        className={cn(btnBase, 'text-text-tertiary hover:text-text-primary hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed')}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <path d="M9.78 4.22a.75.75 0 0 1 0 1.06L6.56 8.5l3.22 3.22a.75.75 0 1 1-1.06 1.06L4.94 9.06a.75.75 0 0 1 0-1.06l3.78-3.78a.75.75 0 0 1 1.06 0z"/>
        </svg>
      </button>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="w-9 h-9 flex items-center justify-center text-sm text-text-disabled">
            ···
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            aria-current={p === page ? 'page' : undefined}
            aria-label={`Page ${p}`}
            className={cn(
              btnBase,
              p === page
                ? 'bg-brand text-white shadow-brand'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-2',
            )}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
        className={cn(btnBase, 'text-text-tertiary hover:text-text-primary hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed')}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <path d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.78 3.78a.75.75 0 0 1 0 1.06l-3.78 3.78a.75.75 0 0 1-1.06-1.06L9.44 8.5 6.22 5.28a.75.75 0 0 1 0-1.06z"/>
        </svg>
      </button>
    </nav>
  )
}
