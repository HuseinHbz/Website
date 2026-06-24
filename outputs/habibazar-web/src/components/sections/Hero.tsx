'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { StatusNode } from '@/components/ui/StatusNode'
import { Button } from '@/components/ui/Button'
import { slideUp, staggerContainer, fadeIn } from '@/lib/motion'
import { SITE } from '@/lib/site'
import { cn } from '@/lib/utils'

interface HeroProps {
  locale: string
}

function buildPath(locale: string, path: string) {
  if (locale === SITE.locale.default) return path
  return `/${locale}${path}`
}

export function Hero({ locale }: HeroProps) {
  const t = useTranslations('hero')
  const isRTL = locale === 'fa'

  return (
    <section
      className={cn(
        'relative min-h-screen flex items-center justify-center overflow-hidden',
        'bg-background pt-16'
      )}
      aria-label={isRTL ? 'بخش اصلی' : 'Hero section'}
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        aria-hidden="true"
        style={{
          backgroundImage: `
            linear-gradient(rgba(99,102,241,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.5) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 70%)',
        }}
      />

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none"
        aria-hidden="true"
      />

      <div className="container-site relative z-10 py-20 text-center">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center gap-6"
        >
          {/* Status */}
          <motion.div variants={fadeIn}>
            <StatusNode label={t('available')} status="available" />
          </motion.div>

          {/* Name */}
          <motion.div variants={slideUp}>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-text-primary tracking-tight">
              {t('name')}
            </h1>
          </motion.div>

          {/* Role */}
          <motion.div variants={slideUp}>
            <p
              className={cn(
                'text-xl sm:text-2xl md:text-3xl font-medium',
                'bg-gradient-to-r from-accent to-accent-hover bg-clip-text text-transparent'
              )}
            >
              {t('role')}
            </p>
          </motion.div>

          {/* Description */}
          <motion.div variants={slideUp} className="max-w-xl md:max-w-2xl">
            <p className="text-base md:text-lg text-text-secondary leading-relaxed text-balance">
              {t('description')}
            </p>
          </motion.div>

          {/* CTAs */}
          <motion.div
            variants={slideUp}
            className="flex flex-col sm:flex-row gap-3 mt-2"
          >
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                window.location.href = buildPath(locale, '/consultation')
              }}
            >
              {t('ctaPrimary')}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                window.location.href = buildPath(
                  locale,
                  '/consultation/intro-call'
                )
              }}
            >
              {t('ctaSecondary')}
            </Button>
          </motion.div>

          {/* Decorative scroll hint */}
          <motion.div
            variants={fadeIn}
            className="mt-12 flex flex-col items-center gap-2 text-text-muted"
            aria-hidden="true"
          >
            <svg
              className="w-5 h-5 animate-bounce"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
