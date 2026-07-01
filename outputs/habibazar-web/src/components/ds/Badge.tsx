import { cn } from '@/lib/utils'

export type BadgeVariant = 'default' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'outline'
export type BadgeSize = 'xs' | 'sm' | 'md'

export interface BadgeProps {
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean
  pulse?: boolean
  children: React.ReactNode
  className?: string
}

const variants: Record<BadgeVariant, string> = {
  default: 'bg-surface-2 text-text-secondary border border-border',
  brand:   'bg-brand-muted text-brand-hover border border-brand/20',
  success: 'bg-success-muted text-success-text border border-success/20',
  warning: 'bg-warning-muted text-warning-text border border-warning/20',
  danger:  'bg-danger-muted  text-danger-text  border border-danger/20',
  info:    'bg-info-muted    text-info-text    border border-info/20',
  outline: 'bg-transparent   text-text-secondary border border-border-strong',
}

const sizes: Record<BadgeSize, string> = {
  xs: 'text-2xs px-1.5 py-0.5 rounded gap-1',
  sm: 'text-xs  px-2   py-0.5 rounded-md gap-1',
  md: 'text-xs  px-2.5 py-1   rounded-lg gap-1.5',
}

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-text-tertiary',
  brand:   'bg-brand',
  success: 'bg-success',
  warning: 'bg-warning',
  danger:  'bg-danger',
  info:    'bg-info',
  outline: 'bg-text-tertiary',
}

export function Badge({ variant = 'default', size = 'sm', dot = false, pulse = false, children, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center font-semibold leading-none tracking-wide select-none',
      variants[variant],
      sizes[size],
      className,
    )}>
      {dot && (
        <span className={cn(
          'w-1.5 h-1.5 rounded-full shrink-0',
          dotColors[variant],
          pulse && 'animate-[pulse_2s_ease-in-out_infinite]',
        )} aria-hidden />
      )}
      {children}
    </span>
  )
}

// Status tag with dot
export function StatusBadge({ status, label }: { status: 'online' | 'offline' | 'warning' | 'idle'; label?: string }) {
  const map = {
    online:  { variant: 'success' as BadgeVariant, label: label || 'Online' },
    offline: { variant: 'danger'  as BadgeVariant, label: label || 'Offline' },
    warning: { variant: 'warning' as BadgeVariant, label: label || 'Warning' },
    idle:    { variant: 'default' as BadgeVariant, label: label || 'Idle' },
  }
  const { variant, label: l } = map[status]
  return <Badge variant={variant} dot pulse={status === 'online'}>{l}</Badge>
}

// Tech/skill chip
export function Chip({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5',
        'text-xs font-medium rounded-full',
        'bg-surface-2 text-text-secondary border border-border',
        'transition-all duration-fast',
        onClick && 'cursor-pointer hover:border-brand/40 hover:text-text-primary hover:bg-brand-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        className,
      )}
    >
      {children}
    </Tag>
  )
}
