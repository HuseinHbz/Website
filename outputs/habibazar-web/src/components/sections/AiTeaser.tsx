'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { fadeIn, slideUp } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface AiTeaserProps {
  locale: string
}

function SparklesIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  )
}

export function AiTeaser({ locale }: AiTeaserProps) {
  const t = useTranslations('aiTeaser')
  const isRTL = locale === 'fa'

  function openChat() {
    // Dispatch custom event to open AiAssistant
    window.dispatchEvent(new CustomEvent('open-ai-assistant'))
  }

  return (
    <section className="section-padding bg-background relative overflow-hidden">
      {/* Glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 100%, rgba(99,102,241,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="container-site relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeIn}
          className={cn(
            'max-w-3xl mx-auto rounded-2xl p-8 md:p-12',
            'bg-surface border border-accent/20',
            'text-center',
            'shadow-xl shadow-accent/5'
          )}
        >
          <motion.div variants={slideUp}>
            <div className={cn(
              'inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-6',
              'bg-accent/10 text-accent'
            )}>
              <SparklesIcon />
            </div>

            <p className="section-label mb-3 justify-center">
              {isRTL ? 'مشاور فناوری هوش مصنوعی' : 'AI Technology Advisor'}
            </p>

            <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-4">
              {isRTL ? 'سوال فنی دارید؟' : t('subtitle')}
            </h2>

            <p className="text-text-secondary leading-relaxed max-w-xl mx-auto mb-3">
              {t('description')}
            </p>

            <p className="text-sm text-text-muted max-w-lg mx-auto mb-8">
              {isRTL
                ? 'برای چالش‌های پیچیده زیرساخت، مشاوره تخصصی با کارشناس رزرو کنید.'
                : 'For complex infrastructure challenges, book a consultation with the expert directly.'}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button variant="primary" size="lg" onClick={openChat}>
                {t('cta')}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
