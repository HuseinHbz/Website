import { cn } from '@/lib/utils'

export interface SectionHeadingProps {
  eyebrow?: string
  title: string
  subtitle?: string
  align?: 'start' | 'center' | 'end'
  className?: string
  locale?: string
}

const alignClasses = {
  start: 'text-start',
  center: 'text-center',
  end: 'text-end',
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'center',
  className,
  locale,
}: SectionHeadingProps) {
  const isRTL = locale === 'fa'
  const effectiveAlign = isRTL && align === 'start' ? 'start' : align

  return (
    <div
      className={cn(
        'mb-12',
        alignClasses[effectiveAlign],
        className
      )}
    >
      {eyebrow && (
        <p className="text-sm font-medium text-accent uppercase tracking-widest mb-3">
          {eyebrow}
        </p>
      )}
      <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-text-primary mb-4 text-balance">
        {title}
      </h2>
      {subtitle && (
        <p className="text-base md:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  )
}
