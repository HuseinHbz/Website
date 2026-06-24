'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { slideUp, staggerContainer } from '@/lib/motion'
import { SITE } from '@/lib/site'
import { cn } from '@/lib/utils'

interface ClosingCtaProps {
  locale: string
}

export function ClosingCta({ locale }: ClosingCtaProps) {
  const t = useTranslations('closingCta')

  function buildPath(path: string) {
    if (locale === SITE.locale.default) return path
    return `/${locale}${path}`
  }

  return (
    <section className="section-padding bg-surface relative overflow-hidden">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        aria-hidden="true"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(99,102,241,0.8) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Top glow */}
      <div
        className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent"
        aria-hidden="true"
      />

      <div className="container-site relative z-10">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto"
        >
          <motion.h2
            variants={slideUp}
            className="text-2xl md:text-3xl lg:text-4xl font-bold text-text-primary mb-4 text-balance"
          >
            {t('title')}
          </motion.h2>

          <motion.p
            variants={slideUp}
            className="text-base md:text-lg text-text-secondary leading-relaxed mb-8"
          >
            {t('subtitle')}
          </motion.p>

          <motion.div
            variants={slideUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                window.location.href = buildPath('/consultation')
              }}
            >
              {t('ctaPrimary')}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                window.location.href = buildPath('/consultation/intro-call')
              }}
            >
              {t('ctaSecondary')}
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
