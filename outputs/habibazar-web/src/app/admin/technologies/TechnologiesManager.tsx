'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, Badge, Input, Select, useToast } from '@/components/admin/ui'

type Technology = {
  id: number
  slug: string
  nameEn: string
  nameFa: string
  category: string
  icon: string
  color: string
  vendor: string | null
  tier: 'core' | 'advanced' | 'specialized'
  active: boolean
  sortOrder: number
}

const CATEGORIES = ['networking', 'virtualization', 'cloud', 'os', 'monitoring', 'security', 'identity', 'automation', 'containers', 'backup']
const TIERS = ['core', 'advanced', 'specialized']


export function TechnologiesManager() {
  const [techs, setTechs] = useState<Technology[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Technology> | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('all')
  const { toast, ToastContainer } = useToast()

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/technologies')
    setTechs(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return
    setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/technologies', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    if (res.ok) {
      toast(editing.id ? 'Technology updated' : 'Technology created', 'success')
      setEditing(null)
      load()
    } else {
      toast('Save failed', 'error')
    }
    setSaving(false)
  }

  const filtered = filter === 'all' ? techs : techs.filter(t => t.category === filter)

  return (
    <div>
      <ToastContainer />
      <PageHeader
        title="Technology Ecosystem"
        subtitle={`${techs.length} technologies`}
        action={<Btn onClick={() => setEditing({ icon: '⚙️', color: '#6366f1', active: true, category: 'networking', tier: 'core', sortOrder: techs.length + 1 })}>+ Add Technology</Btn>}
      />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0e0e1a] border border-slate-800 rounded-2xl w-full max-w-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">{editing.id ? 'Edit Technology' : 'New Technology'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Input label="Slug" value={editing.slug || ''} onChange={v => setEditing(e => ({ ...e, slug: v }))} /></div>
              <Input label="Name (EN)" value={editing.nameEn || ''} onChange={v => setEditing(e => ({ ...e, nameEn: v }))} />
              <Input label="Name (FA)" value={editing.nameFa || ''} onChange={v => setEditing(e => ({ ...e, nameFa: v }))} />
              <Select label="Category" value={editing.category || 'networking'} onChange={v => setEditing(e => ({ ...e, category: v }))} options={CATEGORIES.map(c => ({ value: c, label: c }))} />
              <Select label="Tier" value={editing.tier || 'core'} onChange={v => setEditing(e => ({ ...e, tier: v as Technology['tier'] }))} options={TIERS.map(t => ({ value: t, label: t }))} />
              <Input label="Icon" value={editing.icon || ''} onChange={v => setEditing(e => ({ ...e, icon: v }))} />
              <Input label="Color (hex)" value={editing.color || ''} onChange={v => setEditing(e => ({ ...e, color: v }))} />
              <div className="col-span-2"><Input label="Vendor" value={editing.vendor || ''} onChange={v => setEditing(e => ({ ...e, vendor: v }))} /></div>
              <Input label="Sort Order" type="number" value={String(editing.sortOrder || 0)} onChange={v => setEditing(e => ({ ...e, sortOrder: parseInt(v) || 0 }))} />
              <div className="flex items-center gap-3 pt-5">
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={!!editing.active} onChange={e2 => setEditing(e => ({ ...e, active: e2.target.checked }))} />
                  Active
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

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        {['all', ...CATEGORIES].map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === cat ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}>
            {cat}
          </button>
        ))}
      </div>

      <Card>
        {loading ? (
          <div className="text-slate-500 text-sm text-center py-8">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-4 py-3 text-slate-500 font-medium">Technology</th>
                <th className="px-4 py-3 text-slate-500 font-medium">Category</th>
                <th className="px-4 py-3 text-slate-500 font-medium">Tier</th>
                <th className="px-4 py-3 text-slate-500 font-medium">Vendor</th>
                <th className="px-4 py-3 text-slate-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                        style={{ background: `${t.color}20`, border: `1px solid ${t.color}30` }}>
                        {t.icon}
                      </div>
                      <div>
                        <div className="font-medium text-white">{t.nameEn}</div>
                        <div className="text-xs text-slate-500">{t.nameFa}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{t.category}</td>
                  <td className="px-4 py-3">
                    <Badge color={t.tier === 'core' ? 'green' : t.tier === 'advanced' ? 'blue' : 'yellow'}>{t.tier}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{t.vendor}</td>
                  <td className="px-4 py-3">
                    <Btn size="sm" variant="ghost" onClick={() => setEditing(t)}>Edit</Btn>
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
