'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { staggerContainer, slideUp } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface TheMethodProps {
  locale: string
}

const steps = ['discovery', 'analysis', 'solution', 'implementation'] as const

function DiscoveryIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function AnalysisIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function SolutionIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  )
}

function ImplementationIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M5 13l4 4L19 7" />
    </svg>
  )
}

const stepIcons = {
  discovery: DiscoveryIcon,
  analysis: AnalysisIcon,
  solution: SolutionIcon,
  implementation: ImplementationIcon,
}

export function TheMethod({ locale }: TheMethodProps) {
  const t = useTranslations('method')

  return (
    <section className="section-padding bg-surface">
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
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative"
        >
          {/* Connector line (desktop) */}
          <div
            className="hidden lg:block absolute top-8 start-[12.5%] end-[12.5%] h-px bg-gradient-to-r from-transparent via-border to-transparent"
            aria-hidden="true"
          />

          {steps.map((step, index) => {
            const Icon = stepIcons[step]
            return (
              <motion.div
                key={step}
                variants={slideUp}
                className="relative flex flex-col items-center text-center"
              >
                {/* Step number + icon */}
                <div className="relative mb-5 z-10">
                  <div className={cn(
                    'w-16 h-16 rounded-2xl flex items-center justify-center',
                    'bg-background border-2 border-accent/30',
                    'shadow-lg shadow-accent/10'
                  )}>
                    <div className="text-accent">
                      <Icon />
                    </div>
                  </div>
                  <span className={cn(
                    'absolute -top-2 -end-2 w-6 h-6 rounded-full',
                    'bg-accent text-white text-xs font-bold',
                    'flex items-center justify-center'
                  )}>
                    {index + 1}
                  </span>
                </div>

                <h3 className="text-base font-semibold text-text-primary mb-2">
                  {t(`${step}.title` as Parameters<typeof t>[0])}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {t(`${step}.desc` as Parameters<typeof t>[0])}
                </p>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
