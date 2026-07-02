'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { BRAND } from '@/lib/design/tokens'

/**
 * Recharts is heavy (~130 kB). It lives in this standalone module so the admin
 * dashboard can pull it in via `next/dynamic` — the chart chunk only loads when
 * the dashboard actually renders, keeping the admin shell's initial bundle lean.
 */
export default function ViewsChart({ data }: { data: { date: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="vGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={BRAND.indigo} stopOpacity={0.3} />
            <stop offset="95%" stopColor={BRAND.indigo} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
        <XAxis dataKey="date" tick={{ fill: '#4a4a6a', fontSize: 11 }} tickLine={false} />
        <YAxis tick={{ fill: '#4a4a6a', fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ background: '#111122', border: '1px solid #1e1e2e', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#9090b0' }}
        />
        <Area type="monotone" dataKey="count" stroke={BRAND.indigo} fill="url(#vGrad)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
