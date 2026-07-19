'use client'

import { motion } from 'framer-motion'
import { staggerFast, springUp } from '@/lib/motion'

interface BeforeAfterItem {
  label: string
  before: string
  after: string
}

interface Props {
  beforeAfterJson?: string | null
  isRTL?: boolean
}

export function BeforeAfterComparison({ beforeAfterJson, isRTL }: Props) {
  if (!beforeAfterJson) return null
  let items: BeforeAfterItem[] = []
  try { items = JSON.parse(beforeAfterJson) } catch { return null }
  if (!items.length) return null

  return (
    <motion.div
      variants={staggerFast}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className="overflow-hidden rounded-2xl"
      style={{ border: '1px solid rgba(99,102,241,0.15)' }}
    >
      {/* Header */}
      <div className="grid grid-cols-3 text-xs font-bold uppercase tracking-widest py-3"
        style={{ background: 'rgba(10,10,18,0.9)' }}>
        <div className="px-4 text-text-muted">{isRTL ? 'معیار' : 'Metric'}</div>
        <div className="px-4 text-red-400 text-center">{isRTL ? 'قبل' : 'Before'}</div>
        <div className="px-4 text-emerald-400 text-center">{isRTL ? 'بعد' : 'After'}</div>
      </div>

      {items.map((item, i) => (
        <motion.div
          key={i}
          variants={springUp}
          className="grid grid-cols-3 py-4 border-t"
          style={{
            background: i % 2 === 0 ? 'rgba(99,102,241,0.03)' : 'transparent',
            borderColor: 'rgba(99,102,241,0.08)',
          }}
        >
          <div className="px-4 text-sm font-medium text-text-primary">{item.label}</div>
          <div className="px-4 text-sm text-red-400 text-center">{item.before}</div>
          <div className="px-4 text-sm text-emerald-400 font-semibold text-center">{item.after}</div>
        </motion.div>
      ))}
    </motion.div>
  )
}
