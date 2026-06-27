'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { slideUp, staggerContainer } from '@/lib/motion'
import { SITE } from '@/lib/site'

interface ClosingCtaProps {
  locale: string
}

export function ClosingCta({ locale }: ClosingCtaProps) {
  const t = useTranslations('closingCta')
  const isRTL = locale === 'fa'

  function buildPath(path: string) {
    return `/${locale}${path}`
  }

  const TRUST_ITEMS = isRTL
    ? [
        { icon: '✓', text: 'ارزیابی اولیه رایگان' },
        { icon: '✓', text: 'بدون تعهد' },
        { icon: '✓', text: 'پاسخ در ۲۴ ساعت' },
        { icon: '✓', text: 'بیش از ۱۰ سال تجربه سازمانی' },
      ]
    : [
        { icon: '✓', text: 'Free initial assessment' },
        { icon: '✓', text: 'No commitment required' },
        { icon: '✓', text: 'Response within 24h' },
        { icon: '✓', text: '10+ years enterprise experience' },
      ]

  return (
    <section className="section-padding relative overflow-hidden" style={{ background: '#0a0a14' }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(99,102,241,0.1) 0%, transparent 70%)' }}
      />
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
      <div className="absolute inset-0 grid-bg opacity-60" />

      <div className="container-site relative z-10">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto"
        >
          <motion.div variants={slideUp} className="flex justify-center mb-6">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
              style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8' }}
            >
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              {isRTL ? 'آماده پذیرش پروژه سازمانی' : 'Available for Enterprise Engagements'}
            </div>
          </motion.div>

          <motion.h2
            variants={slideUp}
            className="text-3xl md:text-4xl lg:text-5xl font-bold text-text-primary mb-5 text-balance leading-tight"
          >
            {isRTL
              ? <>آماده تحول زیرساخت <span className="gradient-text">سازمانی‌تان</span> هستید؟</>
              : <>Ready to Transform Your <span className="gradient-text">Enterprise Infrastructure?</span></>}
          </motion.h2>

          <motion.p variants={slideUp} className="text-lg text-text-secondary leading-relaxed mb-10 max-w-xl mx-auto">
            {t('subtitle')}
          </motion.p>

          <motion.div variants={slideUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={buildPath('/consultation')}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white transition-all duration-200 hover:scale-105 hover:shadow-2xl"
              style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', boxShadow: '0 8px 32px rgba(99,102,241,0.35)' }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {t('ctaPrimary')}
            </a>
            <a
              href={buildPath('/consultation/intro-call')}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold transition-all duration-200 hover:bg-white/5"
              style={{ border: '1px solid rgba(99,102,241,0.3)', color: '#94a3b8' }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {t('ctaSecondary')}
            </a>
          </motion.div>

          <motion.div variants={slideUp} className="mt-12 flex flex-wrap justify-center gap-6 text-sm text-text-muted">
            {TRUST_ITEMS.map((item) => (
              <span key={item.text} className="flex items-center gap-1.5">
                <span className="text-success font-bold">{item.icon}</span>
                {item.text}
              </span>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
