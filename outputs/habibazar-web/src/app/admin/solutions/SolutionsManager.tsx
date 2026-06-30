'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, Badge, Input, useToast } from '@/components/admin/ui'

type Solution = {
  id: number
  slug: string
  nameEn: string
  nameFa: string
  taglineEn: string | null
  icon: string
  color: string
  featured: boolean
  active: boolean
  sortOrder: number
}

export function SolutionsManager() {
  const [solutions, setSolutions] = useState<Solution[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Solution> | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/solutions')
    setSolutions(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return
    setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/solutions', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    if (res.ok) {
      toast(editing.id ? 'Solution updated' : 'Solution created', 'success')
      setEditing(null)
      load()
    } else {
      toast('Save failed', 'error')
    }
    setSaving(false)
  }

  async function toggle(s: Solution) {
    await fetch('/api/admin/solutions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, active: !s.active }) })
    load()
  }

  return (
    <div>
      <ToastContainer />
      <PageHeader
        title="Technology Solutions"
        subtitle={`${solutions.length} solutions`}
        action={<Btn onClick={() => setEditing({ icon: '🔧', color: '#6366f1', active: true, featured: false, sortOrder: solutions.length + 1 })}>+ Add Solution</Btn>}
      />

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0e0e1a] border border-slate-800 rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4">{editing.id ? 'Edit Solution' : 'New Solution'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Input label="Slug" value={editing.slug || ''} onChange={v => setEditing(e => ({ ...e, slug: v }))} /></div>
              <Input label="Name (EN)" value={editing.nameEn || ''} onChange={v => setEditing(e => ({ ...e, nameEn: v }))} />
              <Input label="Name (FA)" value={editing.nameFa || ''} onChange={v => setEditing(e => ({ ...e, nameFa: v }))} />
              <div className="col-span-2"><Input label="Tagline (EN)" value={editing.taglineEn || ''} onChange={v => setEditing(e => ({ ...e, taglineEn: v }))} /></div>
              <Input label="Icon" value={editing.icon || ''} onChange={v => setEditing(e => ({ ...e, icon: v }))} />
              <Input label="Color (hex)" value={editing.color || ''} onChange={v => setEditing(e => ({ ...e, color: v }))} />
              <Input label="Sort Order" type="number" value={String(editing.sortOrder || 0)} onChange={v => setEditing(e => ({ ...e, sortOrder: parseInt(v) || 0 }))} />
              <div className="flex items-center gap-3 pt-5">
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={!!editing.active} onChange={e2 => setEditing(e => ({ ...e, active: e2.target.checked }))} />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={!!editing.featured} onChange={e2 => setEditing(e => ({ ...e, featured: e2.target.checked }))} />
                  Featured
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

      <Card>
        {loading ? (
          <div className="text-slate-500 text-sm text-center py-8">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-4 py-3 text-slate-500 font-medium">Solution</th>
                <th className="px-4 py-3 text-slate-500 font-medium">Tagline</th>
                <th className="px-4 py-3 text-slate-500 font-medium">Status</th>
                <th className="px-4 py-3 text-slate-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {solutions.map(s => (
                <tr key={s.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                        style={{ background: `${s.color}20`, border: `1px solid ${s.color}30` }}>
                        {s.icon}
                      </div>
                      <div>
                        <div className="font-medium text-white">{s.nameEn}</div>
                        <div className="text-xs text-slate-500">{s.nameFa}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 max-w-xs truncate">{s.taglineEn}</td>
                  <td className="px-4 py-3">
                    <Badge color={s.active ? 'green' : 'slate'}>{s.active ? 'Active' : 'Inactive'}</Badge>
                    {s.featured && <> <Badge color="yellow">Featured</Badge></>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Btn size="sm" variant="ghost" onClick={() => setEditing(s)}>Edit</Btn>
                      <Btn size="sm" variant="ghost" onClick={() => toggle(s)}>{s.active ? 'Disable' : 'Enable'}</Btn>
                    </div>
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
