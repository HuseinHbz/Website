'use client'

import { useEffect, useState } from 'react'
import { Card, StatCard, PageHeader, Badge } from '@/components/admin/ui'
import { useAdminLocale, useT } from '@/lib/admin/locale'
import { faDigits } from '@/lib/admin/chartRtl'
import { fmtMoney } from '@/lib/format'

const L = (fa: boolean, en: string, f: string) => (fa ? f : en)
type MoM = { current: number; previous: number; deltaPct: number | null; direction: 'up' | 'down' | 'flat' }
interface Data {
  funnel: { byStatus: Record<string, number>; winRate: number; openValue: number }
  noActivityLeads: number; openTickets: number; breachedTickets: number
  aging: { current: number; d31_60: number; d61_90: number; d90plus: number; total: number }
  arBalance: number
  channels: { channel: string; sent: number; delivered: number; leads: number; won: number; spend: number }[]
  mom: { newLeads: MoM; wonValue: MoM; newTickets: MoM; newCustomers: MoM }
  // Phase 27 بند۴
  pipeline: { openCount: number; openValue: number; weightedValue: number; wonValue: number; winRatePct: number } | null
  losses: { reason: string; count: number; value: number }[]
  loyalty: { members: number; pointsOutstanding: number; liabilityValue: number; couponRedemptions: number; couponDiscount: number } | null
}

const STAGES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost']

