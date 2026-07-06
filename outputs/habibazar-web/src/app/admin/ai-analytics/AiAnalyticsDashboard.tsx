'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, PageHeader, Badge } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

interface Breakdown { key: string; calls: number; tokens: number }
interface DailyPoint { date: string; calls: number; failures: number; tokens: number }
interface Summary {
  totalCalls: number; successCalls: number; failedCalls: number; successRate: number
  avgLatencyMs: number; p95LatencyMs: number
  inputTokens: number; outputTokens: number; totalTokens: number; estCostUsd: number
  ragHitRate: number; thumbsUp: number; thumbsDown: number
  byProvider: Breakdown[]; byModel: Breakdown[]; bySource: Breakdown[]
  daily: DailyPoint[]
  recentFailures: { ts: string; provider: string; source: string; error: string }[]
}

const RANGES = [7, 30, 90]

function num(n: number): string { return n.toLocaleString() }

export function AiAnalyticsDashboard() {
  const t = useT()
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/ai/analytics?days=${days}`)
      if (r.ok) { const d = await r.json(); setData(d.summary) }
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [days])
  useEffect(() => { load() }, [load])

  const maxDaily = data ? Math.max(1, ...data.daily.map(d => d.calls)) : 1

  return (
    <>
      <PageHeader
        title={t('aan_title')}
        subtitle={t('aan_subtitle')}
        action={
          <div className="flex gap-1">
            {RANGES.map(r => (
              <button key={r} onClick={() => setDays(r)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium ${days === r ? 'bg-brand text-white' : 'bg-surface-2 text-text-secondary border border-border'}`}>
                {r}{t('aan_daySuffix')}
              </button>
            ))}
          </div>
        }
      />

      {loading && !data ? (
        <p className="text-sm text-text-tertiary">{t('aan_loading')}</p>
      ) : !data || data.totalCalls === 0 ? (
        <Card className="p-5"><p className="text-sm text-text-tertiary">{t('aan_empty')}</p></Card>
      ) : (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Tile label={t('aan_calls')} value={num(data.totalCalls)} />
            <Tile label={t('aan_successRate')} value={`${data.successRate}%`} tone={data.successRate >= 95 ? 'ok' : data.successRate >= 80 ? 'warn' : 'bad'} />
            <Tile label={t('aan_avgLatency')} value={`${num(data.avgLatencyMs)}ms`} sub={`p95 ${num(data.p95LatencyMs)}ms`} />
            <Tile label={t('aan_totalTokens')} value={num(data.totalTokens)} sub={`${num(data.inputTokens)} ⇢ ${num(data.outputTokens)}`} />
            <Tile label={t('aan_estCost')} value={data.estCostUsd > 0 ? `$${data.estCostUsd}` : '—'} sub={data.estCostUsd > 0 ? undefined : t('aan_costHint')} />
            <Tile label={t('aan_ragHit')} value={`${data.ragHitRate}%`} />
            <Tile label={t('aan_failures')} value={num(data.failedCalls)} tone={data.failedCalls > 0 ? 'bad' : 'ok'} />
            <Tile label={t('aan_feedback')} value={`👍 ${data.thumbsUp} · 👎 ${data.thumbsDown}`} />
          </div>

          {/* Daily activity */}
          <Card className="p-5 mb-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4">{t('aan_daily')}</h3>
            {data.daily.length === 0 ? (
              <p className="text-xs text-text-tertiary">{t('aan_empty')}</p>
            ) : (
              <div className="flex items-end gap-1 h-32">
                {data.daily.map(d => (
                  <div key={d.date} className="flex-1 flex flex-col items-center justify-end group" title={`${d.date} · ${d.calls} calls · ${d.failures} failed`}>
                    <div className="w-full rounded-t bg-brand/80 group-hover:bg-brand transition-colors" style={{ height: `${(d.calls / maxDaily) * 100}%` }} />
                    {d.failures > 0 && <div className="w-full bg-danger" style={{ height: `${(d.failures / maxDaily) * 100}%` }} />}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Breakdowns */}
          <div className="grid lg:grid-cols-3 gap-4 mb-6">
            <BreakdownCard title={t('aan_byProvider')} rows={data.byProvider} emptyLabel={t('aan_empty')} tokensLabel={t('aan_tokens')} callsLabel={t('aan_callsShort')} />
            <BreakdownCard title={t('aan_byModel')} rows={data.byModel} emptyLabel={t('aan_empty')} tokensLabel={t('aan_tokens')} callsLabel={t('aan_callsShort')} />
            <BreakdownCard title={t('aan_bySource')} rows={data.bySource} emptyLabel={t('aan_empty')} tokensLabel={t('aan_tokens')} callsLabel={t('aan_callsShort')} />
          </div>

          {/* Recent failures */}
          {data.recentFailures.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-3">{t('aan_recentFailures')}</h3>
              <div className="space-y-1.5">
                {data.recentFailures.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-text-disabled shrink-0 w-32 font-mono">{f.ts}</span>
                    <Badge color="slate">{f.provider}</Badge>
                    <Badge color="indigo">{f.source}</Badge>
                    <span className="flex-1 text-danger break-all">{f.error}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="mt-4"><Btn size="sm" variant="secondary" onClick={load}>{t('aan_refresh')}</Btn></div>
        </>
      )}
    </>
  )
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'warn' | 'bad' }) {
  const ring = tone === 'ok' ? 'border-success/40' : tone === 'warn' ? 'border-warning/40' : tone === 'bad' ? 'border-danger/40' : 'border-subtle'
  return (
    <div className={`rounded-xl p-4 bg-surface-2 border ${ring}`}>
      <p className="text-xs text-text-tertiary mb-1">{label}</p>
      <p className="text-xl font-bold text-text-primary">{value}</p>
      {sub && <p className="text-[11px] text-text-tertiary mt-0.5">{sub}</p>}
    </div>
  )
}

function BreakdownCard({ title, rows, emptyLabel, tokensLabel, callsLabel }: { title: string; rows: Breakdown[]; emptyLabel: string; tokensLabel: string; callsLabel: string }) {
  const max = Math.max(1, ...rows.map(r => r.calls))
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-3">{title}</h3>
      {rows.length === 0 ? <p className="text-xs text-text-tertiary">{emptyLabel}</p> : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.key}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-text-secondary font-mono truncate">{r.key}</span>
                <span className="text-text-tertiary">{r.calls} {callsLabel} · {r.tokens.toLocaleString()} {tokensLabel}</span>
              </div>
              <div className="h-1.5 rounded-full bg-sunken overflow-hidden"><div className="h-full rounded-full bg-brand" style={{ width: `${(r.calls / max) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
