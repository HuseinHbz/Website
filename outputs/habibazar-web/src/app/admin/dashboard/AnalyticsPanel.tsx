'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'

interface DashData {
  stats: {
    totalViews: number
    weeklyViews: number
    newContacts: number
    newConsultations: number
    publishedPosts: number
    activeProjects: number
    activeServices: number
  }
  dailyViews: { date: string; count: number }[]
  topPages: { page: string; count: number }[]
  recentActivity: {
    id: number
    userEmail: string
    action: string
    resource: string
    resourceId: string
    createdAt: string
  }[]
}

function pageLabel(page: string): string {
  const clean = page.replace(/^\/(fa|en)(\/|$)/, '/').replace(/\/$/, '') || '/'
  const map: Record<string, string> = {
    '/': 'صفحه اصلی',
    '/projects': 'پروژه‌ها',
    '/blog': 'وبلاگ',
    '/about': 'درباره',
    '/consultation': 'مشاوره',
    '/contact': 'تماس',
    '/services': 'خدمات',
  }
  if (clean.startsWith('/blog/')) return `وبلاگ: ${clean.replace('/blog/', '')}`
  return map[clean] || clean
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: '#10b981',
  UPDATE: '#6366f1',
  DELETE: '#ef4444',
  LOGIN: '#f59e0b',
  UPLOAD: '#818cf8',
}

const ACTION_FA: Record<string, string> = {
  CREATE: 'ایجاد',
  UPDATE: 'ویرایش',
  DELETE: 'حذف',
  LOGIN: 'ورود',
  UPLOAD: 'آپلود',
}

const RESOURCE_FA: Record<string, string> = {
  hero: 'هیرو',
  blog: 'وبلاگ',
  project: 'پروژه',
  service: 'خدمت',
  skill: 'مهارت',
  certification: 'گواهینامه',
  media: 'رسانه',
  settings: 'تنظیمات',
  user: 'کاربر',
  contact: 'تماس',
  consultation: 'مشاوره',
}

const PIE_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#818cf8', '#c03030', '#e57000']

type ActivityRow = { id: number; userEmail: string; action: string; resource: string; resourceId: string; createdAt: string }

