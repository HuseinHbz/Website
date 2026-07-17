'use client'

import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { BRAND, chartColor } from '@/lib/design/tokens'
import { faDigits, rtlChartProps } from '@/lib/admin/chartRtl'

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

export default function PurchasingCharts({ data, labels, locale = 'en' }: { data: PurchasingChartsData; labels: { spend: string; vendors: string }; locale?: string }) {
  // 26.24b بند ۵.۲: RTL/fa-IR aware — reversed time axis + Persian-digit amounts.
  const rtl = locale === 'fa'
  const { xReversed, yOrientation } = rtlChartProps(rtl)
  const money = (v: number | string) => { const s = Number(v).toLocaleString(); return rtl ? faDigits(s) : s }
  return (
    <div className="grid lg:grid-cols-2 gap-4" dir={rtl ? 'rtl' : 'ltr'}>
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
            <XAxis dataKey="month" reversed={xReversed} tick={tick} tickLine={false} tickFormatter={v => (rtl ? faDigits(v) : v)} />
            <YAxis orientation={yOrientation} tick={tick} tickLine={false} axisLine={false} width={80} tickFormatter={money} />
            <Tooltip contentStyle={{ ...tooltipStyle, direction: rtl ? 'rtl' : 'ltr' }} labelStyle={{ color: '#9090b0' }} formatter={(v) => money(v as number)} />
            <Area type="monotone" dataKey="total" stroke={BRAND.indigo} fill="url(#purSpend)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-xl border border-subtle bg-surface p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{labels.vendors}</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.topVendorSpend} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" horizontal={false} />
            <XAxis type="number" reversed={rtl} orientation="bottom" tick={tick} tickLine={false} axisLine={false} tickFormatter={money} />
            <YAxis type="category" dataKey="vendor" orientation={yOrientation} tick={tick} tickLine={false} axisLine={false} width={120} />
            <Tooltip contentStyle={{ ...tooltipStyle, direction: rtl ? 'rtl' : 'ltr' }} labelStyle={{ color: '#9090b0' }} formatter={(v) => money(v as number)} />
            <Bar dataKey="total" fill={chartColor(1)} radius={rtl ? [6, 0, 0, 6] : [0, 6, 6, 0]} barSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
