'use client'

import { useEffect, useRef, useState } from 'react'
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

// Map URL paths to human-readable names
function pageLabel(page: string): string {
  const clean = page
    .replace(/^\/(fa|en)(\/|$)/, '/')  // strip locale prefix
    .replace(/\/$/, '') || '/'
  const map: Record<string, string> = {
    '/': 'صفحه اصلی / Home',
    '/projects': 'پروژه‌ها / Projects',
    '/blog': 'وبلاگ / Blog',
    '/about': 'درباره / About',
    '/consultation': 'مشاوره / Consultation',
    '/contact': 'تماس / Contact',
    '/services': 'خدمات / Services',
  }
  // Blog post paths like /blog/some-slug
  if (clean.startsWith('/blog/')) return `📝 ${clean.replace('/blog/', '')}`
  if (clean.startsWith('/case-studies/')) return `◆ ${clean.replace('/case-studies/', '')}`
  return map[clean] || clean
}

// All available widget IDs
const ALL_WIDGETS = [
  'stat_totalViews',
  'stat_weeklyViews',
  'stat_contacts',
  'stat_consultations',
  'stat_blogPosts',
  'stat_activeProjects',
  'stat_activeServices',
  'stat_uptime',
  'chart_views',
  'chart_topPages',
  'recentActivity',
  'quickLinks',
  'syncButton',
] as const
type WidgetId = typeof ALL_WIDGETS[number]

const WIDGET_LABELS: Record<WidgetId, string> = {
  stat_totalViews: 'کل بازدید',
  stat_weeklyViews: 'بازدید هفته',
  stat_contacts: 'تماس جدید',
  stat_consultations: 'مشاوره‌ها',
  stat_blogPosts: 'پست‌های وبلاگ',
  stat_activeProjects: 'پروژه‌های فعال',
  stat_activeServices: 'خدمات فعال',
  stat_uptime: 'آپتایم',
  chart_views: 'نمودار بازدید',
  chart_topPages: 'صفحات پربازدید',
  recentActivity: 'فعالیت‌های اخیر',
  quickLinks: 'دسترسی سریع',
  syncButton: 'دکمه همگام‌سازی',
}

const STORAGE_KEY = 'hbz_dashboard_widgets'
const DEFAULT_WIDGETS: WidgetId[] = [...ALL_WIDGETS]

function loadWidgetPrefs(): Set<WidgetId> {
  if (typeof window === 'undefined') return new Set(DEFAULT_WIDGETS)
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set(DEFAULT_WIDGETS)
    const parsed = JSON.parse(raw) as WidgetId[]
    return new Set(parsed)
  } catch {
    return new Set(DEFAULT_WIDGETS)
  }
}

function saveWidgetPrefs(enabled: Set<WidgetId>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...enabled]))
}