export function AnalyticsPanel() {
  const t = useT()
  const locale = useAdminLocale()
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<'7' | '14' | '30'>('7')

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-48 bg-surface rounded-xl" />
        ))}
      </div>
    )
  }

  const s = data?.stats
  const dailySlice = (data?.dailyViews || []).slice(-(parseInt(range)))
  const topPagesData = (data?.topPages || []).slice(0, 8).map(p => ({
    page: pageLabel(p.page),
    count: p.count,
  }))

  // Build action distribution from activity log
  const actionCounts: Record<string, number> = {}
  for (const log of (data?.recentActivity || [])) {
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1
  }
  const actionPieData = Object.entries(actionCounts).map(([name, value]) => ({ name: ACTION_FA[name] || name, value }))

  return (
    <div className="space-y-6">
      {/* Header KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'کل بازدید', value: s?.totalViews ?? 0, icon: '◉', color: '#6366f1', sub: 'از ابتدا تاکنون' },
          { label: 'بازدید هفته', value: s?.weeklyViews ?? 0, icon: '↑', color: '#06b6d4', sub: '۷ روز اخیر' },
          { label: 'تماس‌های جدید', value: s?.newContacts ?? 0, icon: '✉', color: '#f59e0b', sub: 'دریافت نشده' },
          { label: 'مشاوره‌ها', value: s?.newConsultations ?? 0, icon: '◎', color: '#10b981', sub: 'در انتظار' },
        ].map((kpi, i) => (
          <div key={i} className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-text-tertiary">{kpi.label}</span>
              <span style={{ color: kpi.color }} className="text-lg">{kpi.icon}</span>
            </div>
            <p className="text-2xl font-bold text-white">{kpi.value.toLocaleString()}</p>
            <p className="text-xs text-text-disabled mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Traffic Chart */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">نمودار ترافیک روزانه</h3>
          <div className="flex gap-1">
            {(['7', '14', '30'] as const).map(r => (
              <button key={r} onClick={() => setRange(r)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${range === r ? 'bg-brand text-white' : 'bg-surface-2 text-text-secondary hover:text-white'}`}>
                {r} روز
              </button>
            ))}
          </div>
        </div>
        {dailySlice.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dailySlice}>
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
        ) : (
          <div className="h-48 flex items-center justify-center text-text-disabled text-sm">هنوز داده‌ای ثبت نشده</div>
        )}
      </Card>

      {/* Top Pages + Action Distribution */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Pages bar chart */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">صفحات پربازدید</h3>
          {topPagesData.length > 0 ? (
            <div className="space-y-2.5">
              {topPagesData.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-text-tertiary w-5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-text-primary truncate">{p.page}</span>
                      <span className="text-xs font-mono text-brand flex-shrink-0 ml-2">{p.count}</span>
                    </div>
                    <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(p.count / (topPagesData[0]?.count || 1)) * 100}%`,
                          background: `linear-gradient(90deg, ${PIE_COLORS[i % PIE_COLORS.length]}, ${PIE_COLORS[(i + 1) % PIE_COLORS.length]})`
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-text-disabled text-sm">هنوز داده‌ای ثبت نشده</div>
          )}
        </Card>

        {/* Action breakdown pie */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">توزیع عملیات‌های اخیر</h3>
          {actionPieData.length > 0 ? (
            <div className="flex items-center gap-6">
              <PieChart width={160} height={160}>
                <Pie data={actionPieData} cx={75} cy={75} innerRadius={45} outerRadius={70} dataKey="value" stroke="none">
                  {actionPieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#111122', border: '1px solid #2a2a3e', borderRadius: 8, fontSize: 11 }} />
              </PieChart>
              <div className="flex-1 space-y-2">
                {actionPieData.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-xs text-text-secondary">{entry.name}</span>
                    <span className="text-xs font-mono text-text-tertiary mr-auto">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-text-disabled text-sm">هنوز فعالیتی ثبت نشده</div>
          )}
        </Card>
      </div>

      {/* Full Activity Log */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-white mb-4">گزارش کامل فعالیت‌ها</h3>
        <DataTable
          tableId="analytics-activity"
          columns={[
            { key: 'action', labelEn: 'Action', labelFa: 'عملیات', type: 'enum', render: log => <span className="px-2 py-0.5 rounded text-3xs font-bold uppercase" style={{ background: `${ACTION_COLORS[log.action] || '#4a4a6a'}20`, color: ACTION_COLORS[log.action] || '#9090b0' }}>{ACTION_FA[log.action] || log.action}</span> },
            { key: 'resource', labelEn: 'Resource', labelFa: 'منبع', type: 'enum', render: log => <span className="text-text-secondary">{RESOURCE_FA[log.resource] || log.resource}</span> },
            { key: 'resourceId', labelEn: 'ID', labelFa: 'شناسه', render: log => <span className="font-mono text-text-disabled">{log.resourceId || '—'}</span> },
            { key: 'userEmail', labelEn: 'User', labelFa: 'کاربر', render: log => <span className="text-text-tertiary">{log.userEmail}</span> },
            { key: 'createdAt', labelEn: 'Time', labelFa: 'زمان', type: 'date', render: log => <span className="text-text-disabled whitespace-nowrap">{new Date(log.createdAt).toLocaleString('fa-IR')}</span> },
          ] as Column<ActivityRow>[]}
          rows={data?.recentActivity ?? []}
          locale={locale}
          rowKey={log => String(log.id)}
          exportName="activity-log"
          emptyLabel="هنوز فعالیتی ثبت نشده"
        />
      </Card>

      {/* Content stats */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-white mb-4">وضعیت محتوا</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'پست وبلاگ', value: s?.publishedPosts ?? 0, color: '#818cf8', icon: '▣' },
            { label: 'پروژه فعال', value: s?.activeProjects ?? 0, color: '#ef4444', icon: '◆' },
            { label: 'خدمت فعال', value: s?.activeServices ?? 0, color: '#f59e0b', icon: '◈' },
          ].map((item, i) => (
            <div key={i} className="text-center p-4 bg-background rounded-xl border border-border">
              <span className="text-2xl" style={{ color: item.color }}>{item.icon}</span>
              <p className="text-2xl font-bold text-white mt-1">{item.value}</p>
              <p className="text-xs text-text-tertiary mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
