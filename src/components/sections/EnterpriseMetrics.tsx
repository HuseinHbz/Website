'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { springUp, staggerFast, blurReveal } from '@/lib/motion'

interface Metric {
  value: string
  numericValue: number
  suffix: string
  label: string
  labelFa: string
  sublabel: string
  sublabelFa: string
  color: string
  icon: string
}

interface EnterpriseMetricsProps {
  locale: string
}

const METRICS: Metric[] = [
  {
    value: '10+',
    numericValue: 10,
    suffix: '+',
    label: 'Years Enterprise Experience',
    labelFa: 'سال تجربه سازمانی',
    sublabel: 'Across diverse industries',
    sublabelFa: 'در صنایع مختلف',
    color: '#7477ff',
    icon: '◈',
  },
  {
    value: '50+',
    numericValue: 50,
    suffix: '+',
    label: 'Infrastructure Projects',
    labelFa: 'پروژه زیرساختی',
    sublabel: 'Successfully delivered',
    sublabelFa: 'با موفقیت تحویل شده',
    color: '#22d3ee',
    icon: '◉',
  },
  {
    value: '1000+',
    numericValue: 1000,
    suffix: '+',
    label: 'Network Devices Managed',
    labelFa: 'تجهیزات شبکه تحت مدیریت',
    sublabel: 'Enterprise endpoints',
    sublabelFa: 'در سطح سازمانی',
    color: '#10b981',
    icon: '◆',
  },
  {
    value: '99.9%',
    numericValue: 99.9,
    suffix: '%',
    label: 'Average Uptime SLA',
    labelFa: 'میانگین SLA آپتایم',
    sublabel: 'Across all managed infrastructure',
    sublabelFa: 'در تمام زیرساخت‌های مدیریتی',
    color: '#f59e0b',
    icon: '◎',
  },
  {
    value: '20+',
    numericValue: 20,
    suffix: '+',
    label: 'Enterprise Deployments',
    labelFa: 'استقرار سازمانی',
    sublabel: 'Full-scale rollouts',
    sublabelFa: 'اجرای کامل',
    color: '#8b5cf6',
    icon: '◇',
  },
  {
    value: '500+',
    numericValue: 500,
    suffix: '+',
    label: 'Virtual Machines Deployed',
    labelFa: 'ماشین مجازی مستقر شده',
    sublabel: 'Production environments',
    sublabelFa: 'محیط‌های تولیدی',
    color: '#ec4899',
    icon: '⬡',
  },
  {
    value: '15+',
    numericValue: 15,
    suffix: '+',
    label: 'Organizations Served',
    labelFa: 'سازمان خدمت‌گیرنده',
    sublabel: 'Across multiple sectors',
    sublabelFa: 'در بخش‌های مختلف',
    color: '#14b8a6',
    icon: '◐',
  },
  {
    value: '24/7',
    numericValue: 24,
    suffix: '/7',
    label: 'Monitoring & Support',
    labelFa: 'پایش و پشتیبانی',
    sublabel: 'Continuous infrastructure oversight',
    sublabelFa: 'نظارت مداوم زیرساخت',
    color: '#f97316',
    icon: '◑',
  },
]

function useCounter(end: number, duration = 2000, started: boolean) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!started) return
    const step = end / (duration / 16)
    let current = 0
    const timer = setInterval(() => {
      current += step
      if (current >= end) {
        setCount(end)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, 16)
    return () => clearInterval(timer)
  }, [end, duration, started])

  return count
}

function MetricCard({ metric, index, isRTL }: { metric: Metric; index: number; isRTL: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })
  const count = useCounter(metric.numericValue, 1800 + index * 100, inView)

  const displayValue = metric.suffix === '%'
    ? `${count.toFixed(count >= 99 ? 1 : 0)}${metric.suffix}`
    : metric.suffix === '/7'
    ? '24/7'
    : `${count}${metric.suffix}`

  return (
    <motion.div
      ref={ref}
      variants={springUp}
      className="metric-card group relative"
      style={{ '--card-accent': metric.color } as React.CSSProperties}
      whileHover={{ y: -4, transition: { type: 'spring', stiffness: 300, damping: 20 } }}
    >
      {/* Background glow */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 80% 60% at 50% 100%, ${metric.color}10, transparent)` }}
      />

      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-4 relative z-10"
        style={{ background: `${metric.color}15`, border: `1px solid ${metric.color}25`, color: metric.color }}
      >
        {metric.icon}
      </div>

      {/* Number */}
      <div
        className="text-3xl sm:text-4xl font-black tabular-nums leading-none mb-2 relative z-10"
        style={{ color: metric.color }}
      >
        {inView ? displayValue : `0${metric.suffix}`}
      </div>

      {/* Label */}
      <p className="text-sm font-semibold text-text-primary leading-tight mb-1 relative z-10">
        {isRTL ? metric.labelFa : metric.label}
      </p>

      {/* Sublabel */}
      <p className="text-xs text-text-muted leading-tight relative z-10">
        {isRTL ? metric.sublabelFa : metric.sublabel}
      </p>

      {/* Bottom accent line */}
      <div
        className="absolute bottom-0 left-4 right-4 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, transparent, ${metric.color}60, transparent)` }}
      />
    </motion.div>
  )
}

export function EnterpriseMetrics({ locale }: EnterpriseMetricsProps) {
  const isRTL = locale === 'fa'

  return (
    <section className="section-padding relative overflow-hidden" id="metrics" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Background */}
      <div className="absolute inset-0" style={{ background: '#060610' }} />
      <div className="absolute inset-0 grid-bg opacity-70" />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[40vh] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(99,102,241,0.07) 0%, transparent 70%)' }}
      />
      <div className="absolute top-0 inset-x-0 accent-divider" />
      <div className="absolute bottom-0 inset-x-0 accent-divider" />

      <div className="container-site relative z-10">
        {/* Header */}
        <motion.div
          variants={staggerFast}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.p variants={blurReveal} className="section-label mb-4 justify-center">
            {isRTL ? 'اثر کسب‌وکار' : 'Business Impact'}
          </motion.p>
          <motion.h2 variants={blurReveal} className="section-title mb-4">
            {isRTL ? 'معیارهای ' : 'Enterprise '}
            <span className="gradient-text">
              {isRTL ? 'سازمانی' : 'Metrics'}
            </span>
          </motion.h2>
          <motion.p variants={blurReveal} className="section-subtitle max-w-2xl mx-auto">
            {isRTL
              ? 'اعداد و دستاوردهایی که دهه‌ای از تجربه عملی در زیرساخت سازمانی را نشان می‌دهند.'
              : 'Numbers that reflect a decade of hands-on enterprise infrastructure delivery across industries.'}
          </motion.p>
        </motion.div>

        {/* Metrics Grid */}
        <motion.div
          variants={staggerFast}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-5"
        >
          {METRICS.map((metric, i) => (
            <MetricCard key={metric.label} metric={metric} index={i} isRTL={isRTL} />
          ))}
        </motion.div>

        {/* Bottom tagline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="mt-16 text-center"
        >
          <p className="text-sm text-text-muted italic">
            {isRTL
              ? '«هر عدد یک داستان از تحول دیجیتال، اطمینان‌پذیری سازمانی و اعتماد مشتری را بازگو می‌کند.»'
              : '"Every metric represents a real transformation, a client\'s trust earned, and infrastructure that performs when it matters most."'}
          </p>
        </motion.div>
      </div>
    </section>
  )
}
