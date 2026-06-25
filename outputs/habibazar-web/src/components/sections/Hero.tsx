'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { NetworkTopology } from './NetworkTopology'
import { Button } from '@/components/ui/Button'
import { StatusNode } from '@/components/ui/StatusNode'
import { slideUp, staggerContainer, fadeIn } from '@/lib/motion'
import { SITE } from '@/lib/site'

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
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref })
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '30%'])
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])

  const METRICS = [
    { value: isRTL ? '+۱۰' : '10+', label: isRTL ? 'سال تجربه' : 'Years Experience', icon: '🏆', color: '#6366f1' },
    { value: isRTL ? '+۵۰' : '50+', label: isRTL ? 'پروژه زیرساختی' : 'Infrastructure Projects', icon: '🏗️', color: '#06b6d4' },
    { value: isRTL ? '+۱۰۰۰' : '1000+', label: isRTL ? 'تجهیزات مدیریتی' : 'Managed Endpoints', icon: '🖧', color: '#10b981' },
    { value: isRTL ? '+۲۰' : '20+', label: isRTL ? 'استقرار سازمانی' : 'Enterprise Deployments', icon: '🚀', color: '#f59e0b' },
  ]

  return (
    <section
      ref={ref}
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-background"
      aria-label={isRTL ? 'بخش اصلی' : 'Hero section'}
    >
      <NetworkTopology />

      {/* Overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/20 to-background pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-background/80 pointer-events-none" />
      <div className="absolute inset-0 grid-bg opacity-100 pointer-events-none" aria-hidden="true" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 20%, rgba(99,102,241,0.12) 0%, transparent 70%)' }}
        aria-hidden="true"
      />

      <motion.div
        style={{ y, opacity }}
        className="container-site relative z-10 pt-32 pb-20 text-center"
      >
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center gap-6 max-w-5xl mx-auto"
        >
          {/* Status */}
          <motion.div variants={fadeIn}>
            <StatusNode label={t('available')} status="available" />
          </motion.div>

          {/* Brand */}
          <motion.div variants={slideUp} className="flex flex-col items-center gap-1">
            <span className="section-label mb-2">{t('name')}</span>
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-none">
              <span style={{
                background: 'linear-gradient(135deg, #f1f5f9 0%, #94a3b8 40%, #6366f1 70%, #818cf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                {t('brand')}
              </span>
            </h1>
          </motion.div>

          {/* Roles */}
          <motion.div variants={slideUp} className="flex flex-col items-center gap-2">
            <p className="text-xl sm:text-2xl md:text-3xl font-semibold gradient-text">{t('role')}</p>
            <p className="text-lg sm:text-xl text-text-secondary font-medium">{t('roleSecondary')}</p>
          </motion.div>

          {/* Mission */}
          <motion.div variants={slideUp} className="max-w-2xl">
            <p className="text-base md:text-lg text-text-secondary leading-relaxed text-balance">
              {t('mission')}{'. '}
              <span className="text-text-primary">{t('description')}</span>
            </p>
          </motion.div>

          {/* CTAs */}
          <motion.div variants={slideUp} className="flex flex-col sm:flex-row gap-3 mt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => { window.location.href = buildPath(locale, '/projects') }}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0l-4-4m4 4l-4 4" />
                </svg>
                {t('ctaPrimary')}
              </span>
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => { window.location.href = buildPath(locale, '/consultation') }}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {t('ctaSecondary')}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => { window.open('/resume.pdf', '_blank') }}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {t('ctaTertiary')}
              </span>
            </Button>
          </motion.div>

          {/* Metrics */}
          <motion.div variants={fadeIn} className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-8 w-full max-w-3xl">
            {METRICS.map((metric, i) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + i * 0.1, duration: 0.5 }}
                className="metric-card text-center hover:border-accent/40 transition-all duration-300"
              >
                <div className="text-2xl mb-1">{metric.icon}</div>
                <div className="text-2xl md:text-3xl font-bold tabular-nums" style={{ color: metric.color }}>
                  {metric.value}
                </div>
                <div className="text-xs text-text-muted mt-1 leading-tight">{metric.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-text-muted"
        aria-hidden="true"
      >
        <span className="text-xs tracking-widest uppercase font-medium">{isRTL ? 'اسکرول' : 'Scroll'}</span>
        <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.div>
      </motion.div>
    </section>
  )
}
