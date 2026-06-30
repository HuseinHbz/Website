'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, Badge, Input, Select, useToast } from '@/components/admin/ui'

type Doc = { id: number; slug: string; titleEn: string; type: string; version: string | null; status: string; featured: boolean; views: number; helpful: number; sortOrder: number }

const TYPES = ['docs', 'api', 'runbook', 'tutorial', 'guide', 'release']
const STATUSES = ['draft', 'published', 'archived']

export function DocsManager() {
  const [docList, setDocList] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Doc & { contentEn: string; excerptEn: string }> | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('all')
  const { toast, ToastContainer } = useToast()

  async function load() { setLoading(true); const r = await fetch('/api/admin/docs'); setDocList(await r.json()); setLoading(false) }
  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return; setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/docs', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    if (res.ok) { toast('Saved', 'success'); setEditing(null); load() } else toast('Failed', 'error')
    setSaving(false)
  }

  const filtered = filter === 'all' ? docList : docList.filter(d => d.type === filter)

  const TYPE_ICONS: Record<string, string> = { docs: '📄', api: '⚡', runbook: '📋', tutorial: '📖', guide: '🏛️', release: '📦' }

  return (
    <div>
      <ToastContainer />
      <PageHeader title="Documentation Center" subtitle={`${docList.length} documents · ${docList.filter(d => d.status === 'published').length} published`}
        action={<Btn onClick={() => setEditing({ type: 'docs', status: 'draft', version: 'latest', sortOrder: docList.length + 1 })}>+ New Doc</Btn>} />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0e0e1a] border border-slate-800 rounded-2xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4">{editing.id ? 'Edit Document' : 'New Document'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Input label="Slug" value={editing.slug || ''} onChange={v => setEditing(e => ({ ...e, slug: v }))} /></div>
              <div className="col-span-2"><Input label="Title (EN)" value={editing.titleEn || ''} onChange={v => setEditing(e => ({ ...e, titleEn: v }))} /></div>
              <Select label="Type" value={editing.type || 'docs'} onChange={v => setEditing(e => ({ ...e, type: v }))} options={TYPES.map(t => ({ value: t, label: t }))} />
              <Select label="Status" value={editing.status || 'draft'} onChange={v => setEditing(e => ({ ...e, status: v }))} options={STATUSES.map(s => ({ value: s, label: s }))} />
              <Input label="Version" value={editing.version || ''} onChange={v => setEditing(e => ({ ...e, version: v }))} />
              <Input label="Sort Order" type="number" value={String(editing.sortOrder || 0)} onChange={v => setEditing(e => ({ ...e, sortOrder: parseInt(v) || 0 }))} />
              <div className="col-span-2">
                <label className="text-xs text-slate-400 mb-1 block">Excerpt</label>
                <textarea value={editing.excerptEn || ''} onChange={e2 => setEditing(e => ({ ...e, excerptEn: e2.target.value }))} rows={2}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400 mb-1 block">Content (Markdown)</label>
                <textarea value={editing.contentEn || ''} onChange={e2 => setEditing(e => ({ ...e, contentEn: e2.target.value }))} rows={10}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none font-mono" />
              </div>
            </div>
            <div className="flex gap-3 mt-6"><Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn><Btn variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn></div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {['all', ...TYPES].map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === t ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}>
            {TYPE_ICONS[t] || '📚'} {t}
          </button>
        ))}
      </div>

      <Card>
        {loading ? <div className="text-center py-8 text-slate-500">Loading…</div> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-800 text-left">{['Document', 'Type', 'Version', 'Status', 'Views', 'Actions'].map(h => <th key={h} className="px-4 py-3 text-slate-500 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3"><div className="font-medium text-white">{d.titleEn}</div><div className="text-xs text-slate-500">{d.slug}</div></td>
                  <td className="px-4 py-3 text-slate-400">{TYPE_ICONS[d.type]} {d.type}</td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{d.version || '—'}</td>
                  <td className="px-4 py-3"><Badge color={d.status === 'published' ? 'green' : d.status === 'draft' ? 'yellow' : 'slate'}>{d.status}</Badge></td>
                  <td className="px-4 py-3 text-slate-400">{d.views}</td>
                  <td className="px-4 py-3"><Btn size="sm" variant="ghost" onClick={() => setEditing(d)}>Edit</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
