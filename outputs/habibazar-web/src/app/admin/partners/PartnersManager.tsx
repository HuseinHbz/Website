'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, Badge, Input, Select, useToast } from '@/components/admin/ui'

type Partner = { id: number; slug: string; nameEn: string; type: string; tier: string; website: string | null; active: boolean; featured: boolean; sortOrder: number }

const TYPES = ['technology', 'reseller', 'consultant', 'distributor', 'referral']
const TIERS = ['platinum', 'gold', 'silver', 'bronze']
const TIER_COLORS: Record<string, string> = { platinum: 'blue', gold: 'yellow', silver: 'slate', bronze: 'red' }

export function PartnersManager() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Partner & { descriptionEn: string }> | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() { setLoading(true); const r = await fetch('/api/admin/partners'); setPartners(await r.json()); setLoading(false) }
  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return; setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/partners', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    if (res.ok) { toast('Saved', 'success'); setEditing(null); load() } else toast('Failed', 'error')
    setSaving(false)
  }

  return (
    <div>
      <ToastContainer />
      <PageHeader title="Partner Management" subtitle={`${partners.length} partners`}
        action={<Btn onClick={() => setEditing({ type: 'technology', tier: 'silver', active: true, featured: false, sortOrder: partners.length + 1 })}>+ Add Partner</Btn>} />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0e0e1a] border border-slate-800 rounded-2xl w-full max-w-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">{editing.id ? 'Edit Partner' : 'New Partner'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Input label="Slug" value={editing.slug || ''} onChange={v => setEditing(e => ({ ...e, slug: v }))} /></div>
              <div className="col-span-2"><Input label="Name (EN)" value={editing.nameEn || ''} onChange={v => setEditing(e => ({ ...e, nameEn: v }))} /></div>
              <Select label="Type" value={editing.type || 'technology'} onChange={v => setEditing(e => ({ ...e, type: v }))} options={TYPES.map(t => ({ value: t, label: t }))} />
              <Select label="Tier" value={editing.tier || 'silver'} onChange={v => setEditing(e => ({ ...e, tier: v }))} options={TIERS.map(t => ({ value: t, label: t }))} />
              <div className="col-span-2"><Input label="Website" value={editing.website || ''} onChange={v => setEditing(e => ({ ...e, website: v }))} /></div>
              <div className="flex items-center gap-4 col-span-2 pt-1">
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer"><input type="checkbox" checked={!!editing.active} onChange={e2 => setEditing(e => ({ ...e, active: e2.target.checked }))} /> Active</label>
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer"><input type="checkbox" checked={!!editing.featured} onChange={e2 => setEditing(e => ({ ...e, featured: e2.target.checked }))} /> Featured</label>
              </div>
            </div>
            <div className="flex gap-3 mt-6"><Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn><Btn variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn></div>
          </div>
        </div>
      )}

      <Card>
        {loading ? <div className="text-center py-8 text-slate-500">Loading…</div> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-800 text-left">{['Partner', 'Type', 'Tier', 'Website', 'Status', 'Actions'].map(h => <th key={h} className="px-4 py-3 text-slate-500 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {partners.map(p => (
                <tr key={p.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium text-white">{p.nameEn}</td>
                  <td className="px-4 py-3 text-slate-400">{p.type}</td>
                  <td className="px-4 py-3"><Badge color={TIER_COLORS[p.tier] || 'slate'}>{p.tier}</Badge></td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{p.website || '—'}</td>
                  <td className="px-4 py-3"><Badge color={p.active ? 'green' : 'slate'}>{p.active ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="px-4 py-3"><Btn size="sm" variant="ghost" onClick={() => setEditing(p)}>Edit</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
