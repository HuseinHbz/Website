import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

type PaddingSize = 'none' | 'sm' | 'md' | 'lg'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: PaddingSize
  hover?: boolean
  bordered?: boolean
  /** Persistent (not just on-hover) accent-tinted border + soft glow — the
   * neon-card treatment used across the redesigned marketing sections. */
  glow?: boolean
}

const paddingClasses: Record<PaddingSize, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    { padding = 'md', hover = false, bordered = true, glow = false, className, children, ...props },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-surface rounded-xl',
          bordered && (glow ? 'border border-accent/20' : 'border border-border'),
          glow && 'shadow-lg shadow-accent/5',
          hover &&
            'transition-all duration-300 hover:border-accent/40 hover:shadow-lg hover:shadow-accent/10 hover:-translate-y-0.5',
          paddingClasses[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'
