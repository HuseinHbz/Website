'use client'

import { useCallback, useEffect, useState } from 'react'
import { fmtMoney } from '@/lib/format'
import { useDisplayCurrency, CurrencyPicker } from '@/lib/admin/currencyDisplay'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Card, Btn } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'

const ViewsChart = dynamic(() => import('./ViewsChart'), { ssr: false, loading: () => <div className="h-[200px] animate-pulse rounded-lg bg-surface-2" /> })

interface FinanceK { totalAssets: number; totalLiabilities: number; totalEquity: number; revenue: number; expenses: number; netIncome: number; cash: number }
interface InvK { totalProducts: number; totalOnHand: number; totalValue: number; outOfStock: number; needReorder: number; overstock: number }
interface AssetK { total: number; active: number; totalCost: number; totalBookValue: number; totalDepreciation: number; warrantyExpiring: number; warrantyExpired: number; openMaintenance: number }
interface CrmK { total: number; count: number; openValue: number; wonValue: number; winRate: number; avgScore: number; byStatus: Record<string, number> }
interface AiK { totalCalls: number; successRate: number; avgLatencyMs: number; totalTokens: number; failedCalls: number; thumbsUp: number; thumbsDown: number }
interface Alert { level: 'critical' | 'warning'; module: string; message: string; messageFa: string }
interface Activity { id: number; userEmail: string; action: string; resource: string; resourceId: string; createdAt: string }
interface Overview { finance: FinanceK | null; inventory: InvK | null; assets: AssetK | null; crm: CrmK | null; ai: AiK | null; activity: Activity[]; alerts: Alert[]; generatedAt: string }
interface Traffic { stats: { totalViews: number; weeklyViews: number; newContacts: number; newConsultations: number; publishedPosts: number; activeProjects: number }; dailyViews: { date: string; count: number }[]; topPages: { page: string; count: number }[] }

const ACTION_COLOR: Record<string, string> = { CREATE: 'text-success-text', UPDATE: 'text-info-text', DELETE: 'text-danger-text', LOGIN: 'text-warning-text' }
const money = (n: number | null | undefined) => fmtMoney(n, { signed: true })
function num(n: number | undefined | null): string { return (n ?? 0).toLocaleString() }

