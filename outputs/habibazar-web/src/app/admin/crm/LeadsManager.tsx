'use client'

import { useCallback, useEffect, useState } from 'react'
import { fmtMoney } from '@/lib/format'
import { Card, Btn, Input, Select, PageHeader, Modal, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

type Status = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost'
type Source = 'website' | 'referral' | 'consultation' | 'contact_form' | 'event' | 'social' | 'email' | 'other'
interface Lead {
  id?: number; name: string; email: string | null; phone: string | null; company: string | null
  source: Source; status: Status; score: number; value: number; notes: string | null
  ownerId?: string | null; ownerName?: string | null; convertedCustomerId?: number | null; lastActivityAt?: string | null
}
interface Activity { id: number; kind: string; body: string; dueAt: string | null; done: number; assignedName: string | null; createdByName: string | null; createdAt: string }
const L = (fa: boolean, en: string, faT: string) => (fa ? faT : en)
const KANBAN_STAGES: Status[] = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost']
const ACT_KINDS: [string, string, string][] = [['call', 'Call', 'تماس'], ['meeting', 'Meeting', 'جلسه'], ['email', 'Email', 'ایمیل'], ['note', 'Note', 'یادداشت'], ['task', 'Task', 'وظیفه']]
const ACT_ICON: Record<string, string> = { call: '📞', meeting: '🗓️', email: '✉️', note: '📝', task: '☑️' }
interface Stats {
  total: number; byStatus: Record<Status, number>; openValue: number; wonValue: number; winRate: number; avgScore: number
}

const STATUSES: Status[] = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost']
const SOURCES: Source[] = ['website', 'referral', 'consultation', 'contact_form', 'event', 'social', 'email', 'other']
const EMPTY: Lead = { name: '', email: '', phone: '', company: '', source: 'other', status: 'new', score: 0, value: 0, notes: '' }

const money = (n: number | null | undefined) => fmtMoney(n, { max: 3, dashZero: true })

export function LeadsManager() {
  const t = useT()
  const locale = useAdminLocale()
  const stLabel = useCallback((s: Status) => t(`lead_st_${s}`), [t])
  const { toast, ToastContainer } = useToast()
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Lead>(EMPTY)
  const [saving, setSaving] = useState(false)
  const fa = locale === 'fa'
  const [view, setView] = useState<'table' | 'kanban'>('table')
  const [mine, setMine] = useState(false)
  const [sla, setSla] = useState<{ days: number; breached: number } | null>(null)
  const [detail, setDetail] = useState<Lead | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [newAct, setNewAct] = useState({ kind: 'note', body: '' })
  const [dragId, setDragId] = useState<number | null>(null)

  // بند ۵.۴: view mode persisted per user in the existing table_prefs store.
  useEffect(() => {
    fetch('/api/admin/table-prefs?tableId=crm-leads').then(r => r.json())
      .then(d => { if (d.prefs?.viewMode) setView(d.prefs.viewMode) }).catch(() => {})
  }, [])
  const switchView = (v: 'table' | 'kanban') => {
    setView(v)
    fetch('/api/admin/table-prefs?tableId=crm-leads').then(r => r.json()).then(d => {
      fetch('/api/admin/table-prefs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tableId: 'crm-leads', prefs: { ...(d.prefs ?? {}), viewMode: v } }) })
    }).catch(() => {})
  }

  const openDetail = useCallback(async (lead: Lead) => {
    setDetail(lead)
    const r = await fetch(`/api/admin/crm/activities?leadId=${lead.id}`)
    if (r.ok) setActivities((await r.json()).activities ?? [])
  }, [])

  async function addActivity() {
    if (!detail?.id || !newAct.body.trim()) return
    const r = await fetch('/api/admin/crm/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: detail.id, kind: newAct.kind, body: newAct.body }) })
    if (r.ok) { setNewAct({ kind: 'note', body: '' }); openDetail(detail); load() }
    else toast(L(fa, 'Failed to log activity.', 'ثبت فعالیت ناموفق بود.'), 'error')
  }

  async function convert(lead: Lead) {
    if (!confirm(L(fa, `Convert "${lead.name}" to a customer?`, `تبدیل «${lead.name}» به مشتری؟`))) return
    const r = await fetch('/api/admin/crm/leads/convert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: lead.id }) })
    const d = await r.json()
    if (r.ok) { toast(d.linkedExisting ? L(fa, `Linked to existing customer #${d.customerId}.`, `به مشتری موجود #${d.customerId} لینک شد.`) : L(fa, `Customer #${d.customerId} created.`, `مشتری #${d.customerId} ساخته شد.`), 'success'); load() }
    else toast(d.error ?? L(fa, 'Conversion failed.', 'تبدیل ناموفق بود.'), 'error')
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/crm/leads${mine ? '?mine=1' : ''}`)
      if (r.ok) { const d = await r.json(); setLeads(d.leads ?? []); setStats(d.stats ?? null); setSla(d.sla ?? null) }
    } catch { toast(t('lead_loadFail'), 'error') } finally { setLoading(false) }
  }, [toast, t, mine])
  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    try {
      const r = await fetch('/api/admin/crm/leads', {
        method: editing.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      if (!r.ok) throw new Error()
      toast(t('lead_savedOk'), 'success'); setModal(false); load()
    } catch { toast(t('lead_saveFail'), 'error') } finally { setSaving(false) }
  }
  async function del(id: number) {
    if (!confirm(t('lead_confirmDel'))) return
    try {
      const r = await fetch('/api/admin/crm/leads', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      if (!r.ok) throw new Error()
      toast(t('lead_deletedOk'), 'success'); load()
    } catch { toast(t('lead_delFail'), 'error') }
  }
  async function move(lead: Lead, status: Status) {
    try {
      const r = await fetch('/api/admin/crm/leads', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: lead.id, status }) })
      if (r.ok) load()
    } catch { /* ignore */ }
  }
  function set<K extends keyof Lead>(k: K, v: Lead[K]) { setEditing((e) => ({ ...e, [k]: v })) }

  const columns: Column<Lead>[] = [
    { key: 'name', labelEn: 'Lead', labelFa: t('lead_colLead'), render: l => <div><div className="font-medium text-text-primary">{l.name}</div><div className="text-xs text-text-tertiary">{l.email || l.phone || '—'}</div></div> },
    { key: 'company', labelEn: 'Company', labelFa: t('lead_colCompany'), render: l => <span className="text-text-secondary text-xs">{l.company || '—'}</span> },
    { key: 'source', labelEn: 'Source', labelFa: t('lead_colSource'), type: 'enum', options: SOURCES.map(s => ({ value: s, labelEn: s.replace('_', ' '), labelFa: s.replace('_', ' ') })), render: l => <span className="text-text-tertiary text-xs capitalize">{l.source.replace('_', ' ')}</span> },
    { key: 'score', labelEn: 'Score', labelFa: t('lead_colScore'), type: 'number', numeric: true, render: l => <div className="flex items-center gap-1.5 justify-end"><div className="h-1.5 w-12 rounded-full bg-sunken overflow-hidden"><div className="h-full rounded-full bg-brand" style={{ width: `${l.score}%` }} /></div><span className="text-xs text-text-secondary tabular-nums">{l.score}</span></div> },
    { key: 'value', labelEn: 'Value', labelFa: t('lead_colValue'), type: 'number', numeric: true, render: l => <span className="text-text-secondary text-xs">{money(l.value)}</span> },
    { key: 'status', labelEn: 'Stage', labelFa: t('lead_colStage'), type: 'enum', options: STATUSES.map(s => ({ value: s, labelEn: stLabel(s), labelFa: stLabel(s) })), render: l => <select value={l.status} onChange={(e) => move(l, e.target.value as Status)} className="form-input !py-1 !px-2 text-xs w-auto">{STATUSES.map((s) => <option key={s} value={s}>{stLabel(s)}</option>)}</select> },
  ]
  const rowActions: RowAction<Lead>[] = [
    { id: 'timeline', labelEn: 'Activities', labelFa: 'فعالیت‌ها', icon: '🕒', onClick: l => openDetail(l) },
    { id: 'convert', labelEn: 'Convert to customer', labelFa: 'تبدیل به مشتری', icon: '👤', hidden: l => !!l.convertedCustomerId || !['qualified', 'proposal', 'won'].includes(l.status), onClick: l => convert(l) },
    { id: 'edit', labelEn: 'Edit', labelFa: t('lead_edit'), icon: '✎', onClick: l => { setEditing(l); setModal(true) } },
    { id: 'del', labelEn: 'Delete', labelFa: t('lead_del'), icon: '🗑', danger: true, onClick: l => del(l.id!) },
  ]

  return (
    <>
      <ToastContainer />
      <PageHeader title={t('lead_title')} action={<Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>{t('lead_newLead')}</Btn>} />

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex gap-1 rounded-lg bg-surface-2 border border-subtle p-1">
          {([['table', 'Table', 'جدول'], ['kanban', 'Kanban', 'کانبان']] as const).map(([id, en, faL]) => (
            <button key={id} onClick={() => switchView(id)} className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${view === id ? 'bg-brand text-white' : 'text-text-secondary hover:text-text-primary'}`}>{L(fa, en, faL)}</button>
          ))}
        </div>
        <button onClick={() => setMine(m => !m)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${mine ? 'bg-brand text-white border-brand' : 'border-border text-text-secondary hover:text-text-primary'}`}>
          {L(fa, 'My leads', 'لیدهای من')}
        </button>
        {sla && sla.breached > 0 && (
          <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-warning/10 text-warning border border-warning/30">
            {L(fa, `${sla.breached} lead(s) idle > ${sla.days} days`, `${sla.breached} سرنخ بیش از ${sla.days} روز بدون فعالیت`)}
          </span>
        )}
      </div>

      {/* Sales KPIs */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="rounded-xl p-4 bg-surface-2 border border-subtle"><p className="text-xs text-text-tertiary mb-1">{t('lead_totalLeads')}</p><p className="text-2xl font-bold text-text-primary">{stats.total}</p></div>
          <div className="rounded-xl p-4 bg-surface-2 border border-subtle"><p className="text-xs text-text-tertiary mb-1">{t('lead_openPipeline')}</p><p className="text-2xl font-bold text-text-primary">{money(stats.openValue)}</p></div>
          <div className="rounded-xl p-4 bg-surface-2 border border-success/40"><p className="text-xs text-text-tertiary mb-1">{t('lead_wonValue')}</p><p className="text-2xl font-bold text-success">{money(stats.wonValue)}</p></div>
          <div className="rounded-xl p-4 bg-surface-2 border border-subtle"><p className="text-xs text-text-tertiary mb-1">{t('lead_winRate')}</p><p className="text-2xl font-bold text-text-primary">{stats.winRate}%</p></div>
          <div className="rounded-xl p-4 bg-surface-2 border border-subtle"><p className="text-xs text-text-tertiary mb-1">{t('lead_avgScore')}</p><p className="text-2xl font-bold text-text-primary">{stats.avgScore}</p></div>
        </div>
      )}

      {view === 'kanban' && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
          {KANBAN_STAGES.map(stage => (
            <div key={stage}
              onDragOver={e => e.preventDefault()}
              onDrop={() => { const l = leads.find(x => x.id === dragId); if (l && l.status !== stage) move(l, stage); setDragId(null) }}
              className="rounded-xl bg-surface-2 border border-subtle p-2 min-h-[220px]">
              <div className="flex items-center justify-between px-1 mb-2">
                <p className="text-xs font-semibold text-text-secondary">{stLabel(stage)}</p>
                <span className="text-2xs text-text-tertiary tabular-nums">{leads.filter(l => l.status === stage).length}</span>
              </div>
              <div className="space-y-2">
                {leads.filter(l => l.status === stage).map(l => (
                  <div key={l.id} draggable onDragStart={() => setDragId(l.id!)} onClick={() => openDetail(l)}
                    className="rounded-lg bg-surface border border-border p-2.5 cursor-grab active:cursor-grabbing hover:border-brand/50 transition-colors">
                    <p className="text-xs font-semibold text-text-primary truncate">{l.name}</p>
                    {l.company && <p className="text-2xs text-text-tertiary truncate">{l.company}</p>}
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-2xs text-text-secondary">{money(l.value)}</span>
                      <span className="text-2xs text-text-tertiary truncate max-w-[70px]">{l.ownerName ?? ''}</span>
                    </div>
                    {l.lastActivityAt && <p className="text-3xs text-text-tertiary mt-1">🕒 {String(l.lastActivityAt).slice(0, 10)}</p>}
                    {l.convertedCustomerId && <p className="text-3xs text-success mt-0.5">{L(fa, 'Customer', 'مشتری')} #{l.convertedCustomerId}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'table' && <Card className="p-4">
        <DataTable
          tableId="crm-leads"
          columns={columns}
          rows={leads}
          locale={locale}
          loading={loading}
          rowKey={l => String(l.id)}
          rowActions={rowActions}
          exportName="crm-leads"
          emptyLabel={t('lead_empty')}
          quickCreate={{ labelEn: 'New Lead', labelFa: t('lead_newLead'), onClick: () => { setEditing(EMPTY); setModal(true) } }}
        />
      </Card>}

      {/* بند ۵.۱ — activity timeline drawer */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.name} — ${L(fa, 'Activities', 'فعالیت‌ها')}` : ''} size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-text-secondary flex-wrap">
              <span>{detail.company ?? ''}</span><span>{detail.email ?? ''}</span><span>{detail.phone ?? ''}</span>
              {detail.convertedCustomerId
                ? <span className="text-success">{L(fa, 'Converted → customer', 'تبدیل‌شده → مشتری')} #{detail.convertedCustomerId}</span>
                : ['qualified', 'proposal', 'won'].includes(detail.status) && <Btn variant="secondary" onClick={() => convert(detail)}>{L(fa, 'Convert to customer', 'تبدیل به مشتری')}</Btn>}
            </div>
            <div className="flex gap-2 items-start">
              <select value={newAct.kind} onChange={e => setNewAct(a => ({ ...a, kind: e.target.value }))} className="form-input !py-1.5 !px-2 text-xs w-auto">
                {ACT_KINDS.map(([id, en, faL]) => <option key={id} value={id}>{L(fa, en, faL)}</option>)}
              </select>
              <input value={newAct.body} onChange={e => setNewAct(a => ({ ...a, body: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addActivity() }}
                placeholder={L(fa, 'Log a call, meeting, note…', 'ثبت تماس، جلسه، یادداشت…')}
                className="flex-1 rounded-lg bg-surface border border-border px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand" />
              <Btn onClick={addActivity}>{L(fa, 'Log', 'ثبت')}</Btn>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {activities.length === 0 && <p className="text-xs text-text-tertiary">{L(fa, 'No activity yet.', 'هنوز فعالیتی ثبت نشده.')}</p>}
              {activities.map(a => (
                <div key={a.id} className="flex items-start gap-2 rounded-lg bg-surface-2 border border-subtle p-2.5">
                  <span className="text-sm">{ACT_ICON[a.kind] ?? '📝'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-primary leading-snug">{a.body}</p>
                    <p className="text-2xs text-text-tertiary mt-0.5">{a.createdByName ?? ''} · {String(a.createdAt).slice(0, 16)}{a.dueAt ? ` · ${L(fa, 'due', 'سررسید')} ${String(a.dueAt).slice(0, 10)}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? t('lead_editLead') : t('lead_newLead')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('lead_nameL')} value={editing.name} onChange={(v) => set('name', v)} />
            <Input label={t('lead_companyL')} value={editing.company || ''} onChange={(v) => set('company', v)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('lead_emailL')} value={editing.email || ''} onChange={(v) => set('email', v)} />
            <Input label={t('lead_phoneL')} value={editing.phone || ''} onChange={(v) => set('phone', v)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select label={t('lead_sourceL')} value={editing.source} onChange={(v) => set('source', v as Source)} options={SOURCES.map((s) => ({ value: s, label: s.replace('_', ' ') }))} />
            <Select label={t('lead_stageL')} value={editing.status} onChange={(v) => set('status', v as Status)} options={STATUSES.map((s) => ({ value: s, label: stLabel(s) }))} />
            <Input label={t('lead_valueL')} type="number" value={String(editing.value)} onChange={(v) => set('value', Number(v) || 0)} />
          </div>
          <Input label={t('lead_notesL')} value={editing.notes || ''} onChange={(v) => set('notes', v)} multiline rows={4} />
          <p className="text-xs text-text-tertiary">{t('lead_scoreHint')}</p>
          <div className="flex gap-3">
            <Btn onClick={save} disabled={saving}>{saving ? t('lead_saving') : t('lead_save')}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>{t('lead_cancel')}</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
