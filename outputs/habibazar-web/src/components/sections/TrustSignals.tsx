'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/Card'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { staggerContainer, slideUp } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface TrustSignalsProps {
  locale: string
}

function CertIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  )
}

function MethodIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  )
}

function TransparencyIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}

// Technology/certification badges — using general category names only, no fabricated specific certs
const techAreas = [
  { label: 'Cisco / Networking', en: 'Cisco / Networking', fa: 'سیسکو / شبکه' },
  { label: 'Cloud Platforms', en: 'Cloud Platforms', fa: 'پلتفرم‌های ابری' },
  { label: 'Security Frameworks', en: 'Security Frameworks', fa: 'چارچوب‌های امنیتی' },
  { label: 'VMware / Virtualization', en: 'VMware / Virtualization', fa: 'VMware / مجازی‌سازی' },
  { label: 'Linux / Unix', en: 'Linux / Unix', fa: 'لینوکس / یونیکس' },
  { label: 'Zero Trust Architecture', en: 'Zero Trust Architecture', fa: 'معماری Zero Trust' },
  { label: 'ITIL / IT Service Mgmt', en: 'ITIL / IT Service Mgmt', fa: 'ITIL / مدیریت خدمات IT' },
  { label: 'DevSecOps', en: 'DevSecOps', fa: 'DevSecOps' },
]

const pillars = [
  { key: 'certs', Icon: CertIcon },
  { key: 'method', Icon: MethodIcon },
  { key: 'transparency', Icon: TransparencyIcon },
] as const

export function TrustSignals({ locale }: TrustSignalsProps) {
  const t = useTranslations('trust')
  const isRTL = locale === 'fa'

  return (
    <section className="section-padding bg-surface">
      <div className="container-site">
        <SectionHeading
          eyebrow={t('title')}
          title={t('subtitle')}
          locale={locale}
        />

        {/* Pillars */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12"
        >
          {pillars.map(({ key, Icon }) => (
            <motion.div key={key} variants={slideUp}>
              <Card padding="lg" className="h-full">
                <div className={cn(
                  'mb-4 w-11 h-11 rounded-xl flex items-center justify-center',
                  'bg-accent/10 text-accent'
                )}>
                  <Icon />
                </div>
                <h3 className="text-base font-semibold text-text-primary mb-2">
                  {t(`${key}` as Parameters<typeof t>[0])}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {t(`${key}Desc` as Parameters<typeof t>[0])}
                </p>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Tech / expertise tags */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4 text-center">
            {isRTL ? 'حوزه‌های تخصص' : 'Areas of Expertise'}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {techAreas.map((area) => (
              <span
                key={area.label}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium',
                  'bg-background border border-border text-text-secondary',
                  'hover:border-accent/40 hover:text-text-primary transition-colors duration-150'
                )}
              >
                {isRTL ? area.fa : area.en}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
