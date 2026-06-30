'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, Badge, Input, Select, useToast } from '@/components/admin/ui'

type Credential = {
  id: number; type: string; nameEn: string; issuer: string | null;
  issueDate: string | null; expiryDate: string | null;
  credentialUrl: string | null; active: boolean; featured: boolean; sortOrder: number
}

const TYPES = ['certification', 'award', 'membership', 'badge', 'license', 'recognition']
const TYPE_ICONS: Record<string, string> = {
  certification: '🏅', award: '🏆', membership: '🎫',
  badge: '🔖', license: '📜', recognition: '⭐',
}
const TYPE_COLORS: Record<string, string> = {
  certification: 'blue', award: 'yellow', membership: 'green',
  badge: 'red', license: 'slate', recognition: 'yellow',
}

export function CredentialsManager() {
  const [items, setItems] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState<Partial<Credential & { nameFa: string; descriptionEn: string; credentialId: string; badgeUrl: string; color: string }> | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() {
    setLoading(true)
    const url = filter !== 'all' ? `/api/admin/credentials?type=${filter}` : '/api/admin/credentials'
    const r = await fetch(url)
    setItems(await r.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [filter])

  async function save() {
    if (!editing) return
    setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/credentials', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    if (res.ok) { toast('Saved', 'success'); setEditing(null); load() } else toast('Failed', 'error')
    setSaving(false)
  }

  async function del(id: number) {
    if (!confirm('Delete this credential?')) return
    await fetch('/api/admin/credentials', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast('Deleted', 'success'); load()
  }

  return (
    <div>
      <ToastContainer />
      <PageHeader
        title="Credentials"
        subtitle={`${items.length} credentials — certifications, awards, memberships`}
        action={<Btn onClick={() => setEditing({ type: 'certification', active: true, featured: false, sortOrder: items.length + 1 })}>+ Add Credential</Btn>}
      />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0e0e1a] border border-slate-800 rounded-2xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4">{editing.id ? 'Edit Credential' : 'New Credential'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Type" value={editing.type || 'certification'} onChange={v => setEditing(e => ({ ...e, type: v }))} options={TYPES.map(t => ({ value: t, label: `${TYPE_ICONS[t]} ${t}` }))} />
              <Input label="Color" value={editing.color || '#6366f1'} onChange={v => setEditing(e => ({ ...e, color: v }))} />
              <div className="col-span-2"><Input label="Name (EN)" value={editing.nameEn || ''} onChange={v => setEditing(e => ({ ...e, nameEn: v }))} /></div>
              <div className="col-span-2"><Input label="Name (FA)" value={editing.nameFa || ''} onChange={v => setEditing(e => ({ ...e, nameFa: v }))} /></div>
              <div className="col-span-2"><Input label="Issuer / Organization" value={editing.issuer || ''} onChange={v => setEditing(e => ({ ...e, issuer: v }))} /></div>
              <Input label="Issue Date" value={editing.issueDate || ''} onChange={v => setEditing(e => ({ ...e, issueDate: v }))} />
              <Input label="Expiry Date" value={editing.expiryDate || ''} onChange={v => setEditing(e => ({ ...e, expiryDate: v }))} />
              <Input label="Credential ID" value={editing.credentialId || ''} onChange={v => setEditing(e => ({ ...e, credentialId: v }))} />
              <Input label="Credential URL" value={editing.credentialUrl || ''} onChange={v => setEditing(e => ({ ...e, credentialUrl: v }))} />
              <div className="col-span-2"><Input label="Badge Image URL" value={editing.badgeUrl || ''} onChange={v => setEditing(e => ({ ...e, badgeUrl: v }))} /></div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400 mb-1 block">Description</label>
                <textarea value={editing.descriptionEn || ''} onChange={e2 => setEditing(e => ({ ...e, descriptionEn: e2.target.value }))} rows={2}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none" />
              </div>
              <div className="col-span-2 flex gap-4 pt-1">
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={!!editing.active} onChange={e2 => setEditing(e => ({ ...e, active: e2.target.checked }))} /> Active
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={!!editing.featured} onChange={e2 => setEditing(e => ({ ...e, featured: e2.target.checked }))} /> Featured
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn>
              <Btn variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {['all', ...TYPES].map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === t ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}>
            {TYPE_ICONS[t] || '🏅'} {t}
          </button>
        ))}
      </div>

      <Card>
        {loading ? <div className="text-center py-8 text-slate-500">Loading…</div> : items.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🏅</div>
            <div className="text-white font-medium mb-1">No credentials yet</div>
            <div className="text-slate-500 text-sm">Add certifications, awards, and memberships</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-800 text-left">
              {['Credential', 'Type', 'Issuer', 'Issue Date', 'Expiry', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-slate-500 font-medium">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium text-white">{item.nameEn}</td>
                  <td className="px-4 py-3"><Badge color={TYPE_COLORS[item.type] || 'slate'}>{TYPE_ICONS[item.type]} {item.type}</Badge></td>
                  <td className="px-4 py-3 text-slate-400">{item.issuer || '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{item.issueDate || '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{item.expiryDate || '∞'}</td>
                  <td className="px-4 py-3"><Badge color={item.active ? 'green' : 'slate'}>{item.active ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="px-4 py-3 flex gap-2">
                    <Btn size="sm" variant="ghost" onClick={() => setEditing(item)}>Edit</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => del(item.id)}>Del</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
