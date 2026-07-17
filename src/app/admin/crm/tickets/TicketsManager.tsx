'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, StatCard, Badge, PageHeader, Select } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'
import { faDigits } from '@/lib/admin/chartRtl'

const L = (fa: boolean, en: string, f: string) => (fa ? f : en)
type Sla = { activeHours: number; state: 'within' | 'due_soon' | 'breached'; targetHours: number; firstResponseBreached: boolean }
interface Row { id: number; ticketNo: string | null; customerName?: string; subject: string; category: string; priority: string; status: string; ownerId: string | null; updatedAt: string; sla: Sla }
interface Msg { id: number; authorKind: string; body: string; attachmentUrl: string | null; internal: boolean; createdAt: string }
interface Detail extends Row { messages: Msg[] }

const STATUSES = ['new', 'open', 'pending', 'resolved', 'closed'] as const
const PRIOS = ['low', 'normal', 'high', 'urgent'] as const
const slaColor = (s: Sla['state']) => (s === 'breached' ? 'red' : s === 'due_soon' ? 'amber' : 'green')
const prioColor = (p: string) => (p === 'urgent' ? 'red' : p === 'high' ? 'amber' : p === 'low' ? 'slate' : 'blue')

export function TicketsManager() {
  const locale = useAdminLocale()
  const fa = locale === 'fa'
  const num = (v: unknown) => (fa ? faDigits(String(v ?? '')) : String(v ?? ''))
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('open')
  const [prio, setPrio] = useState('')
  const [sel, setSel] = useState<Detail | null>(null)
  const [reply, setReply] = useState('')
  const [internal, setInternal] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams(); if (status) p.set('status', status); if (prio) p.set('priority', prio)
    const r = await fetch(`/api/admin/crm/tickets?${p}`)
    const d = await r.json().catch(() => ({ tickets: [] }))
    setRows(d.tickets ?? []); setLoading(false)
  }, [status, prio])
  useEffect(() => { load() }, [load])

  const openDetail = async (id: number) => {
    const r = await fetch(`/api/admin/crm/tickets?id=${id}`)
    if (r.ok) setSel(await r.json())
  }
  const act = async (payload: Record<string, unknown>) => {
    setBusy(true)
    const r = await fetch('/api/admin/crm/tickets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    setBusy(false)
    if (r.ok && sel) await openDetail(sel.id)
    await load()
  }
  const send = async () => {
    if (!sel || reply.trim().length < 1) return
    await act({ action: 'reply', id: sel.id, body: reply, internal })
    setReply('')
  }

  const breached = useMemo(() => rows.filter(r => r.sla.state === 'breached').length, [rows])
  const dueSoon = useMemo(() => rows.filter(r => r.sla.state === 'due_soon').length, [rows])

  return (
    <div className="space-y-5" dir={fa ? 'rtl' : 'ltr'}>
      <PageHeader title={L(fa, 'Support Tickets', 'تیکت‌های پشتیبانی')} subtitle={L(fa, 'Customer support queue with SLA', 'صف پشتیبانی مشتری با SLA')}
        action={<button onClick={() => act({ action: 'scan' })} className="text-sm px-3 py-1.5 rounded-lg bg-surface-2 border border-border hover:border-brand/50">{L(fa, 'Run SLA scan', 'اجرای اسکن SLA')}</button>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={L(fa, 'Open', 'باز')} value={num(rows.length)} />
        <StatCard label={L(fa, 'SLA breached', 'نقض SLA')} value={num(breached)} />
        <StatCard label={L(fa, 'Due soon', 'نزدیک به موعد')} value={num(dueSoon)} />
        <StatCard label={L(fa, 'Awaiting first reply', 'در انتظار پاسخ اول')} value={num(rows.filter(r => r.sla.firstResponseBreached).length)} />
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <Select label={L(fa, 'Status', 'وضعیت')} value={status} onChange={setStatus}
          options={[{ value: 'open', label: L(fa, 'Open (all active)', 'باز (فعال)') }, ...STATUSES.map(s => ({ value: s, label: s }))]} />
        <Select label={L(fa, 'Priority', 'اولویت')} value={prio} onChange={setPrio}
          options={[{ value: '', label: L(fa, 'All', 'همه') }, ...PRIOS.map(p => ({ value: p, label: p }))]} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-3">
          {loading ? <p className="text-sm text-text-tertiary p-3">…</p> : rows.length === 0 ? <p className="text-sm text-text-tertiary p-3">{L(fa, 'No tickets', 'تیکتی نیست')}</p> : (
            <div className="divide-y divide-subtle">
              {rows.map(r => (
                <button key={r.id} onClick={() => openDetail(r.id)} className={`w-full text-start py-2.5 px-2 hover:bg-surface-2 rounded-lg ${sel?.id === r.id ? 'bg-surface-2' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-text-primary truncate">{r.subject}</span>
                    <Badge color={slaColor(r.sla.state)}>{r.sla.state === 'breached' ? L(fa, 'breached', 'نقض') : r.sla.state === 'due_soon' ? L(fa, 'due', 'موعد') : 'SLA'}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-2xs text-text-tertiary">
                    <span className="font-mono">{r.ticketNo}</span>
                    <Badge color={prioColor(r.priority)}>{r.priority}</Badge>
                    <span>{r.customerName}</span>
                    <span className="ms-auto">{num(r.sla.activeHours)}h / {num(r.sla.targetHours)}h</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {sel && (
          <Card className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-text-primary">{sel.subject}</div>
                <div className="text-2xs text-text-tertiary font-mono">{sel.ticketNo} · {sel.customerName}</div>
              </div>
              <button onClick={() => setSel(null)} className="text-text-tertiary text-sm">✕</button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select label={L(fa, 'Status', 'وضعیت')} value={sel.status} onChange={v => act({ action: 'status', id: sel.id, status: v })} options={STATUSES.map(s => ({ value: s, label: s }))} />
              <Select label={L(fa, 'Priority', 'اولویت')} value={sel.priority} onChange={v => act({ action: 'priority', id: sel.id, priority: v })} options={PRIOS.map(p => ({ value: p, label: p }))} />
              <div className="self-end">
                <Badge color={slaColor(sel.sla.state)}>{num(sel.sla.activeHours)}h / {num(sel.sla.targetHours)}h</Badge>
              </div>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pe-1">
              {sel.messages.map(m => (
                <div key={m.id} className={`rounded-lg p-2.5 text-sm ${m.internal ? 'bg-amber-500/10 border border-amber-500/30' : m.authorKind === 'customer' ? 'bg-surface-2' : 'bg-brand/5 border border-brand/20'}`}>
                  <div className="flex items-center gap-2 text-2xs text-text-tertiary mb-1">
                    <span className="font-medium">{m.authorKind === 'customer' ? L(fa, 'Customer', 'مشتری') : m.authorKind === 'system' ? L(fa, 'System', 'سیستم') : L(fa, 'Agent', 'کارشناس')}</span>
                    {m.internal && <Badge color="amber">{L(fa, 'internal note', 'یادداشت داخلی')}</Badge>}
                    <span className="ms-auto">{String(m.createdAt).slice(0, 16)}</span>
                  </div>
                  <p className="text-text-primary whitespace-pre-wrap">{m.body}</p>
                  {m.attachmentUrl && <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className="text-2xs text-brand hover:underline">{L(fa, 'attachment', 'پیوست')}</a>}
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-subtle">
              <textarea value={reply} onChange={e => setReply(e.target.value)} rows={3} placeholder={L(fa, 'Write a reply…', 'پاسخ بنویسید…')}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand outline-none" />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                  <input type="checkbox" checked={internal} onChange={e => setInternal(e.target.checked)} />
                  {L(fa, 'Internal note (not visible to customer)', 'یادداشت داخلی (نامرئی برای مشتری)')}
                </label>
                <button disabled={busy || reply.trim().length < 1} onClick={send} className="px-4 py-1.5 rounded-lg bg-brand text-white text-sm font-semibold disabled:opacity-50">
                  {internal ? L(fa, 'Add note', 'افزودن یادداشت') : L(fa, 'Send reply', 'ارسال پاسخ')}
                </button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
