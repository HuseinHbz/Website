import { cn } from '@/lib/utils'

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger'

export interface AlertProps {
  variant?: AlertVariant
  title?: string
  children: React.ReactNode
  icon?: React.ReactNode
  onClose?: () => void
  className?: string
}

const styles: Record<AlertVariant, { container: string; icon: string; defaultIcon: string }> = {
  info: {
    container: 'bg-info-muted border-info/20 text-text-primary',
    icon:      'text-info-text',
    defaultIcon: 'ℹ',
  },
  success: {
    container: 'bg-success-muted border-success/20 text-text-primary',
    icon:      'text-success-text',
    defaultIcon: '✓',
  },
  warning: {
    container: 'bg-warning-muted border-warning/20 text-text-primary',
    icon:      'text-warning-text',
    defaultIcon: '⚠',
  },
  danger: {
    container: 'bg-danger-muted border-danger/20 text-text-primary',
    icon:      'text-danger-text',
    defaultIcon: '✕',
  },
}

export function Alert({ variant = 'info', title, children, icon, onClose, className }: AlertProps) {
  const s = styles[variant]
  return (
    <div
      role="alert"
      className={cn(
        'flex gap-3 p-4 rounded-xl border',
        s.container,
        className,
      )}
    >
      <span className={cn('text-sm font-bold mt-0.5 shrink-0', s.icon)} aria-hidden>
        {icon ?? s.defaultIcon}
      </span>
      <div className="flex-1 min-w-0">
        {title && <p className="text-sm font-semibold mb-0.5">{title}</p>}
        <div className="text-sm text-text-secondary leading-relaxed">{children}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Dismiss alert"
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-white/5 transition-all duration-fast"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M4.28 3.22a.75.75 0 0 0-1.06 1.06L6.94 8l-3.72 3.72a.75.75 0 1 0 1.06 1.06L8 9.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L9.06 8l3.72-3.72a.75.75 0 0 0-1.06-1.06L8 6.94 4.28 3.22z"/>
          </svg>
        </button>
      )}
    </div>
  )
}

// ── Progress Bar ──────────────────────────────────────────────────────────────

export interface ProgressProps {
  value: number
  max?: number
  label?: string
  showValue?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
  variant?: 'brand' | 'success' | 'warning' | 'danger'
  animated?: boolean
  className?: string
}

const progressVariants: Record<string, string> = {
  brand:   'bg-brand',
  success: 'bg-success',
  warning: 'bg-warning',
  danger:  'bg-danger',
}

const progressSizes: Record<string, string> = {
  xs: 'h-1',
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-3',
}

export function Progress({ value, max = 100, label, showValue = false, size = 'md', variant = 'brand', animated = false, className }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-caption">{label}</span>}
          {showValue && <span className="text-caption font-medium">{Math.round(pct)}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        className={cn('w-full rounded-full bg-surface-2 overflow-hidden', progressSizes[size])}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-slow ease-spring',
            progressVariants[variant],
            animated && 'animate-pulse-glow',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
