import { cn } from '@/lib/utils'

// ── Skeleton base ─────────────────────────────────────────────────────────────

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number
  height?: string | number
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

export function Skeleton({ width, height, rounded = 'md', className, style, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('skeleton', {
        'rounded-sm': rounded === 'sm',
        'rounded-md': rounded === 'md',
        'rounded-lg': rounded === 'lg',
        'rounded-xl': rounded === 'xl',
        'rounded-full': rounded === 'full',
      }, className)}
      style={{ width, height, ...style }}
      aria-hidden="true"
      {...props}
    />
  )
}

// ── Preset skeletons ──────────────────────────────────────────────────────────

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={14}
          width={i === lines - 1 ? '70%' : '100%'}
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('bg-surface border border-border rounded-xl p-5 space-y-4', className)} aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton width={40} height={40} rounded="lg" />
        <div className="flex-1 space-y-2">
          <Skeleton height={14} width="60%" />
          <Skeleton height={12} width="40%" />
        </div>
      </div>
      <SkeletonText lines={2} />
      <div className="flex gap-2 pt-1">
        <Skeleton width={80} height={32} rounded="lg" />
        <Skeleton width={80} height={32} rounded="lg" />
      </div>
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden border border-border rounded-xl" aria-hidden>
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 bg-surface-2 border-b border-border">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height={12} className="flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3.5 border-b border-border last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height={13} className="flex-1" style={{ opacity: 1 - r * 0.1 }} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Loading spinner ───────────────────────────────────────────────────────────

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export function Spinner({ size = 'md', className }: { size?: SpinnerSize; className?: string }) {
  const s: Record<SpinnerSize, string> = {
    xs: 'w-3 h-3 border',
    sm: 'w-4 h-4 border',
    md: 'w-5 h-5 border-2',
    lg: 'w-7 h-7 border-2',
    xl: 'w-10 h-10 border-2',
  }
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block rounded-full border-current border-t-transparent animate-spin',
        s[size],
        className,
      )}
    />
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon && (
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 text-3xl
          bg-surface-2 border border-border text-text-tertiary">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-text-primary mb-2">{title}</h3>
      {description && <p className="text-sm text-text-secondary max-w-sm leading-relaxed mb-6">{description}</p>}
      {action}
    </div>
  )
}

// ── Error state ───────────────────────────────────────────────────────────────

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 text-3xl
        bg-danger-muted border border-danger/20 text-danger-text">
        ✕
      </div>
      <h3 className="text-base font-semibold text-text-primary mb-2">{title}</h3>
      {description && <p className="text-sm text-text-secondary max-w-sm mb-6">{description}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand text-white hover:bg-brand-hover transition-all duration-fast"
        >
          Try again
        </button>
      )}
    </div>
  )
}
