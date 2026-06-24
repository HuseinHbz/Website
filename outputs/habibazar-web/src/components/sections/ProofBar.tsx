'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { staggerContainer, scaleIn } from '@/lib/motion'

interface ProofBarProps {
  locale: string
}

interface StatItem {
  valueKey: string
  labelKey: string
}

const stats: StatItem[] = [
  { valueKey: 'experienceValue', labelKey: 'experience' },
  { valueKey: 'projectsValue', labelKey: 'projects' },
  { valueKey: 'sectorsValue', labelKey: 'sectors' },
  { valueKey: 'uptimeValue', labelKey: 'uptime' },
]

export function ProofBar({ locale }: ProofBarProps) {
  const t = useTranslations('proof')

  return (
    <section className="bg-surface border-y border-border" aria-label={locale === 'fa' ? 'آمار و دستاوردها' : 'Key metrics'}>
      <div className="container-site py-10">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0 md:divide-x md:divide-border rtl:divide-x-reverse"
        >
          {stats.map((stat) => (
            <motion.div
              key={stat.labelKey}
              variants={scaleIn}
              className="flex flex-col items-center text-center px-4 py-2"
            >
              <span className="text-3xl md:text-4xl font-bold text-text-primary mb-1 tabular-nums">
                {t(stat.valueKey as Parameters<typeof t>[0])}
              </span>
              <span className="text-sm text-text-secondary">
                {t(stat.labelKey as Parameters<typeof t>[0])}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
