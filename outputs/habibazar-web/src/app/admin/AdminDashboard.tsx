'use client'

import { useEffect, useState } from 'react'
import { StatCard, Card } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

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

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'text-green-400',
  UPDATE: 'text-blue-400',
  DELETE: 'text-red-400',
  LOGIN: 'text-yellow-400',
  UPLOAD: 'text-purple-400',
}

export function AdminDashboard() {
  const t = useT()
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 bg-[#111122] rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const s = data?.stats

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('totalViews')} value={s?.totalViews ?? 0} icon="◉" color="#6366f1" />
        <StatCard label={t('weeklyViews')} value={s?.weeklyViews ?? 0} icon="↑" color="#06b6d4" delta={t('last7Days')} />
        <StatCard label={t('newContactsLbl')} value={s?.newContacts ?? 0} icon="✉" color="#f59e0b" />
        <StatCard label={t('consultLbl')} value={s?.newConsultations ?? 0} icon="◎" color="#10b981" />
        <StatCard label={t('blogPostsLbl')} value={s?.publishedPosts ?? 0} icon="▣" color="#818cf8" />
        <StatCard label={t('activeProjects')} value={s?.activeProjects ?? 0} icon="◆" color="#ef4444" />
        <StatCard label={t('activeServices')} value={s?.activeServices ?? 0} icon="◈" color="#f59e0b" />
        <StatCard label={t('uptime')} value="99.9%" icon="▲" color="#10b981" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">{t('viewsChart')}</h3>
          {data?.dailyViews && data.dailyViews.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data.dailyViews}>
                <defs>
                  <linearGradient id="vGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                <XAxis dataKey="date" tick={{ fill: '#4a4a6a', fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: '#4a4a6a', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: '#111122', border: '1px solid #1e1e2e', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#9090b0' }}
                />
                <Area type="monotone" dataKey="count" stroke="#6366f1" fill="url(#vGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-600 text-sm">
              {t('noAnalytics')}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">{t('topPages')}</h3>
          {data?.topPages && data.topPages.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.topPages.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#4a4a6a', fontSize: 11 }} tickLine={false} />
                <YAxis dataKey="page" type="category" tick={{ fill: '#4a4a6a', fontSize: 10 }} tickLine={false} width={80} />
                <Tooltip
                  contentStyle={{ background: '#111122', border: '1px solid #1e1e2e', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-600 text-sm">{t('noTopPages')}</div>
          )}
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-white mb-4">{t('recentActivity')}</h3>
        {data?.recentActivity && data.recentActivity.length > 0 ? (
          <div className="space-y-2">
            {data.recentActivity.map((log) => (
              <div key={log.id} className="flex items-center gap-3 py-2 border-b border-[#1e1e2e]/50 last:border-0">
                <span className={`text-xs font-bold uppercase w-16 ${ACTION_COLORS[log.action] || 'text-slate-400'}`}>
                  {log.action}
                </span>
                <span className="text-sm text-slate-300 flex-1">
                  <span className="text-slate-500">{log.resource}</span>
                  {log.resourceId && <span className="text-slate-600 text-xs ml-1">#{log.resourceId}</span>}
                </span>
                <span className="text-xs text-slate-600">{log.userEmail}</span>
                <span className="text-xs text-slate-700">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-600 text-center py-8">{t('noActivity')}</p>
        )}
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Edit Hero', href: '/admin/hero', icon: '⬡', color: '#6366f1' },
          { label: 'New Blog Post', href: '/admin/blog', icon: '▣', color: '#818cf8' },
          { label: 'View Contacts', href: '/admin/contacts', icon: '✉', color: '#f59e0b' },
          { label: 'Media Upload', href: '/admin/media', icon: '▤', color: '#06b6d4' },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 p-4 bg-[#111122] border border-[#1e1e2e] rounded-xl hover:bg-[#1a1a2e] transition-colors group"
          >
            <span className="text-xl" style={{ color: item.color }}>{item.icon}</span>
            <span className="text-sm font-medium text-slate-300 group-hover:text-white">{item.label}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
