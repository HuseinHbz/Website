'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/Card'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { staggerContainer, slideUp } from '@/lib/motion'
import { SITE } from '@/lib/site'
import { cn } from '@/lib/utils'

interface ServicesSnapshotProps {
  locale: string
}

function CloudIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

function ConsultingIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function NetworkIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  )
}

const serviceKeys = ['cloud', 'security', 'consulting', 'network'] as const
const serviceIcons = {
  cloud: CloudIcon,
  security: ShieldIcon,
  consulting: ConsultingIcon,
  network: NetworkIcon,
}

export function ServicesSnapshot({ locale }: ServicesSnapshotProps) {
  const t = useTranslations('services')
  const isRTL = locale === 'fa'

  function buildPath(path: string) {
    return `/${locale}${path}`
  }

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
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
        >
          {serviceKeys.map((key) => {
            const Icon = serviceIcons[key]
            return (
              <motion.div key={key} variants={slideUp}>
                <Card hover padding="lg" className="h-full flex flex-col group">
                  <div className={cn(
                    'mb-4 w-12 h-12 rounded-xl flex items-center justify-center',
                    'bg-accent/10 text-accent',
                    'group-hover:bg-accent/20 transition-colors duration-300'
                  )}>
                    <Icon />
                  </div>
                  <h3 className="text-base font-semibold text-text-primary mb-2">
                    {t(`${key}.title` as Parameters<typeof t>[0])}
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed flex-1">
                    {t(`${key}.desc` as Parameters<typeof t>[0])}
                  </p>
                  <Link
                    href={buildPath('/consultation')}
                    className={cn(
                      'mt-4 text-sm font-medium text-accent hover:text-accent-hover',
                      'inline-flex items-center gap-1 transition-colors duration-150',
                      'group/link'
                    )}
                  >
                    {t('readMore')}
                    <svg
                      className={cn(
                        'w-3.5 h-3.5 transition-transform duration-150',
                        isRTL
                          ? 'group-hover/link:-translate-x-0.5 rotate-180'
                          : 'group-hover/link:translate-x-0.5'
                      )}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