export function ExecutiveDashboard() {
  const { money: dmoney } = useDisplayCurrency()
  const t = useT()
  const locale = useAdminLocale()
  const [ov, setOv] = useState<Overview | null>(null)
  const [tr, setTr] = useState<Traffic | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [o, d] = await Promise.all([
        fetch('/api/admin/overview').then(r => r.ok ? r.json() : null),
        fetch('/api/admin/dashboard').then(r => r.ok ? r.json() : null),
      ])
      setOv(o); setTr(d)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  if (loading && !ov) return <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-surface-2" />)}</div>

  const f = ov?.finance, inv = ov?.inventory, a = ov?.assets, crm = ov?.crm, ai = ov?.ai
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-text-primary">{t('dash_execTitle')}</h2>
          <p className="text-xs text-text-tertiary">{ov ? `${t('dash_updated')} ${new Date(ov.generatedAt).toLocaleTimeString()}` : ''}</p>
        </div>
        <Btn size="sm" variant="secondary" onClick={load} disabled={loading}>{t('dash_refresh')}</Btn>
      </div>

      {/* Alerts */}
      {ov && ov.alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ov.alerts.map((al, i) => (
            <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs border ${al.level === 'critical' ? 'border-danger/40 bg-danger/10 text-danger-text' : 'border-warning/40 bg-warning/10 text-warning-text'}`}>
              <span aria-hidden>{al.level === 'critical' ? '⛔' : '⚠️'}</span>{locale === 'fa' ? al.messageFa : al.message}
            </div>
          ))}
        </div>
      )}

      {/* Hero KPIs */}
      <div className="flex justify-end"><CurrencyPicker /></div>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Hero label={t('dash_netIncome')} value={dmoney(f?.netIncome ?? 0)} icon="💰" href="/admin/finance" tone={(f?.netIncome ?? 0) >= 0 ? 'ok' : 'bad'} />
        <Hero label={t('dash_cash')} value={dmoney(f?.cash ?? 0)} icon="🏦" href="/admin/finance" />
        <Hero label={t('dash_invValue')} value={dmoney(inv?.totalValue ?? 0)} icon="📦" href="/admin/inventory" />
        <Hero label={t('dash_assetValue')} value={dmoney(a?.totalBookValue ?? 0)} icon="🖥️" href="/admin/assets" />
        <Hero label={t('dash_pipeline')} value={dmoney(crm?.openValue ?? 0)} icon="📇" href="/admin/crm" />
        <Hero label={t('dash_aiCalls')} value={num(ai?.totalCalls)} icon="✨" href="/admin/ai-analytics" />
      </div>

      {/* Module panels */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        <ModulePanel title={t('dash_finance')} href="/admin/finance" icon="💵" empty={!f} t={t}
          rows={f ? [[t('dash_assets'), money(f.totalAssets)], [t('dash_liabilities'), money(f.totalLiabilities)], [t('dash_equity'), money(f.totalEquity)], [t('dash_revenue'), money(f.revenue)], [t('dash_expenses'), money(f.expenses)]] : []} />
        <ModulePanel title={t('dash_inventory')} href="/admin/inventory" icon="📦" empty={!inv} t={t}
          rows={inv ? [[t('dash_products'), num(inv.totalProducts)], [t('dash_onHand'), num(inv.totalOnHand)], [t('dash_value'), money(inv.totalValue)], [t('dash_outOfStock'), num(inv.outOfStock)], [t('dash_reorder'), num(inv.needReorder)]] : []} />
        <ModulePanel title={t('dash_assetsMod')} href="/admin/assets" icon="🖥️" empty={!a} t={t}
          rows={a ? [[t('dash_total'), num(a.total)], [t('dash_cost'), money(a.totalCost)], [t('dash_book'), money(a.totalBookValue)], [t('dash_warrantyExp'), num(a.warrantyExpiring + a.warrantyExpired)], [t('dash_openMaint'), num(a.openMaintenance)]] : []} />
        <ModulePanel title={t('dash_crm')} href="/admin/crm" icon="📇" empty={!crm} t={t}
          rows={crm ? [[t('dash_leads'), num(crm.count)], [t('dash_pipelineVal'), money(crm.openValue)], [t('dash_won'), money(crm.wonValue)], [t('dash_winRate'), `${crm.winRate}%`], [t('dash_avgScore'), num(crm.avgScore)]] : []} />
        <ModulePanel title={t('dash_ai')} href="/admin/ai-analytics" icon="✨" empty={!ai} t={t}
          rows={ai ? [[t('dash_calls'), num(ai.totalCalls)], [t('dash_success'), `${ai.successRate}%`], [t('dash_latency'), `${num(ai.avgLatencyMs)}ms`], [t('dash_tokens'), num(ai.totalTokens)], [t('dash_feedback'), `👍${ai.thumbsUp} 👎${ai.thumbsDown}`]] : []} />
        <ModulePanel title={t('dash_traffic')} href="/admin/dashboard" icon="📊" empty={!tr} t={t}
          rows={tr ? [[t('dash_totalViews'), num(tr.stats.totalViews)], [t('dash_weekly'), num(tr.stats.weeklyViews)], [t('dash_contacts'), num(tr.stats.newContacts)], [t('dash_consultations'), num(tr.stats.newConsultations)], [t('dash_posts'), num(tr.stats.publishedPosts)]] : []} />
      </div>

      {/* Traffic chart + activity feed */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-text-primary mb-4">{t('dash_trafficTrend')}</h3>
          {tr && tr.dailyViews.length > 0 ? <ViewsChart data={tr.dailyViews} locale={locale} /> : <p className="text-xs text-text-tertiary">{t('dash_noData')}</p>}
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t('dash_activity')}</h3>
          {!ov || ov.activity.length === 0 ? <p className="text-xs text-text-tertiary">{t('dash_noActivity')}</p> : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {ov.activity.map(x => (
                <div key={x.id} className="flex items-start gap-2 text-xs">
                  <span className={`font-semibold shrink-0 ${ACTION_COLOR[x.action] ?? 'text-text-tertiary'}`}>{x.action}</span>
                  <span className="text-text-secondary flex-1 truncate">{x.resource}{x.resourceId ? ` #${x.resourceId}` : ''}</span>
                  <span className="text-text-disabled shrink-0">{new Date(x.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
type T = ReturnType<typeof useT>

function Hero({ label, value, icon, href, tone }: { label: string; value: string; icon: string; href: string; tone?: 'ok' | 'bad' }) {
  const ring = tone === 'ok' ? 'border-success/40' : tone === 'bad' ? 'border-danger/40' : 'border-subtle'
  return (
    <Link href={href} className={`group rounded-2xl p-5 bg-surface-2 border ${ring} hover:border-brand/50 transition-colors`}>
      <div className="flex items-center justify-between mb-2"><p className="text-xs text-text-tertiary">{label}</p><span className="text-lg opacity-70 group-hover:opacity-100" aria-hidden>{icon}</span></div>
      <p className="text-2xl font-black text-text-primary tracking-tight">{value}</p>
    </Link>
  )
}

function ModulePanel({ title, href, icon, rows, empty, t }: { title: string; href: string; icon: string; rows: [string, string][]; empty: boolean; t: T }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2"><span aria-hidden>{icon}</span>{title}</h3>
        <Link href={href} className="text-xs text-brand hover:underline">{t('dash_open')}</Link>
      </div>
      {empty ? <p className="text-xs text-text-tertiary">{t('dash_noData')}</p> : (
        <div className="space-y-1.5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm"><span className="text-text-tertiary text-xs">{k}</span><span className="text-text-secondary font-medium">{v}</span></div>
          ))}
        </div>
      )}
    </Card>
  )
}
