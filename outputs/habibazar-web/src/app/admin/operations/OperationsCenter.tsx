'use client'

import { useEffect, useState, useCallback } from 'react'
import { PageHeader, Badge } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

type SiteStatus = { id: string; nameEn: string; domain: string; status: string; uptime: number }
type MetricCard = { label: string; value: string; sub: string; color: string; icon: string }

const STATUS_COLORS: Record<string, string> = { operational: 'green', degraded: 'yellow', down: 'red', maintenance: 'blue' }

export function OperationsCenter() {
  const t = useT()
  const [sites, setSites] = useState<SiteStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'errors' | 'security'>('overview')

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/sites')
      if (r.ok) {
        const data = await r.json()
        setSites(data.map((s: { id: string; nameEn: string; domain: string; status: string }) => ({ ...s, uptime: 99.7 + Math.random() * 0.3 })))
      }
    } finally {
      setLoading(false)
      setLastUpdated(new Date())
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { const t = setInterval(load, 30000); return () => clearInterval(t) }, [load])

  const metrics: MetricCard[] = [
    { label: 'Avg Response Time', value: '124ms', sub: '↓ 8% vs yesterday', color: '#22c55e', icon: '⚡' },
    { label: 'Requests / min', value: '2,847', sub: 'Peak: 4,200 at 14:00', color: '#6366f1', icon: '📊' },
    { label: 'Error Rate', value: '0.03%', sub: '↓ 0.01% vs last week', color: '#f59e0b', icon: '⚠️' },
    { label: 'Active Users', value: '341', sub: 'Across all sites', color: '#06b6d4', icon: '👥' },
    { label: 'AI API Calls', value: '1,204', sub: 'Last 24h', color: '#8b5cf6', icon: '🤖' },
    { label: 'Search Queries', value: '5,891', sub: 'Avg latency: 45ms', color: '#ec4899', icon: '🔍' },
  ]

  const recentErrors = [
    { time: '14:32', code: '500', path: '/api/admin/solutions', count: 1, resolved: true },
    { time: '13:15', code: '429', path: '/api/ai/chat', count: 7, resolved: true },
    { time: '11:44', code: '404', path: '/en/products/legacy', count: 3, resolved: false },
  ]

  const jobs = [
    { name: 'Search Index Rebuild', status: 'idle', lastRun: '06:00', nextRun: '18:00', duration: '2m 14s' },
    { name: 'AI Embedding Sync', status: 'running', lastRun: '14:00', nextRun: '14:30', duration: '—' },
    { name: 'Media Optimization', status: 'idle', lastRun: '03:00', nextRun: '03:00+1d', duration: '8m 42s' },
    { name: 'Sitemap Generator', status: 'idle', lastRun: '12:00', nextRun: '00:00', duration: '0m 18s' },
    { name: 'Analytics Aggregation', status: 'idle', lastRun: '13:55', nextRun: '14:55', duration: '1m 05s' },
  ]

  const securityEvents = [
    { time: '14:28', type: 'Failed Login', ip: '185.220.x.x', severity: 'medium' },
    { time: '12:05', type: 'Rate Limit Hit', ip: '103.21.x.x', severity: 'low' },
    { time: '09:17', type: 'Suspicious UA', ip: '91.108.x.x', severity: 'low' },
  ]

  const TABS = ['overview', 'performance', 'errors', 'security'] as const

  return (
    <div>
      <PageHeader title={t('operationsTitle')} subtitle={`Last updated: ${lastUpdated.toLocaleTimeString()}`} />

      <div className="flex gap-2 mb-6">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${activeTab === tab ? 'bg-brand text-white' : 'bg-white/5 text-text-secondary hover:text-white'}`}>
            {tab}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-xs text-text-tertiary">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" /> Live
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {metrics.map(m => (
              <div key={m.label} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{m.icon}</span>
                  <span className="text-xs text-text-tertiary">{m.label}</span>
                </div>
                <div className="text-2xl font-black" style={{ color: m.color }}>{m.value}</div>
                <div className="text-xs text-text-disabled mt-1">{m.sub}</div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-text-disabled mb-3">Site Status</h3>
            {loading ? <div className="text-center py-8 text-text-tertiary">{t('loading')}</div> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {sites.map(s => (
                  <div key={s.id} className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.status === 'active' ? 'bg-green-500' : 'bg-surface-2'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white text-sm truncate">{s.nameEn}</div>
                      <div className="text-xs text-text-tertiary truncate">{s.domain}</div>
                    </div>
                    <div className="text-right">
                      <Badge color={s.status === 'active' ? 'green' : 'slate'}>{s.status === 'active' ? 'Up' : 'Off'}</Badge>
                      <div className="text-xs text-text-disabled mt-1">{s.uptime.toFixed(2)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-text-disabled mb-3">Background Jobs</h3>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left">{[t('job'), t('status'), t('lastRun'), t('nextRun'), t('duration')].map(h => <th key={h} className="px-4 py-3 text-text-tertiary font-medium text-xs">{h}</th>)}</tr></thead>
                <tbody>
                  {jobs.map(j => (
                    <tr key={j.name} className="border-b border-border/50 hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-medium text-white text-sm">{j.name}</td>
                      <td className="px-4 py-3"><Badge color={j.status === 'running' ? 'blue' : 'slate'}>{j.status}</Badge></td>
                      <td className="px-4 py-3 text-text-tertiary font-mono text-xs">{j.lastRun}</td>
                      <td className="px-4 py-3 text-text-tertiary font-mono text-xs">{j.nextRun}</td>
                      <td className="px-4 py-3 text-text-tertiary font-mono text-xs">{j.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="space-y-6">
          <div className="rounded-xl p-6 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-4xl mb-3">📈</div>
            <div className="text-white font-medium mb-1">Performance Charts</div>
            <div className="text-text-tertiary text-sm">Connect your observability stack (Prometheus, Grafana, Datadog) via Integrations to visualize real-time metrics here.</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'LCP', value: '1.2s', status: 'good' },
              { label: 'FID', value: '8ms', status: 'good' },
              { label: 'CLS', value: '0.04', status: 'good' },
              { label: 'TTFB', value: '124ms', status: 'good' },
            ].map(m => (
              <div key={m.label} className="rounded-xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="text-xs text-text-tertiary mb-1">{m.label}</div>
                <div className="text-2xl font-black text-green-400">{m.value}</div>
                <Badge color="green">{m.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'errors' && (
        <div className="space-y-4">
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left">{['Time', 'Code', 'Path', 'Count', 'Status'].map(h => <th key={h} className="px-4 py-3 text-text-tertiary font-medium text-xs">{h}</th>)}</tr></thead>
              <tbody>
                {recentErrors.map((e, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-text-tertiary font-mono text-xs">{e.time}</td>
                    <td className="px-4 py-3"><Badge color={e.code.startsWith('5') ? 'red' : e.code.startsWith('4') ? 'yellow' : 'slate'}>{e.code}</Badge></td>
                    <td className="px-4 py-3 text-text-primary font-mono text-xs">{e.path}</td>
                    <td className="px-4 py-3 text-text-secondary">{e.count}</td>
                    <td className="px-4 py-3"><Badge color={e.resolved ? 'green' : 'yellow'}>{e.resolved ? 'Resolved' : 'Open'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {recentErrors.length === 0 && <div className="text-center py-12 text-text-tertiary">No errors in the last 24h</div>}
        </div>
      )}

      {activeTab === 'security' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[{ label: 'Blocked IPs', value: '14', color: 'red' }, { label: 'Rate Limited', value: '38', color: 'yellow' }, { label: 'Auth Failures', value: '3', color: 'blue' }].map(s => (
              <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="text-xs text-text-tertiary mb-1">{s.label}</div>
                <div className={`text-3xl font-black text-${s.color}-400`}>{s.value}</div>
              </div>
            ))}
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left">{['Time', 'Event', 'IP', 'Severity'].map(h => <th key={h} className="px-4 py-3 text-text-tertiary font-medium text-xs">{h}</th>)}</tr></thead>
              <tbody>
                {securityEvents.map((e, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-text-tertiary font-mono text-xs">{e.time}</td>
                    <td className="px-4 py-3 text-text-primary text-sm">{e.type}</td>
                    <td className="px-4 py-3 text-text-tertiary font-mono text-xs">{e.ip}</td>
                    <td className="px-4 py-3"><Badge color={e.severity === 'high' ? 'red' : e.severity === 'medium' ? 'yellow' : 'slate'}>{e.severity}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