export function AdminDashboard() {
  const t = useT()
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [autoSyncInterval, setAutoSyncInterval] = useState<number>(0)
  const [nextSyncIn, setNextSyncIn] = useState<number>(0)
  const [showCustomize, setShowCustomize] = useState(false)
  const [enabledWidgets, setEnabledWidgets] = useState<Set<WidgetId>>(new Set(DEFAULT_WIDGETS))

  useEffect(() => {
    setEnabledWidgets(loadWidgetPrefs())
    fetch('/api/admin/dashboard')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function toggleWidget(id: WidgetId) {
    setEnabledWidgets(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveWidgetPrefs(next)
      return next
    })
  }

  const has = (id: WidgetId) => enabledWidgets.has(id)

  async function resyncContent(silent = false) {
    if (!silent && !confirm(t('resyncConfirm'))) return
    setSyncing(true)
    if (!silent) setSyncMsg('')
    const res = await fetch('/api/admin/resync', { method: 'POST' })
    const d = await res.json().catch(() => ({}))
    setSyncing(false)
    setSyncMsg(res.ok ? (silent ? `✓ همگام‌سازی خودکار: ${new Date().toLocaleTimeString('fa-IR')}` : t('resyncDone')) : (d.error || t('failed')))
    setTimeout(() => setSyncMsg(''), 8000)
  }

  useEffect(() => {
    const PREF_KEY = 'hbz_auto_sync_interval'
    const saved = parseInt(localStorage.getItem(PREF_KEY) || '0')
    if (saved) setAutoSyncInterval(saved)
  }, [])

  const resyncRef = useRef(resyncContent)
  resyncRef.current = resyncContent

  useEffect(() => {
    const PREF_KEY = 'hbz_auto_sync_interval'
    localStorage.setItem(PREF_KEY, String(autoSyncInterval))
    if (!autoSyncInterval) { setNextSyncIn(0); return }
    setNextSyncIn(autoSyncInterval * 60)
    const countdown = setInterval(() => setNextSyncIn(n => Math.max(0, n - 1)), 1000)
    const sync = setInterval(() => { resyncRef.current(true); setNextSyncIn(autoSyncInterval * 60) }, autoSyncInterval * 60 * 1000)
    return () => { clearInterval(countdown); clearInterval(sync) }
  }, [autoSyncInterval])

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 bg-surface rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const s = data?.stats

  // Top pages data with friendly labels
  const topPagesData = (data?.topPages || []).map(p => ({
    page: pageLabel(p.page),
    count: p.count,
    rawPage: p.page,
  }))

  // Stat widgets in order
  const statWidgets: Array<{ id: WidgetId; label: string; value: number | string; icon: string; color: string; delta?: string }> = [
    { id: 'stat_totalViews', label: t('totalViews'), value: s?.totalViews ?? 0, icon: '◉', color: '#6366f1' },
    { id: 'stat_weeklyViews', label: t('weeklyViews'), value: s?.weeklyViews ?? 0, icon: '↑', color: '#06b6d4', delta: t('last7Days') },
    { id: 'stat_contacts', label: t('newContactsLbl'), value: s?.newContacts ?? 0, icon: '✉', color: '#f59e0b' },
    { id: 'stat_consultations', label: t('consultLbl'), value: s?.newConsultations ?? 0, icon: '◎', color: '#10b981' },
    { id: 'stat_blogPosts', label: t('blogPostsLbl'), value: s?.publishedPosts ?? 0, icon: '▣', color: '#818cf8' },
    { id: 'stat_activeProjects', label: t('activeProjects'), value: s?.activeProjects ?? 0, icon: '◆', color: '#ef4444' },
    { id: 'stat_activeServices', label: t('activeServices'), value: s?.activeServices ?? 0, icon: '◈', color: '#f59e0b' },
    { id: 'stat_uptime', label: t('uptime'), value: '99.9%', icon: '▲', color: '#10b981' },
  ]
  const visibleStats = statWidgets.filter(w => has(w.id))

  return (
    <div className="space-y-6">
      {/* Customize toggle button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowCustomize(v => !v)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-white border border-border hover:border-border rounded-lg transition-colors bg-background"
        >
          <span>⚙</span>
          <span>شخصی‌سازی داشبورد</span>
        </button>
      </div>

      {/* Customization panel */}
      {showCustomize && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">انتخاب ویجت‌های داشبورد</h3>
            <button
              onClick={() => {
                setEnabledWidgets(new Set(DEFAULT_WIDGETS))
                saveWidgetPrefs(new Set(DEFAULT_WIDGETS))
              }}
              className="text-xs text-brand hover:text-brand"
            >
              بازنشانی همه
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {ALL_WIDGETS.map(id => (
              <label key={id} className="flex items-center gap-2 cursor-pointer group">
                <div
                  onClick={() => toggleWidget(id)}
                  className={`w-8 h-4 rounded-full relative transition-colors cursor-pointer ${enabledWidgets.has(id) ? 'bg-brand' : 'bg-surface-2'}`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${enabledWidgets.has(id) ? 'right-0.5' : 'left-0.5'}`} />
                </div>
                <span className="text-xs text-text-secondary group-hover:text-text-primary">
                  {WIDGET_LABELS[id]}
                </span>
              </label>
            ))}
          </div>
        </Card>
      )}

      {/* Stats Row */}
      {visibleStats.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {visibleStats.map(w => (
            <StatCard key={w.id} label={w.label} value={w.value} icon={w.icon} color={w.color} delta={w.delta} />
          ))}
        </div>
      )}

      {/* Charts */}
      {(has('chart_views') || has('chart_topPages')) && (
        <div className="grid lg:grid-cols-2 gap-6">
          {has('chart_views') && (
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
                <div className="h-48 flex items-center justify-center text-text-disabled text-sm">
                  {t('noAnalytics')}
                </div>
              )}
            </Card>
          )}

          {has('chart_topPages') && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-white mb-4">{t('topPages')}</h3>
              {topPagesData.length > 0 ? (
                <div className="space-y-2">
                  {topPagesData.slice(0, 8).map((p, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-text-tertiary w-4 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-text-primary truncate mb-1">{p.page}</div>
                        <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: `${(p.count / (topPagesData[0]?.count || 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-mono text-brand w-6 text-right">{p.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-text-disabled text-sm">{t('noTopPages')}</div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Recent Activity */}
      {has('recentActivity') && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">{t('recentActivity')}</h3>
          {data?.recentActivity && data.recentActivity.length > 0 ? (
            <div className="space-y-2">
              {data.recentActivity.map((log) => (
                <div key={log.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                  <span className={`text-xs font-bold uppercase w-16 ${ACTION_COLORS[log.action] || 'text-text-secondary'}`}>
                    {log.action}
                  </span>
                  <span className="text-sm text-text-primary flex-1">
                    <span className="text-text-tertiary">{log.resource}</span>
                    {log.resourceId && <span className="text-text-disabled text-xs ml-1">#{log.resourceId}</span>}
                  </span>
                  <span className="text-xs text-text-disabled">{log.userEmail}</span>
                  <span className="text-xs text-text-disabled">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-disabled text-center py-8">{t('noActivity')}</p>
          )}
        </Card>
      )}

      {/* Sync public content button */}
      {has('syncButton') && (
        <div className="p-4 bg-background border border-border rounded-xl space-y-3">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-white">{t('resyncTitle')}</p>
              <p className="text-xs text-text-tertiary mt-0.5">{t('resyncDesc')}</p>
              {syncMsg && <p className="text-xs text-green-400 mt-1">{syncMsg}</p>}
            </div>
            <button
              onClick={() => resyncContent(false)}
              disabled={syncing}
              className="px-4 py-2 text-xs font-medium bg-brand hover:bg-brand disabled:opacity-50 text-white rounded-lg transition-colors whitespace-nowrap"
            >
              {syncing ? t('syncing') : t('resyncBtn')}
            </button>
          </div>
          {/* Auto-sync timer */}
          <div className="flex items-center gap-3 pt-2 border-t border-border">
            <span className="text-xs text-text-secondary whitespace-nowrap">همگام‌سازی خودکار:</span>
            <div className="flex gap-1 flex-wrap">
              {[0, 5, 10, 15, 20, 30, 60].map(m => (
                <button key={m} onClick={() => setAutoSyncInterval(m)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${autoSyncInterval === m ? 'bg-brand text-white' : 'bg-surface-2 text-text-secondary hover:text-white'}`}>
                  {m === 0 ? 'خاموش' : `${m} دقیقه`}
                </button>
              ))}
            </div>
            {autoSyncInterval > 0 && nextSyncIn > 0 && (
              <span className="text-xs text-text-tertiary mr-auto whitespace-nowrap">
                {Math.floor(nextSyncIn / 60)}:{String(nextSyncIn % 60).padStart(2, '0')} مانده
              </span>
            )}
          </div>
        </div>
      )}

      {/* Quick Links */}
      {has('quickLinks') && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Edit Hero', href: '/admin/hero', icon: '⬡', color: '#6366f1' },
            { label: 'New Case Study', href: '/admin/projects', icon: '◆', color: '#818cf8' },
            { label: 'View Contacts', href: '/admin/contacts', icon: '✉', color: '#f59e0b' },
            { label: 'Media Upload', href: '/admin/media', icon: '▤', color: '#06b6d4' },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:bg-surface-2 transition-colors group"
            >
              <span className="text-xl" style={{ color: item.color }}>{item.icon}</span>
              <span className="text-sm font-medium text-text-primary group-hover:text-white">{item.label}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