export function CrmDashboard() {
  const locale = useAdminLocale()
  const t = useT()
  const fa = locale === 'fa'
  const num = (v: unknown) => (fa ? faDigits(String(v ?? '')) : String(v ?? ''))
  const [d, setD] = useState<Data | null>(null)
  useEffect(() => { fetch('/api/admin/crm/dashboard').then(r => r.json()).then(setD).catch(() => setD(null)) }, [])

  const Delta = ({ m }: { m: MoM }) => {
    const arrow = m.direction === 'up' ? '▲' : m.direction === 'down' ? '▼' : '■'
    const color = m.direction === 'up' ? 'text-success' : m.direction === 'down' ? 'text-danger-text' : 'text-text-tertiary'
    return <span className={`text-2xs ${color}`}>{arrow} {m.deltaPct === null ? L(fa, 'new', 'جدید') : `${num(Math.abs(m.deltaPct))}%`} <span className="text-text-tertiary">{L(fa, 'vs last month', 'نسبت به ماه قبل')}</span></span>
  }

  if (!d) return <p className="text-sm text-text-tertiary p-4">…</p>
  const maxStage = Math.max(1, ...STAGES.map(s => d.funnel.byStatus[s] ?? 0))

  return (
    <div className="space-y-5" dir={fa ? 'rtl' : 'ltr'}>
      <PageHeader title={L(fa, 'CRM Dashboard', 'داشبورد CRM')} subtitle={L(fa, 'Pipeline, activity, support and AR at a glance', 'قیف فروش، فعالیت، پشتیبانی و مطالبات')} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div><StatCard label={L(fa, 'New leads (MTD)', 'سرنخ جدید (این ماه)')} value={num(d.mom.newLeads.current)} /><div className="mt-1"><Delta m={d.mom.newLeads} /></div></div>
        <div><StatCard label={L(fa, 'Won value (MTD)', 'ارزش برنده (این ماه)')} value={fmtMoney(d.mom.wonValue.current)} /><div className="mt-1"><Delta m={d.mom.wonValue} /></div></div>
        <div><StatCard label={L(fa, 'New tickets (MTD)', 'تیکت جدید (این ماه)')} value={num(d.mom.newTickets.current)} /><div className="mt-1"><Delta m={d.mom.newTickets} /></div></div>
        <div><StatCard label={L(fa, 'New customers (MTD)', 'مشتری جدید (این ماه)')} value={num(d.mom.newCustomers.current)} /><div className="mt-1"><Delta m={d.mom.newCustomers} /></div></div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">{L(fa, 'Pipeline funnel', 'قیف فروش')}</h2>
          <div className="space-y-1.5">
            {STAGES.map(s => {
              const v = d.funnel.byStatus[s] ?? 0
              return (
                <div key={s} className="flex items-center gap-2">
                  <span className="w-20 text-xs text-text-secondary">{t(`lead_st_${s}`)}</span>
                  <div className="flex-1 bg-surface-2 rounded-full h-4 overflow-hidden">
                    <div className={`h-full ${s === 'won' ? 'bg-success' : s === 'lost' ? 'bg-danger' : 'bg-brand'}`} style={{ width: `${(v / maxStage) * 100}%` }} />
                  </div>
                  <span className="w-8 text-xs tabular-nums text-end">{num(v)}</span>
                </div>
              )
            })}
          </div>
          <div className="flex justify-between text-xs text-text-tertiary mt-3 pt-2 border-t border-subtle">
            <span>{L(fa, 'Win rate', 'نرخ برد')}: {num(d.funnel.winRate)}%</span>
            <span>{L(fa, 'Open value', 'ارزش باز')}: {fmtMoney(d.funnel.openValue)}</span>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">{L(fa, 'Attention needed', 'نیازمند توجه')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-surface-2 p-3"><div className="text-2xs text-text-tertiary">{L(fa, 'Leads with no activity 7d', 'سرنخ بدون فعالیت ۷ روز')}</div><div className="text-xl font-bold text-amber-500">{num(d.noActivityLeads)}</div></div>
            <div className="rounded-lg bg-surface-2 p-3"><div className="text-2xs text-text-tertiary">{L(fa, 'Open tickets', 'تیکت باز')}</div><div className="text-xl font-bold">{num(d.openTickets)}</div></div>
            <div className="rounded-lg bg-surface-2 p-3"><div className="text-2xs text-text-tertiary">{L(fa, 'SLA-breached tickets', 'تیکت نقض SLA')}</div><div className="text-xl font-bold text-danger-text">{num(d.breachedTickets)}</div></div>
            <div className="rounded-lg bg-surface-2 p-3"><div className="text-2xs text-text-tertiary">{L(fa, 'AR balance', 'مانده دریافتنی')}</div><div className="text-xl font-bold">{fmtMoney(d.arBalance)}</div></div>
          </div>
          <h3 className="text-xs font-semibold mt-4 mb-2">{L(fa, 'Receivables aging', 'سن‌بندی مطالبات')}</h3>
          {([['current', '0-30'], ['d31_60', '31-60'], ['d61_90', '61-90'], ['d90plus', '90+']] as const).map(([k, lbl]) => (
            <div key={k} className="flex justify-between text-xs py-0.5"><span className="text-text-tertiary">{num(lbl)}</span><span>{fmtMoney(d.aging[k])}</span></div>
          ))}
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3">{L(fa, 'Campaign performance by channel', 'عملکرد کمپین بر اساس کانال')}</h2>
        {d.channels.length === 0 ? <p className="text-sm text-text-tertiary">{L(fa, 'No campaign activity yet', 'هنوز فعالیت کمپینی نیست')}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-2xs text-text-tertiary text-start">
                <th className="text-start py-1">{L(fa, 'Channel', 'کانال')}</th><th className="text-end">{L(fa, 'Sent', 'ارسال')}</th>
                <th className="text-end">{L(fa, 'Delivered', 'تحویل')}</th><th className="text-end">{L(fa, 'Leads', 'سرنخ')}</th>
                <th className="text-end">{L(fa, 'Won', 'برنده')}</th><th className="text-end">{L(fa, 'Spend', 'هزینه')}</th></tr></thead>
              <tbody>
                {d.channels.map(c => (
                  <tr key={c.channel} className="border-t border-subtle">
                    <td className="py-1.5"><Badge>{c.channel}</Badge></td>
                    <td className="text-end tabular-nums">{num(c.sent)}</td>
                    <td className="text-end tabular-nums">{num(c.delivered)}</td>
                    <td className="text-end tabular-nums">{num(c.leads)}</td>
                    <td className="text-end tabular-nums text-success">{num(c.won)}</td>
                    <td className="text-end tabular-nums">{fmtMoney(c.spend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Phase 27 بند۴ — the DEAL pipeline (weighted), beside the lead funnel.
          The raw open value always flatters a forecast; the weighted figure is
          the one a sales manager can commit to. */}
      {d.pipeline && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{L(fa, 'Opportunity pipeline', 'خط لولهٔ فرصت‌ها')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded-lg bg-surface-2 p-3"><div className="text-2xs text-text-tertiary">{L(fa, 'Open deals', 'فرصت باز')}</div><div className="text-xl font-bold">{num(d.pipeline.openCount)}</div></div>
            <div className="rounded-lg bg-surface-2 p-3"><div className="text-2xs text-text-tertiary">{L(fa, 'Pipeline value', 'ارزش خط لوله')}</div><div className="text-xl font-bold">{fmtMoney(d.pipeline.openValue)}</div></div>
            <div className="rounded-lg bg-surface-2 p-3"><div className="text-2xs text-text-tertiary">{L(fa, 'Weighted value', 'ارزش وزنی')}</div><div className="text-xl font-bold text-brand">{fmtMoney(d.pipeline.weightedValue)}</div></div>
            <div className="rounded-lg bg-surface-2 p-3"><div className="text-2xs text-text-tertiary">{L(fa, 'Won', 'برد')}</div><div className="text-xl font-bold text-success">{fmtMoney(d.pipeline.wonValue)}</div></div>
            <div className="rounded-lg bg-surface-2 p-3"><div className="text-2xs text-text-tertiary">{L(fa, 'Win rate', 'نرخ برد')}</div><div className="text-xl font-bold">{num(d.pipeline.winRatePct)}٪</div></div>
          </div>
          {d.losses.length > 0 && (
            <div className="mt-4">
              <p className="text-2xs font-bold uppercase tracking-widest text-text-tertiary mb-2">{L(fa, 'Why we lose', 'چرا می‌بازیم')}</p>
              <div className="flex flex-wrap gap-2">
                {d.losses.slice(0, 6).map(l => (
                  <span key={l.reason} className="inline-flex items-center gap-2 rounded-lg border border-subtle px-3 py-1.5 text-xs">
                    <span className="text-text-secondary">{l.reason}</span>
                    <span className="text-text-primary font-semibold tabular-nums">{num(l.count)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Loyalty: the headline is the LIABILITY, because points are money owed. */}
      {d.loyalty && d.loyalty.members > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{L(fa, 'Loyalty club', 'باشگاه مشتریان')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg bg-surface-2 p-3"><div className="text-2xs text-text-tertiary">{L(fa, 'Members', 'اعضا')}</div><div className="text-xl font-bold">{num(d.loyalty.members)}</div></div>
            <div className="rounded-lg bg-surface-2 p-3"><div className="text-2xs text-text-tertiary">{L(fa, 'Points outstanding', 'امتیاز در گردش')}</div><div className="text-xl font-bold">{num(d.loyalty.pointsOutstanding)}</div></div>
            <div className="rounded-lg bg-surface-2 p-3"><div className="text-2xs text-text-tertiary">{L(fa, 'Open liability', 'بدهی باز')}</div><div className="text-xl font-bold text-warning">{fmtMoney(d.loyalty.liabilityValue)}</div></div>
            <div className="rounded-lg bg-surface-2 p-3"><div className="text-2xs text-text-tertiary">{L(fa, 'Coupon discount', 'تخفیف کوپن')}</div><div className="text-xl font-bold">{fmtMoney(d.loyalty.couponDiscount)}</div></div>
          </div>
        </Card>
      )}
    </div>
  )
}
