'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, Badge, Input, Select, useToast } from '@/components/admin/ui'

type Event = { id: number; slug: string; titleEn: string; type: string; status: string; format: string; startDate: string; registrationsCount: number; isFree: boolean; featured: boolean }

const TYPES = ['webinar', 'conference', 'meetup', 'workshop', 'training', 'announcement']
const STATUSES = ['upcoming', 'live', 'completed', 'cancelled']
const FORMATS = ['online', 'in_person', 'hybrid']
const STATUS_COLORS: Record<string, string> = { upcoming: 'blue', live: 'green', completed: 'slate', cancelled: 'red' }

export function EventsManager() {
  const [eventList, setEventList] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Event & { descriptionEn: string; meetingUrl: string }> | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() { setLoading(true); const r = await fetch('/api/admin/events'); setEventList(await r.json()); setLoading(false) }
  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return; setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/events', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    if (res.ok) { toast('Saved', 'success'); setEditing(null); load() } else toast('Failed', 'error')
    setSaving(false)
  }

  return (
    <div>
      <ToastContainer />
      <PageHeader title="Events & Community" subtitle={`${eventList.length} events · ${eventList.filter(e => e.status === 'upcoming').length} upcoming`}
        action={<Btn onClick={() => setEditing({ type: 'webinar', status: 'upcoming', format: 'online', isFree: true, startDate: new Date().toISOString().slice(0, 10), registrationsCount: 0 })}>+ New Event</Btn>} />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0e0e1a] border border-slate-800 rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4">{editing.id ? 'Edit Event' : 'New Event'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Input label="Slug" value={editing.slug || ''} onChange={v => setEditing(e => ({ ...e, slug: v }))} /></div>
              <div className="col-span-2"><Input label="Title (EN)" value={editing.titleEn || ''} onChange={v => setEditing(e => ({ ...e, titleEn: v }))} /></div>
              <Select label="Type" value={editing.type || 'webinar'} onChange={v => setEditing(e => ({ ...e, type: v }))} options={TYPES.map(t => ({ value: t, label: t }))} />
              <Select label="Status" value={editing.status || 'upcoming'} onChange={v => setEditing(e => ({ ...e, status: v }))} options={STATUSES.map(s => ({ value: s, label: s }))} />
              <Select label="Format" value={editing.format || 'online'} onChange={v => setEditing(e => ({ ...e, format: v }))} options={FORMATS.map(f => ({ value: f, label: f }))} />
              <Input label="Start Date" value={editing.startDate || ''} onChange={v => setEditing(e => ({ ...e, startDate: v }))} />
              <div className="col-span-2"><Input label="Meeting URL" value={editing.meetingUrl || ''} onChange={v => setEditing(e => ({ ...e, meetingUrl: v }))} /></div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400 mb-1 block">Description</label>
                <textarea value={editing.descriptionEn || ''} onChange={e2 => setEditing(e => ({ ...e, descriptionEn: e2.target.value }))} rows={3}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none" />
              </div>
              <div className="flex items-center gap-4 col-span-2 pt-1">
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer"><input type="checkbox" checked={!!editing.isFree} onChange={e2 => setEditing(e => ({ ...e, isFree: e2.target.checked }))} /> Free</label>
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer"><input type="checkbox" checked={!!editing.featured} onChange={e2 => setEditing(e => ({ ...e, featured: e2.target.checked }))} /> Featured</label>
              </div>
            </div>
            <div className="flex gap-3 mt-6"><Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn><Btn variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn></div>
          </div>
        </div>
      )}

      <Card>
        {loading ? <div className="text-center py-8 text-slate-500">Loading…</div> : eventList.length === 0 ? (
          <div className="text-center py-12"><div className="text-4xl mb-3">🗓️</div><div className="text-white font-medium mb-1">No events yet</div><div className="text-slate-500 text-sm">Create your first webinar or conference</div></div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-800 text-left">{['Event', 'Type', 'Date', 'Format', 'Status', 'Registrations', 'Actions'].map(h => <th key={h} className="px-4 py-3 text-slate-500 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {eventList.map(e => (
                <tr key={e.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3"><div className="font-medium text-white">{e.titleEn}</div><div className="text-xs text-slate-500">{e.slug}</div></td>
                  <td className="px-4 py-3 text-slate-400">{e.type}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{e.startDate}</td>
                  <td className="px-4 py-3 text-slate-400">{e.format}</td>
                  <td className="px-4 py-3"><Badge color={STATUS_COLORS[e.status] || 'slate'}>{e.status}</Badge></td>
                  <td className="px-4 py-3 text-slate-400">{e.registrationsCount}</td>
                  <td className="px-4 py-3"><Btn size="sm" variant="ghost" onClick={() => setEditing(e)}>Edit</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
