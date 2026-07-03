'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Btn, Input, Select, PageHeader, Modal, useToast } from '@/components/admin/ui'

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
    } catch { toast('Failed to load leads', 'error') } finally { setLoading(false) }
  }, [toast])
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
      toast('Lead saved', 'success'); setModal(false); load()
    } catch { toast('Save failed (check required fields)', 'error') } finally { setSaving(false) }
  }
  async function del(id: number) {
    if (!confirm('Delete this lead?')) return
    try {
      const r = await fetch('/api/admin/crm/leads', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      if (!r.ok) throw new Error()
      toast('Lead deleted', 'success'); load()
    } catch { toast('Delete failed', 'error') }
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
      <PageHeader title="CRM — Leads" action={<Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>New Lead</Btn>} />

      {/* Sales KPIs */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="rounded-xl p-4 bg-surface-2 border border-subtle"><p className="text-xs text-text-tertiary mb-1">Total leads</p><p className="text-2xl font-bold text-text-primary">{stats.total}</p></div>
          <div className="rounded-xl p-4 bg-surface-2 border border-subtle"><p className="text-xs text-text-tertiary mb-1">Open pipeline</p><p className="text-2xl font-bold text-text-primary">{money(stats.openValue)}</p></div>
          <div className="rounded-xl p-4 bg-surface-2 border border-success/40"><p className="text-xs text-text-tertiary mb-1">Won value</p><p className="text-2xl font-bold text-success">{money(stats.wonValue)}</p></div>
          <div className="rounded-xl p-4 bg-surface-2 border border-subtle"><p className="text-xs text-text-tertiary mb-1">Win rate</p><p className="text-2xl font-bold text-text-primary">{stats.winRate}%</p></div>
          <div className="rounded-xl p-4 bg-surface-2 border border-subtle"><p className="text-xs text-text-tertiary mb-1">Avg score</p><p className="text-2xl font-bold text-text-primary">{stats.avgScore}</p></div>
        </div>
      )}

      {/* Pipeline filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === 'all' ? 'bg-brand text-white' : 'bg-surface-2 text-text-secondary border border-border'}`}>All ({leads.length})</button>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${filter === s ? 'bg-brand text-white' : 'bg-surface-2 text-text-secondary border border-border'}`}>
            {s} ({stats?.byStatus[s] ?? 0})
          </button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <p className="text-sm text-text-tertiary p-5">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-text-tertiary p-5">No leads. Click “New Lead” to add one.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-text-tertiary text-left border-b border-subtle">
                {['Lead', 'Company', 'Source', 'Score', 'Value', 'Stage', 'Actions'].map((h) => <th key={h} className="px-4 py-2 text-xs font-medium">{h}</th>)}
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
                        className="bg-background border border-border rounded-md px-2 py-1 text-xs text-white capitalize">
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-2">
                        <Btn size="sm" variant="secondary" onClick={() => { setEditing(l); setModal(true) }}>Edit</Btn>
                        <Btn size="sm" variant="danger" onClick={() => del(l.id!)}>Del</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? 'Edit Lead' : 'New Lead'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Name *" value={editing.name} onChange={(v) => set('name', v)} />
            <Input label="Company" value={editing.company || ''} onChange={(v) => set('company', v)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" value={editing.email || ''} onChange={(v) => set('email', v)} />
            <Input label="Phone" value={editing.phone || ''} onChange={(v) => set('phone', v)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select label="Source" value={editing.source} onChange={(v) => set('source', v as Source)} options={SOURCES.map((s) => ({ value: s, label: s.replace('_', ' ') }))} />
            <Select label="Stage" value={editing.status} onChange={(v) => set('status', v as Status)} options={STATUSES.map((s) => ({ value: s, label: s }))} />
            <Input label="Value ($)" type="number" value={String(editing.value)} onChange={(v) => set('value', Number(v) || 0)} />
          </div>
          <Input label="Notes" value={editing.notes || ''} onChange={(v) => set('notes', v)} multiline rows={4} />
          <p className="text-xs text-text-tertiary">Score is computed automatically from completeness, source, stage and value.</p>
          <div className="flex gap-3">
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Lead'}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>Cancel</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
