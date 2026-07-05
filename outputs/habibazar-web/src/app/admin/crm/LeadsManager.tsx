'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Btn, Input, Select, PageHeader, Modal, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

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
  const stLabel = useCallback((s: Status) => t(`lead_st_${s}`), [t])
  const { toast, ToastContainer } = useToast()
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Status | 'all'>('all')
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

  const filtered = useMemo(() => filter === 'all' ? leads : leads.filter((l) => l.status === filter), [leads, filter])

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

      {/* Pipeline filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === 'all' ? 'bg-brand text-white' : 'bg-surface-2 text-text-secondary border border-border'}`}>{t('lead_all')} ({leads.length})</button>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === s ? 'bg-brand text-white' : 'bg-surface-2 text-text-secondary border border-border'}`}>
            {stLabel(s)} ({stats?.byStatus[s] ?? 0})
          </button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <p className="text-sm text-text-tertiary p-5">{t('lead_loading')}</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-text-tertiary p-5">{t('lead_empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-text-tertiary text-left border-b border-subtle">
                {[t('lead_colLead'), t('lead_colCompany'), t('lead_colSource'), t('lead_colScore'), t('lead_colValue'), t('lead_colStage'), t('lead_colActions')].map((h) => <th key={h} className="px-4 py-2 text-xs font-medium">{h}</th>)}
              </tr></thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} className="border-b border-subtle/50">
                    <td className="px-4 py-2.5"><div className="font-medium text-text-primary">{l.name}</div><div className="text-xs text-text-tertiary">{l.email || l.phone || '—'}</div></td>
                    <td className="px-4 py-2.5 text-text-secondary text-xs">{l.company || '—'}</td>
                    <td className="px-4 py-2.5 text-text-tertiary text-xs capitalize">{l.source.replace('_', ' ')}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-12 rounded-full bg-sunken overflow-hidden"><div className="h-full rounded-full bg-brand" style={{ width: `${l.score}%` }} /></div>
                        <span className="text-xs text-text-secondary">{l.score}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary text-xs">{money(l.value)}</td>
                    <td className="px-4 py-2.5">
                      <select value={l.status} onChange={(e) => move(l, e.target.value as Status)}
                        className="form-input !py-1 !px-2 text-xs w-auto">
                        {STATUSES.map((s) => <option key={s} value={s}>{stLabel(s)}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-2">
                        <Btn size="sm" variant="secondary" onClick={() => { setEditing(l); setModal(true) }}>{t('lead_edit')}</Btn>
                        <Btn size="sm" variant="danger" onClick={() => del(l.id!)}>{t('lead_del')}</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
