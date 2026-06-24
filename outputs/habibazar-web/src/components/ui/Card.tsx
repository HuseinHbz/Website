import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

type PaddingSize = 'none' | 'sm' | 'md' | 'lg'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: PaddingSize
  hover?: boolean
  bordered?: boolean
}

const paddingClasses: Record<PaddingSize, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    { padding = 'md', hover = false, bordered = true, className, children, ...props },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-surface rounded-xl',
          bordered && 'border border-border',
          hover &&
            'transition-all duration-300 hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 hover:-translate-y-0.5',
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
