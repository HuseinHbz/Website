'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, StatCard, Badge, PageHeader } from '@/components/admin/ui'
import { useAdminLocale, useT } from '@/lib/admin/locale'
import { fmtMoney } from '@/lib/format'
import { faDigits } from '@/lib/admin/chartRtl'

interface Aging { current: number; d31_60: number; d61_90: number; d90plus: number; total: number }
interface Row { [k: string]: unknown }
interface Data {
  customer: Row; balance: number; aging: Aging; creditLimit: number; paymentTerms: number
  purchaseTotal: number; orders: Row[]; payments: Row[]; activities: Row[]; tickets: Row[]
  sourceLead: Row[]; contactReqs: Row[]; consultReqs: Row[]; channels: Row[]
  timeline: { at: string; type: string; label: string; ref?: string; amount?: number }[]
}

const lc = (fa: boolean, en: string, f: string) => (fa ? f : en)

export function Customer360({ id }: { id: number }) {
  const locale = useAdminLocale()
  const t = useT()
  const fa = locale === 'fa'
  const [d, setD] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [tlType, setTlType] = useState<'all' | 'order' | 'payment' | 'activity' | 'ticket'>('all')
  const [page, setPage] = useState(0)
  const PER = 15

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const r = await fetch(`/api/admin/crm/customers/${id}`)
      if (r.status === 404) { setErr(lc(fa, 'Customer not found', 'مشتری یافت نشد')); return }
      if (!r.ok) throw new Error('failed')
      setD(await r.json())
    } catch { setErr(lc(fa, 'Failed to load', 'خطا در بارگذاری')) } finally { setLoading(false) }
  }, [id, fa])
  useEffect(() => { load() }, [load])

  const num = (v: unknown) => (fa ? faDigits(String(v ?? '')) : String(v ?? ''))
  const money = (v: number) => fmtMoney(v)

  const timeline = useMemo(() => {
    if (!d) return []
    const f = tlType === 'all' ? d.timeline : d.timeline.filter(e => e.type === tlType)
    return f.slice(page * PER, page * PER + PER)
  }, [d, tlType, page])
  const totalTl = useMemo(() => (!d ? 0 : tlType === 'all' ? d.timeline.length : d.timeline.filter(e => e.type === tlType).length), [d, tlType])

  if (loading) return <p className="text-sm text-text-tertiary">{lc(fa, 'Loading…', 'در حال بارگذاری…')}</p>
  if (err) return <Card className="p-6 text-center text-sm text-danger-text">{err}</Card>
  if (!d) return null

  const c = d.customer as { name?: string; code?: string; kind?: string; email?: string; phone?: string; economicCode?: string; nationalId?: string }
  const overLimit = d.creditLimit > 0 && d.balance > d.creditLimit

  return (
    <div className="space-y-5" dir={fa ? 'rtl' : 'ltr'}>
      <PageHeader
        title={`${c.name ?? ''}`}
        subtitle={`${lc(fa, 'Code', 'کد')} ${num(c.code)} · ${c.kind === 'company' ? lc(fa, 'Company', 'حقوقی') : lc(fa, 'Individual', 'حقیقی')}`}
        action={<Link href="/admin/crm" className="text-sm text-brand hover:underline">← {t('nav_crm')}</Link>}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={lc(fa, 'AR balance', 'مانده دریافتنی')} value={money(d.balance)} />
        <StatCard label={lc(fa, 'Credit limit', 'سقف اعتبار')} value={d.creditLimit > 0 ? money(d.creditLimit) : lc(fa, 'No limit', 'بدون سقف')} />
        <StatCard label={lc(fa, 'Payment terms', 'مهلت پرداخت')} value={`${num(d.paymentTerms)} ${lc(fa, 'days', 'روز')}`} />
        <StatCard label={lc(fa, 'Lifetime purchases', 'مجموع خرید')} value={money(d.purchaseTotal)} />
      </div>
      {overLimit && (
        <Card className="p-3 border border-danger/40 bg-danger/5">
          <span className="text-sm text-danger-text">⚠ {lc(fa, 'Balance exceeds credit limit', 'مانده از سقف اعتبار عبور کرده')} — {money(d.balance)} / {money(d.creditLimit)}</span>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Contact + channels */}
        <Card className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">{lc(fa, 'Contact', 'تماس')}</h3>
          <dl className="text-xs space-y-1 text-text-secondary">
            {c.email && <div className="flex justify-between gap-2"><dt className="text-text-tertiary">{t('email')}</dt><dd className="font-mono">{c.email}</dd></div>}
            {c.phone && <div className="flex justify-between gap-2"><dt className="text-text-tertiary">{lc(fa, 'Phone', 'تلفن')}</dt><dd className="font-mono">{num(c.phone)}</dd></div>}
            {c.economicCode && <div className="flex justify-between gap-2"><dt className="text-text-tertiary">{lc(fa, 'Economic code', 'کد اقتصادی')}</dt><dd className="font-mono">{num(c.economicCode)}</dd></div>}
            {c.nationalId && <div className="flex justify-between gap-2"><dt className="text-text-tertiary">{lc(fa, 'National ID', 'شناسه/کد ملی')}</dt><dd className="font-mono">{num(c.nationalId)}</dd></div>}
          </dl>
          <h4 className="text-xs font-semibold text-text-primary pt-2">{lc(fa, 'Channels', 'کانال‌های ارتباطی')}</h4>
          <div className="flex flex-wrap gap-1.5">
            {d.channels.length === 0 && <span className="text-xs text-text-tertiary">{lc(fa, 'None', 'ندارد')}</span>}
            {d.channels.map((ch, i) => (
              <Badge key={i} color={ch.optIn ? 'green' : 'slate'}>
                {String(ch.channel)}{ch.optIn ? '' : ` (${lc(fa, 'opted out', 'لغو')})`}
              </Badge>
            ))}
          </div>
          {d.sourceLead.length > 0 && (
            <p className="text-xs text-text-tertiary pt-2">{lc(fa, 'Converted from lead', 'تبدیل از لید')}: <span className="text-brand">{String(d.sourceLead[0].name)}</span> ({String(d.sourceLead[0].source)})</p>
          )}
        </Card>

        {/* Aging */}
        <Card className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">{lc(fa, 'Receivables aging', 'سن‌بندی دریافتنی')}</h3>
          {([['current', '0-30'], ['d31_60', '31-60'], ['d61_90', '61-90'], ['d90plus', '90+']] as const).map(([k, label]) => {
            const v = d.aging[k]; const pct = d.aging.total > 0 ? (v / d.aging.total) * 100 : 0
            return (
              <div key={k} className="flex items-center gap-2 text-xs">
                <span className="w-14 text-text-tertiary">{num(label)}</span>
                <div className="flex-1 h-2.5 rounded bg-surface-2 overflow-hidden"><div className="h-full rounded bg-accent" style={{ width: `${Math.max(2, pct)}%` }} /></div>
                <span className="w-24 text-end tabular-nums text-text-secondary">{money(v)}</span>
              </div>
            )
          })}
          <div className="flex justify-between text-xs pt-1 border-t border-subtle font-semibold text-text-primary"><span>{lc(fa, 'Total', 'جمع')}</span><span>{money(d.aging.total)}</span></div>
        </Card>

        {/* Open invoices */}
        <Card className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">{lc(fa, 'Open invoices', 'فاکتورهای باز')}</h3>
          <div className="max-h-48 overflow-y-auto text-xs">
            {d.orders.filter((o) => o.docType === 'invoice').length === 0 && <span className="text-text-tertiary">{lc(fa, 'None', 'ندارد')}</span>}
            {d.orders.filter((o) => o.docType === 'invoice').slice(0, 20).map((o, i) => (
              <div key={i} className="flex justify-between py-1 border-b border-subtle/50">
                <Link href={`/admin/sales?doc=${o.id}`} className="text-brand hover:underline font-mono">{num(o.docNo)}</Link>
                <span className="text-text-secondary">{money(Number(o.total))}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Unified timeline */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-text-primary">{lc(fa, 'Timeline', 'تایم‌لاین')}</h3>
          <div className="flex gap-1">
            {(['all', 'order', 'payment', 'activity', 'ticket'] as const).map(v => (
              <button key={v} onClick={() => { setTlType(v); setPage(0) }} className={`px-2.5 py-1 rounded-md text-xs font-medium ${tlType === v ? 'bg-brand text-white' : 'bg-surface-2 text-text-secondary border border-border'}`}>
                {v === 'all' ? lc(fa, 'All', 'همه') : v === 'order' ? lc(fa, 'Orders', 'اسناد') : v === 'payment' ? lc(fa, 'Payments', 'پرداخت') : v === 'activity' ? lc(fa, 'Activity', 'فعالیت') : lc(fa, 'Tickets', 'تیکت')}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          {timeline.length === 0 && <p className="text-xs text-text-tertiary py-4 text-center">{lc(fa, 'No events', 'رویدادی نیست')}</p>}
          {timeline.map((e, i) => (
            <div key={i} className="flex items-center gap-3 text-xs py-1.5 border-b border-subtle/40">
              <span className="w-24 shrink-0 text-text-tertiary tabular-nums">{num(e.at)}</span>
              <Badge color={e.type === 'payment' ? 'green' : e.type === 'ticket' ? 'yellow' : e.type === 'activity' ? 'indigo' : 'blue'}>{e.type}</Badge>
              <span className="flex-1 text-text-secondary truncate">{e.label} {e.ref ? `· ${e.ref}` : ''}</span>
              {e.amount != null && <span className="tabular-nums text-text-primary">{money(e.amount)}</span>}
            </div>
          ))}
        </div>
        {totalTl > PER && (
          <div className="flex items-center justify-center gap-3 pt-3 text-xs">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded bg-surface-2 border border-border disabled:opacity-40">←</button>
            <span className="text-text-tertiary">{num(page + 1)} / {num(Math.ceil(totalTl / PER))}</span>
            <button disabled={(page + 1) * PER >= totalTl} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded bg-surface-2 border border-border disabled:opacity-40">→</button>
          </div>
        )}
      </Card>
    </div>
  )
}
