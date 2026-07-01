import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

// ── Base Card ────────────────────────────────────────────────────────────────

export type CardVariant = 'surface' | 'elevated' | 'glass' | 'enterprise' | 'metric' | 'flat'
export type CardPadding = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  padding?: CardPadding
  hover?: boolean
  as?: 'div' | 'article' | 'section' | 'li'
}

const variants: Record<CardVariant, string> = {
  surface:    'bg-surface border border-border rounded-xl',
  elevated:   'bg-surface-2 border border-border rounded-xl shadow-md',
  glass:      'glass-card',
  enterprise: 'enterprise-card',
  metric:     'metric-card',
  flat:       'bg-transparent',
}

const paddings: Record<CardPadding, string> = {
  none: '',
  xs:   'p-3',
  sm:   'p-4',
  md:   'p-5',
  lg:   'p-6',
  xl:   'p-8',
}

const hoverClass: Record<CardVariant, string> = {
  surface:    'transition-all duration-moderate ease-spring hover:border-border-strong hover:shadow-md hover:-translate-y-0.5',
  elevated:   'transition-all duration-moderate ease-spring hover:shadow-lg hover:-translate-y-0.5',
  glass:      'glass-card-hover',
  enterprise: '', // already has hover built in
  metric:     '', // already has hover built in
  flat:       '',
}

export const Card = forwardRef<HTMLDivElement, CardProps>(({
  variant = 'surface',
  padding = 'md',
  hover = false,
  as: _as = 'div',
  className,
  children,
  ...props
}, ref) => (
  <div
    ref={ref}
    className={cn(
      variants[variant],
      paddings[padding],
      hover && hoverClass[variant],
      className,
    )}
    {...props}
  >
    {children}
  </div>
))
Card.displayName = 'Card'

// ── Stat Card ────────────────────────────────────────────────────────────────

export interface StatCardProps {
  label: string
  value: string | number
  delta?: string
  deltaPositive?: boolean
  icon?: React.ReactNode
  accentColor?: string
  trend?: number[]
  className?: string
}

export function StatCard({ label, value, delta, deltaPositive = true, icon, accentColor, className }: StatCardProps) {
  return (
    <div
      className={cn('metric-card', className)}
      style={accentColor ? { '--card-accent': accentColor } as React.CSSProperties : undefined}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-overline">{label}</p>
        {icon && (
          <span className="text-lg text-text-tertiary" aria-hidden>{icon}</span>
        )}
      </div>
      <p className="text-3xl font-bold text-text-primary tracking-tight">{value}</p>
      {delta && (
        <p className={cn(
          'text-xs font-medium mt-2 flex items-center gap-1',
          deltaPositive ? 'text-success-text' : 'text-danger-text',
        )}>
          <span aria-hidden>{deltaPositive ? '↑' : '↓'}</span>
          {delta}
        </p>
      )}
    </div>
  )
}

// ── Feature Card ─────────────────────────────────────────────────────────────

export interface FeatureCardProps {
  icon: React.ReactNode
  title: string
  description: string
  badge?: string
  className?: string
}

export function FeatureCard({ icon, title, description, badge, className }: FeatureCardProps) {
  return (
    <div className={cn('service-card', className)}>
      {badge && (
        <span className="absolute top-4 right-4 text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-muted text-brand-hover border border-brand/20">
          {badge}
        </span>
      )}
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-2xl
        bg-brand-subtle border border-brand/10">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-text-primary mb-2 tracking-tight">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
    </div>
  )
}
