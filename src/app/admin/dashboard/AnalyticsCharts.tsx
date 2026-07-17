'use client'

/**
 * Recharts-backed chart bodies for the Analytics panel, split into their own
 * chunk so `next/dynamic` can lazy-load recharts (Phase 26.26b بند ۲.۱). Before
 * this split `/admin/dashboard` statically imported recharts → 121 kB page /
 * 292 kB First Load, an outlier vs every other admin page (~20 kB). Keeping the
 * charts here means recharts is fetched only when the panel actually renders.
 */
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

export function TrafficAreaChart({ data }: { data: { date: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="vGrad2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
        <XAxis dataKey="date" tick={{ fill: '#4a4a6a', fontSize: 11 }} tickLine={false} />
        <YAxis tick={{ fill: '#4a4a6a', fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ background: '#111122', border: '1px solid #2a2a3e', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#9090b0' }}
        />
        <Area type="monotone" dataKey="count" name="بازدید" stroke="#6366f1" fill="url(#vGrad2)" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function ActionPieChart({ data, colors }: { data: { name: string; value: number }[]; colors: string[] }) {
  return (
    <PieChart width={160} height={160}>
      <Pie data={data} cx={75} cy={75} innerRadius={45} outerRadius={70} dataKey="value" stroke="none">
        {data.map((_, i) => (
          <Cell key={i} fill={colors[i % colors.length]} />
        ))}
      </Pie>
      <Tooltip contentStyle={{ background: '#111122', border: '1px solid #2a2a3e', borderRadius: 8, fontSize: 11 }} />
    </PieChart>
  )
}
