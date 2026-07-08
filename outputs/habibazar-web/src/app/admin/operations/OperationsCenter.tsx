'use client'

import { useEffect, useState, useCallback } from 'react'
import { PageHeader, Badge } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

type Health = 'healthy' | 'warning' | 'critical' | 'offline'
interface Subsystem { name: string; status: Health; detail: string }
interface Overview {
  infra: { hostname: string; platform: string; release: string; arch: string; node: string; dbVersion: string | null; cpuModel: string; cpuCount: number; uptimeSec: number; processUptimeSec: number; env: string }
  metrics: {
    cpuLoad1: number; cpuLoadPct: number; memUsedMb: number; memTotalMb: number; memPct: number; rssMb: number; heapUsedMb: number
    diskUsedPct: number | null; diskFreeGb: number | null; diskTotalGb: number | null; dbLatencyMs: number | null; dbSizeMb: number | null
    requestsPerMin: number; errorRatePct: number; successRatePct: number; logs24h: number; errors24h: number
  }
  subsystems: Subsystem[]
  recentErrors: { ts: string; source: string; service: string; message: string }[]
  sre: { availabilityPct: number; sloTarget: number; errorBudgetPct: number; latencyBudgetOk: boolean }
  generatedAt: string
}

const HEALTH_COLOR: Record<Health, string> = { healthy: 'green', warning: 'yellow', critical: 'red', offline: 'slate' }
const HEALTH_DOT: Record<Health, string> = { healthy: 'bg-success', warning: 'bg-warning', critical: 'bg-danger', offline: 'bg-text-disabled' }

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60)
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'warn' | 'bad' }) {
  const ring = tone === 'ok' ? 'border-success/40' : tone === 'warn' ? 'border-warning/40' : tone === 'bad' ? 'border-danger/40' : 'border-subtle'
  return (
    <div className={`rounded-xl p-4 bg-surface-2 border ${ring}`}>
      <p className="text-xs text-text-tertiary mb-1">{label}</p>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      {sub && <p className="text-2xs text-text-tertiary mt-1 truncate">{sub}</p>}
    </div>
  )
}
function Bar({ pct, tone }: { pct: number; tone: 'ok' | 'warn' | 'bad' }) {
  const c = tone === 'bad' ? 'bg-danger' : tone === 'warn' ? 'bg-warning' : 'bg-success'
  return <div className="h-1.5 rounded-full bg-sunken overflow-hidden mt-1"><div className={`h-full rounded-full ${c}`} style={{ width: `${Math.min(100, Math.max(2, pct))}%` }} /></div>
}
const tone = (p: number | null, warn: number, bad: number): 'ok' | 'warn' | 'bad' => p == null ? 'warn' : p >= bad ? 'bad' : p >= warn ? 'warn' : 'ok'

type ErrRow = { ts: string; source: string; service: string; message: string }

