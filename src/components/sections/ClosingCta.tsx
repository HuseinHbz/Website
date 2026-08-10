'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { slideUp, staggerContainer, blurReveal, staggerFast } from '@/lib/motion'
import { ConsultationForm } from '@/components/forms/ConsultationForm'

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
          variants={staggerFast}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="closing-cta-grid mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[.86fr_1.14fr] lg:text-start"
        >
          <div className="closing-cta-copy text-center lg:text-start">
          <motion.div variants={slideUp} className="flex justify-center lg:justify-start mb-6">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
              style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#9698ff' }}
            >
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              {isRTL ? 'آماده پذیرش پروژه سازمانی' : 'Available for Enterprise Engagements'}
            </div>
          </motion.div>

          <motion.h2
            variants={blurReveal}
            className="text-3xl md:text-4xl lg:text-5xl font-bold text-text-primary mb-5 text-balance leading-tight"
          >
            {isRTL
              ? <>آماده <span className="gradient-text">تحول دیجیتال</span> زیرساخت سازمانی‌تان هستید؟</>
              : <>Ready to Elevate Your <span className="gradient-text">Enterprise Infrastructure?</span></>}
          </motion.h2>

          <motion.p variants={blurReveal} className="text-lg text-text-secondary leading-relaxed mb-3 max-w-xl mx-auto">
            {isRTL
              ? 'با یک مشاوره رایگان شروع کنید. بدون تعهد — فقط یک گفتگوی صادقانه درباره چالش‌های زیرساختی شما.'
              : 'Start with a complimentary infrastructure assessment. No commitment — just an expert conversation about your technology challenges.'}
          </motion.p>

          <motion.p variants={blurReveal} className="text-sm text-text-muted mb-10 max-w-lg mx-auto italic">
            {isRTL
              ? 'مخاطبان: مدیران ارشد فناوری، مدیران IT، رهبران کسب‌وکار'
              : 'Serving: CTOs, CIOs, IT Directors, and Enterprise Technology Leaders'}
          </motion.p>

          <motion.div variants={blurReveal} className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
            <a
              href={buildPath('/consultation')}
              className="btn-enterprise"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {isRTL ? 'رزرو مشاوره رایگان' : 'Book Free Consultation'}
            </a>
            <a
              href={buildPath('/consultation/intro-call')}
              className="btn-outline-enterprise"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {isRTL ? 'تماس مقدماتی' : t('ctaSecondary')}
            </a>
          </motion.div>

          <motion.div variants={slideUp} className="mt-10 flex flex-wrap justify-center lg:justify-start gap-5 text-sm text-text-muted">
            {TRUST_ITEMS.map((item) => (
              <span key={item.text} className="flex items-center gap-1.5">
                <span className="text-success font-bold">{item.icon}</span>
                {item.text}
              </span>
            ))}
          </motion.div>
          </div>
          <motion.div variants={blurReveal} className="closing-cta-form rounded-3xl border border-border bg-background/55 p-2 shadow-2xl backdrop-blur-xl">
            <ConsultationForm kind="ASSESSMENT" locale={locale} />
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
