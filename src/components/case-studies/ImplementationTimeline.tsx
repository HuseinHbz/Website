'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { staggerFast, springUp } from '@/lib/motion'

interface Phase {
  phase: number
  titleEn: string
  titleFa: string
  descEn?: string
  descFa?: string
  duration?: string
}

interface Props {
  implementationTimelineJson?: string | null
  isRTL?: boolean
}

export function ImplementationTimeline({ implementationTimelineJson, isRTL }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })

  let phases: Phase[] = []
  if (implementationTimelineJson) {
    try { phases = JSON.parse(implementationTimelineJson) } catch { /* ignore */ }
  }

  if (!phases.length) return null

  return (
    <div ref={ref} className="relative">
      {/* Vertical line */}
      <motion.div
        initial={{ scaleY: 0 }}
        animate={inView ? { scaleY: 1 } : { scaleY: 0 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        style={{ originY: 0 }}
        className={`absolute top-0 bottom-0 w-px bg-gradient-to-b from-accent via-accent/40 to-transparent ${isRTL ? 'right-5' : 'left-5'}`}
      />

      <motion.div
        variants={staggerFast}
        initial="hidden"
        animate={inView ? 'visible' : 'hidden'}
        className="space-y-6"
      >
        {phases.map((phase, i) => (
          <motion.div
            key={i}
            variants={springUp}
            className={`relative flex gap-6 ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            {/* Dot */}
            <div
              className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold z-10"
              style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', boxShadow: '0 0 20px rgba(99,102,241,0.4)' }}
            >
              {phase.phase}
            </div>

            <div className="flex-1 pb-2">
              <div className="flex items-center gap-3 mb-2">
                <h4 className="font-semibold text-text-primary">
                  {isRTL ? phase.titleFa : phase.titleEn}
                </h4>
                {phase.duration && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}
                  >
                    {phase.duration}
                  </span>
                )}
              </div>
              {(isRTL ? phase.descFa : phase.descEn) && (
                <p className="text-sm text-text-secondary leading-relaxed">
                  {isRTL ? phase.descFa : phase.descEn}
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
