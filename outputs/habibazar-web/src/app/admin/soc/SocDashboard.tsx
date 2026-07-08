'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, PageHeader, Badge } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

type Risk = 'low' | 'medium' | 'high' | 'critical'
interface Soc {
  windowHours: number
  risk: { level: Risk; score: number }
  signals: { failedLogins: number; bruteForceIps: number; injectionBlocks: number; permissionDenied: number; rateLimited: number; securityErrors: number; successfulLogins: number }
  topIps: { ip: string; attempts: number }[]
  timeline: { ts: string; level: string; source: string; message: string }[]
  generatedAt: string
}

const RISK_COLOR: Record<Risk, string> = { low: 'green', medium: 'yellow', high: 'yellow', critical: 'red' }
const RISK_BG: Record<Risk, string> = { low: 'bg-success/10 border-success/40', medium: 'bg-warning/10 border-warning/40', high: 'bg-warning/10 border-warning/40', critical: 'bg-danger/10 border-danger/40' }

function Tile({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'warn' | 'bad' }) {
  const ring = tone === 'ok' ? 'border-success/40' : tone === 'warn' ? 'border-warning/40' : tone === 'bad' ? 'border-danger/40' : 'border-subtle'
  return (
    <div className={`rounded-xl p-4 bg-surface-2 border ${ring}`}>
      <p className="text-xs text-text-tertiary mb-1">{label}</p>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
    </div>
  )
}

export function SocDashboard() {
  const t = useT()
  const [data, setData] = useState<Soc | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/soc/overview')
      if (r.ok) setData(await r.json())
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id) }, [load])

  return (
    <>
      <PageHeader
        title={t('soc_title')}
        subtitle={data ? `${t('soc_last')} ${data.windowHours}h · ${t('soc_updated')} ${new Date(data.generatedAt).toLocaleTimeString()}` : undefined}
        action={<Btn size="sm" variant="secondary" onClick={load} disabled={loading}>{t('soc_refresh')}</Btn>}
      />

      {loading && !data ? (
        <p className="text-sm text-text-tertiary">{t('soc_loading')}</p>
      ) : !data ? (
        <Card className="p-5"><p className="text-sm text-text-tertiary">{t('soc_unavailable')}</p></Card>
      ) : (
        <>
          {/* Risk posture */}
          <div className={`rounded-xl p-5 mb-6 border ${RISK_BG[data.risk.level]}`}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs text-text-tertiary mb-1">{t('soc_posture')}</p>
                <p className="text-3xl font-black text-text-primary uppercase">{data.risk.level}</p>
              </div>
              <div className="text-right">
                <Badge color={RISK_COLOR[data.risk.level]}>{t('soc_riskScore')} {data.risk.score}</Badge>
                <p className="text-xs text-text-tertiary mt-1">{data.signals.successfulLogins} {t('soc_successfulLogins')}</p>
              </div>
            </div>
          </div>

          {/* Security signals */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
            <Tile label={t('soc_failedLogins')} value={data.signals.failedLogins} tone={data.signals.failedLogins > 0 ? 'warn' : 'ok'} />
            <Tile label={t('soc_bruteForceIps')} value={data.signals.bruteForceIps} tone={data.signals.bruteForceIps > 0 ? 'bad' : 'ok'} />
            <Tile label={t('soc_injectionBlocks')} value={data.signals.injectionBlocks} tone={data.signals.injectionBlocks > 0 ? 'warn' : 'ok'} />
            <Tile label={t('soc_permissionDenied')} value={data.signals.permissionDenied} tone={data.signals.permissionDenied > 0 ? 'warn' : 'ok'} />
            <Tile label={t('soc_rateLimited')} value={data.signals.rateLimited} tone={data.signals.rateLimited > 0 ? 'warn' : 'ok'} />
            <Tile label={t('soc_securityErrors')} value={data.signals.securityErrors} tone={data.signals.securityErrors > 0 ? 'bad' : 'ok'} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Top offending IPs */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-3">{t('soc_topIps')}</h3>
              {data.topIps.length === 0 ? (
                <p className="text-sm text-text-tertiary">{t('soc_noTopIps')}</p>
              ) : (
                <div className="space-y-2">
                  {data.topIps.map((r) => (
                    <div key={r.ip} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-text-secondary">{r.ip}</span>
                      <Badge color={r.attempts >= 5 ? 'red' : 'yellow'}>{r.attempts} {t('soc_attempts')}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Threat timeline */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-3">{t('soc_timeline')}</h3>
              {data.timeline.length === 0 ? (
                <p className="text-sm text-text-tertiary">{t('soc_noEvents')}</p>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {data.timeline.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="text-text-disabled shrink-0 w-14">{new Date(e.ts).toLocaleTimeString()}</span>
                      <Badge color={e.level === 'error' ? 'red' : e.level === 'warn' ? 'yellow' : 'slate'}>{e.source}</Badge>
                      <span className={`flex-1 break-all ${e.level === 'error' ? 'text-danger' : 'text-text-secondary'}`}>{e.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
          <p className="text-2xs text-text-tertiary mt-4">
            Built on real signal from the log bus + audit trail. Detailed streams in Logs & Monitoring; user 2FA/sessions in Security & 2FA.
          </p>
        </>
      )}
    </>
  )
}