export function OperationsCenter() {
  const t = useT()
  const opsLocale = useAdminLocale()
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [updated, setUpdated] = useState<Date>(new Date())
  const [tab, setTab] = useState<'overview' | 'infrastructure' | 'errors'>('overview')

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/operations/overview')
      if (r.ok) { setData(await r.json()); setUpdated(new Date()) }
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { const id = setInterval(load, 10000); return () => clearInterval(id) }, [load]) // auto-refresh

  const TABS = ['overview', 'infrastructure', 'errors'] as const
  const m = data?.metrics

  return (
    <div>
      <PageHeader title={t('operationsTitle')} subtitle={`Last updated: ${updated.toLocaleTimeString()}`} />

      <div className="flex gap-2 mb-6 flex-wrap items-center">
        {TABS.map((x) => (
          <button key={x} onClick={() => setTab(x)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === x ? 'bg-brand text-white' : 'bg-surface-2 text-text-secondary hover:text-white'}`}>
            {x}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-2 text-xs text-text-tertiary">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse inline-block" /> Live · 10s
        </span>
      </div>

      {loading && !data ? (
        <p className="text-sm text-text-tertiary">{t('loading')}</p>
      ) : !data || !m ? (
        <p className="text-sm text-text-tertiary">اطلاعات عملیاتی در دسترس نیست.</p>
      ) : tab === 'overview' ? (
        <div className="space-y-6">
          {/* SRE headline */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Metric label="Availability (core SLI)" value={`${data.sre.availabilityPct}%`} sub={`SLO ${data.sre.sloTarget}%`} tone={data.sre.availabilityPct >= 99 ? 'ok' : data.sre.availabilityPct >= 90 ? 'warn' : 'bad'} />
            <Metric label="Error budget" value={`${data.sre.errorBudgetPct}%`} sub={`${m.errorRatePct}% error rate`} tone={data.sre.errorBudgetPct >= 50 ? 'ok' : data.sre.errorBudgetPct >= 20 ? 'warn' : 'bad'} />
            <Metric label="Requests / min" value={String(m.requestsPerMin)} sub={`${m.logs24h} logs/24h`} />
            <Metric label="DB latency" value={m.dbLatencyMs == null ? '—' : `${m.dbLatencyMs}ms`} sub={m.dbSizeMb == null ? '' : `${m.dbSizeMb} MB`} tone={tone(m.dbLatencyMs, 100, 200)} />
          </div>

          {/* Live resource metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="rounded-xl p-4 bg-surface-2 border border-subtle">
              <div className="flex justify-between"><span className="text-xs text-text-tertiary">CPU load</span><span className="text-sm font-bold text-text-primary">{m.cpuLoadPct}%</span></div>
              <Bar pct={m.cpuLoadPct} tone={tone(m.cpuLoadPct, 70, 90)} />
              <p className="text-3xs text-text-tertiary mt-1">load1 {m.cpuLoad1} · {data.infra.cpuCount} vCPU</p>
            </div>
            <div className="rounded-xl p-4 bg-surface-2 border border-subtle">
              <div className="flex justify-between"><span className="text-xs text-text-tertiary">Memory</span><span className="text-sm font-bold text-text-primary">{m.memPct}%</span></div>
              <Bar pct={m.memPct} tone={tone(m.memPct, 80, 90)} />
              <p className="text-3xs text-text-tertiary mt-1">{m.memUsedMb}/{m.memTotalMb} MB · rss {m.rssMb} MB</p>
            </div>
            <div className="rounded-xl p-4 bg-surface-2 border border-subtle">
              <div className="flex justify-between"><span className="text-xs text-text-tertiary">Disk</span><span className="text-sm font-bold text-text-primary">{m.diskUsedPct == null ? 'n/a' : `${m.diskUsedPct}%`}</span></div>
              <Bar pct={m.diskUsedPct ?? 0} tone={tone(m.diskUsedPct, 80, 90)} />
              <p className="text-3xs text-text-tertiary mt-1">{m.diskFreeGb == null ? '—' : `${m.diskFreeGb} GB free / ${m.diskTotalGb} GB`}</p>
            </div>
          </div>

          {/* Subsystem health matrix */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-text-disabled mb-3">Subsystem Health</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.subsystems.map((s) => (
                <div key={s.name} className="rounded-xl p-4 flex items-center gap-3 bg-surface-2 border border-subtle">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${HEALTH_DOT[s.status]} ${s.status !== 'offline' ? 'animate-pulse' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-text-primary text-sm">{s.name}</div>
                    <div className="text-xs text-text-tertiary truncate">{s.detail}</div>
                  </div>
                  <Badge color={HEALTH_COLOR[s.status]}>{s.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : tab === 'infrastructure' ? (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl p-5 bg-surface-2 border border-subtle">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Runtime & OS</h3>
            <dl className="text-xs space-y-1.5">
              {[
                ['Hostname', data.infra.hostname], ['Platform', `${data.infra.platform} (${data.infra.arch})`],
                ['Kernel', data.infra.release], ['Node', data.infra.node], ['PostgreSQL', data.infra.dbVersion ?? '—'],
                ['Environment', data.infra.env], ['OS uptime', fmtUptime(data.infra.uptimeSec)], ['Process uptime', fmtUptime(data.infra.processUptimeSec)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4"><dt className="text-text-tertiary">{k}</dt><dd className="text-text-secondary font-mono truncate">{v}</dd></div>
              ))}
            </dl>
          </div>
          <div className="rounded-xl p-5 bg-surface-2 border border-subtle">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Compute & Storage</h3>
            <dl className="text-xs space-y-1.5">
              {[
                ['CPU', `${data.infra.cpuModel}`], ['vCPUs', String(data.infra.cpuCount)], ['CPU load (1m)', `${m.cpuLoad1} (${m.cpuLoadPct}%)`],
                ['Memory', `${m.memUsedMb}/${m.memTotalMb} MB (${m.memPct}%)`], ['Heap used', `${m.heapUsedMb} MB`],
                ['Disk', m.diskTotalGb == null ? 'n/a' : `${m.diskFreeGb}/${m.diskTotalGb} GB free (${m.diskUsedPct}% used)`],
                ['DB size', m.dbSizeMb == null ? '—' : `${m.dbSizeMb} MB`], ['DB latency', m.dbLatencyMs == null ? '—' : `${m.dbLatencyMs} ms`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4"><dt className="text-text-tertiary">{k}</dt><dd className="text-text-secondary font-mono truncate">{v}</dd></div>
              ))}
            </dl>
          </div>
        </div>
      ) : (
        <DataTable
          tableId="ops-recent-errors"
          columns={[
            { key: 'ts', labelEn: 'Time', labelFa: 'زمان', type: 'date', render: e => <span className="text-text-tertiary font-mono text-xs whitespace-nowrap">{new Date(e.ts).toLocaleTimeString()}</span> },
            { key: 'source', labelEn: 'Source', labelFa: 'منبع', type: 'enum', render: e => <Badge color="red">{e.source}</Badge> },
            { key: 'service', labelEn: 'Service', labelFa: 'سرویس', type: 'enum', render: e => <span className="text-text-tertiary text-xs">{e.service}</span> },
            { key: 'message', labelEn: 'Message', labelFa: 'پیام', render: e => <span className="text-text-primary font-mono text-xs break-all">{e.message}</span> },
          ] as Column<ErrRow>[]}
          rows={data.recentErrors}
          locale={opsLocale}
          rowKey={e => `${e.ts}-${e.message}`}
          exportName="recent-errors"
          emptyLabel={`No errors logged — ${m.successRatePct}% success rate over 24h.`}
        />
      )}
    </div>
  )
}
