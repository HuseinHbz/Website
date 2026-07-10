'use client'

import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { BRAND, chartColor } from '@/lib/design/tokens'

/**
 * Purchasing analytics charts. Recharts is heavy, so this module is standalone
 * and pulled in via `next/dynamic` from the Analytics tab — the chart chunk only
 * loads when the tab actually renders (same pattern as ViewsChart).
 */
export interface PurchasingChartsData {
  monthlySpend: { month: string; total: number }[]
  topVendorSpend: { vendor: string; total: number }[]
}

const tooltipStyle = { background: '#111122', border: '1px solid #1e1e2e', borderRadius: 8, fontSize: 12 } as const
const tick = { fill: '#4a4a6a', fontSize: 11 } as const

export default function PurchasingCharts({ data, labels }: { data: PurchasingChartsData; labels: { spend: string; vendors: string } }) {
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="rounded-xl border border-subtle bg-surface p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{labels.spend}</h3>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data.monthlySpend}>
            <defs>
              <linearGradient id="purSpend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={BRAND.indigo} stopOpacity={0.3} />
                <stop offset="95%" stopColor={BRAND.indigo} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
            <XAxis dataKey="month" tick={tick} tickLine={false} />
            <YAxis tick={tick} tickLine={false} axisLine={false} width={80} tickFormatter={v => Number(v).toLocaleString()} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#9090b0' }} formatter={v => Number(v).toLocaleString()} />
            <Area type="monotone" dataKey="total" stroke={BRAND.indigo} fill="url(#purSpend)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-xl border border-subtle bg-surface p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{labels.vendors}</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.topVendorSpend} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" horizontal={false} />
            <XAxis type="number" tick={tick} tickLine={false} axisLine={false} tickFormatter={v => Number(v).toLocaleString()} />
            <YAxis type="category" dataKey="vendor" tick={tick} tickLine={false} axisLine={false} width={120} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#9090b0' }} formatter={v => Number(v).toLocaleString()} />
            <Bar dataKey="total" fill={chartColor(1)} radius={[0, 6, 6, 0]} barSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
