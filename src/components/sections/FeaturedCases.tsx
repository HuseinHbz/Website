'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/Card'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { staggerContainer, slideUp } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface FeaturedCasesProps {
  locale: string
}

const caseKeys = ['case1', 'case2', 'case3'] as const

const industryColors: Record<string, string> = {
  default: 'bg-accent/10 text-accent',
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-4 h-4', className)}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 8l4 4m0 0l-4 4m4-4H3"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      className="w-4 h-4 text-success flex-shrink-0 mt-0.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  )
}

export function FeaturedCases({ locale }: FeaturedCasesProps) {
  const t = useTranslations('cases')
  const isRTL = locale === 'fa'

  return (
    <section className="section-padding bg-background">
      <div className="container-site">
        <SectionHeading
          eyebrow={t('title')}
          title={t('subtitle')}
          locale={locale}
        />

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-5"
        >
          {caseKeys.map((key) => (
            <motion.div key={key} variants={slideUp} className="h-full">
              <Card hover padding="lg" className="h-full flex flex-col group">
                {/* Industry badge */}
                <div className="mb-4">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-accent/10 text-accent">
                    {t(`${key}.industry` as Parameters<typeof t>[0])}
                  </span>
                </div>

                {/* Challenge */}
                <div className="mb-4 flex-1">
                  <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-2">
                    {isRTL ? 'چالش' : 'Challenge'}
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {t(`${key}.challenge` as Parameters<typeof t>[0])}
                  </p>
                </div>

                {/* Outcome */}
                <div className={cn(
                  'mt-auto pt-4 border-t border-border',
                  'flex items-start gap-2'
                )}>
                  <CheckIcon />
                  <p className="text-sm font-medium text-success">
                    {t(`${key}.outcome` as Parameters<typeof t>[0])}
                  </p>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
