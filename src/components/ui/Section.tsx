import { cn } from '@/lib/utils'

type SectionVariant = 'default' | 'surface' | 'gradient'

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  variant?: SectionVariant
  container?: boolean
  as?: 'section' | 'div' | 'article'
}

const variantClasses: Record<SectionVariant, string> = {
  default: 'bg-background',
  surface: 'bg-surface',
  gradient: 'bg-gradient-to-b from-background to-surface',
}

export function Section({
  variant = 'default',
  container = true,
  as: Tag = 'section',
  className,
  children,
  ...props
}: SectionProps) {
  return (
    <Tag
      className={cn('section-padding', variantClasses[variant], className)}
      {...props}
    >
      {container ? (
        <div className="container-site">{children}</div>
      ) : (
        children
      )}
    </Tag>
  )
}
