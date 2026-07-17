'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { staggerContainer, scaleIn } from '@/lib/motion'

interface ProofBarProps {
  locale: string
}

export function ProofBar({ locale }: ProofBarProps) {
  const t = useTranslations('proof')
  const isRTL = locale === 'fa'

  const STATS = [
    { value: t('experienceValue'), label: t('experience'), icon: '🏆', color: '#6366f1' },
    { value: t('projectsValue'),   label: t('projects'),   icon: '🏗️', color: '#06b6d4' },
    { value: t('endpointsValue'),  label: t('endpoints'),  icon: '🖧',  color: '#10b981' },
    { value: t('uptimeValue'),     label: t('uptime'),     icon: '⏱️', color: '#f59e0b' },
  ]

  return (
    <section
      className="relative border-y border-border overflow-hidden"
      style={{ background: 'rgba(13,13,23,0.6)' }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 60% 100% at 50% 0%, rgba(99,102,241,0.06) 0%, transparent 70%)',
      }} />

      <div className="container-site relative z-10 py-8">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-border rtl:divide-x-reverse"
        >
          {STATS.map((stat) => (
            <motion.div
              key={stat.label}
              variants={scaleIn}
              className="flex flex-col items-center text-center px-6 py-4"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{stat.icon}</span>
                <span className="text-3xl md:text-4xl font-bold tabular-nums" style={{ color: stat.color }}>
                  {stat.value}
                </span>
              </div>
              <span className="text-xs text-text-muted uppercase tracking-wide font-medium">{stat.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
