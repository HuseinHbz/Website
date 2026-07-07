'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, Input, Select, PageHeader, Modal, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

type Status = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost'
type Source = 'website' | 'referral' | 'consultation' | 'contact_form' | 'event' | 'social' | 'email' | 'other'
interface Lead {
  id?: number; name: string; email: string | null; phone: string | null; company: string | null
  source: Source; status: Status; score: number; value: number; notes: string | null
}
interface Stats {
  total: number; byStatus: Record<Status, number>; openValue: number; wonValue: number; winRate: number; avgScore: number
}

const STATUSES: Status[] = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost']
const SOURCES: Source[] = ['website', 'referral', 'consultation', 'contact_form', 'event', 'social', 'email', 'other']
const EMPTY: Lead = { name: '', email: '', phone: '', company: '', source: 'other', status: 'new', score: 0, value: 0, notes: '' }

function money(n: number): string { return n ? `$${n.toLocaleString()}` : '—' }

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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/crm/leads')
      if (r.ok) { const d = await r.json(); setLeads(d.leads ?? []); setStats(d.stats ?? null) }
    } catch { toast(t('lead_loadFail'), 'error') } finally { setLoading(false) }
  }, [toast, t])
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
    { id: 'edit', labelEn: 'Edit', labelFa: t('lead_edit'), icon: '✎', onClick: l => { setEditing(l); setModal(true) } },
    { id: 'del', labelEn: 'Delete', labelFa: t('lead_del'), icon: '🗑', danger: true, onClick: l => del(l.id!) },
  ]

  return (
    <>
      <ToastContainer />
      <PageHeader title={t('lead_title')} action={<Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>{t('lead_newLead')}</Btn>} />

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

      <Card className="p-4">
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
      </Card>

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
