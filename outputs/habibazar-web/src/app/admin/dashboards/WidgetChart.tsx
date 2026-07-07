'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { BRAND } from '@/lib/design/tokens'

/**
 * Standalone chart module for dashboard chart widgets — pulled in via
 * `next/dynamic` so the heavy recharts chunk only loads on dashboards that
 * actually render a chart (lazy widget loading).
 */
export default function WidgetChart({ points }: { points: { x: string; y: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={points} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={BRAND.indigo} stopOpacity={0.3} />
            <stop offset="95%" stopColor={BRAND.indigo} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="x" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={34} />
        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
        <Area type="monotone" dataKey="y" stroke={BRAND.indigo} strokeWidth={2} fill="url(#wGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
