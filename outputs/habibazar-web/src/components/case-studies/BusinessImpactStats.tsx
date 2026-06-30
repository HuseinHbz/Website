'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { staggerFast, springUp } from '@/lib/motion'

interface ImpactMetric {
  metricEn: string
  metricFa: string
  before?: string
  after?: string
  unit?: string
  improvement?: string
  icon?: string
}

interface Props {
  businessImpactJson?: string | null
  resultsEn?: string[] | null
  resultsFa?: string[] | null
  isRTL?: boolean
}

function parseResults(raw: string | null | undefined): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

export function BusinessImpactStats({ businessImpactJson, resultsEn, resultsFa, isRTL }: Props) {
  let metrics: ImpactMetric[] = []

  if (businessImpactJson) {
    try { metrics = JSON.parse(businessImpactJson) } catch { /* ignore */ }
  }

  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })

  if (metrics.length > 0) {
    return (
      <div ref={ref} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((m, i) => (
          <motion.div
            key={i}
            variants={springUp}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            transition={{ delay: i * 0.08 }}
            className="relative overflow-hidden rounded-2xl p-5"
            style={{ background: 'rgba(10,10,18,0.9)', border: '1px solid rgba(99,102,241,0.15)' }}
          >
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl">{m.icon || '📈'}</span>
              <p className="text-sm font-semibold text-text-primary leading-tight">
                {isRTL ? m.metricFa : m.metricEn}
              </p>
            </div>
            {m.before && m.after && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-text-muted line-through">{m.before}{m.unit}</span>
                <span className="text-accent">→</span>
                <span className="font-bold text-emerald-400">{m.after}{m.unit}</span>
              </div>
            )}
            {m.improvement && (
              <div className="mt-2">
                <span
                  className="inline-block px-2 py-1 rounded-lg text-xs font-bold"
                  style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
                >
                  {m.improvement}
                </span>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    )
  }

  // Fallback: render results list
  const results = parseResults(isRTL ? resultsFa as unknown as string : resultsEn as unknown as string)
  const rawResults = isRTL
    ? (typeof resultsFa === 'string' ? parseResults(resultsFa) : resultsFa || [])
    : (typeof resultsEn === 'string' ? parseResults(resultsEn) : resultsEn || [])

  if (!rawResults.length) return null

  return (
    <motion.div
      ref={ref}
      variants={staggerFast}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className="space-y-3"
    >
      {rawResults.map((result, i) => (
        <motion.div
          key={i}
          variants={springUp}
          className="flex items-start gap-3 p-4 rounded-xl"
          style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}
        >
          <span className="text-emerald-400 font-bold mt-0.5 shrink-0">✓</span>
          <p className="text-sm text-text-secondary leading-relaxed">{result}</p>
        </motion.div>
      ))}
    </motion.div>
  )
}
