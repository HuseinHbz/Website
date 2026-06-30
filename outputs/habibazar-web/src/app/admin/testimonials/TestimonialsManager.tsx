'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, Badge, Input, useToast } from '@/components/admin/ui'

type Testimonial = {
  id: number
  clientName: string
  clientTitle: string | null
  clientCompany: string | null
  quoteEn: string
  quoteFa: string | null
  rating: number
  solutionSlug: string | null
  featured: boolean
  active: boolean
  sortOrder: number
}

export function TestimonialsManager() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Testimonial> | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/testimonials')
    setTestimonials(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return
    setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/testimonials', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    if (res.ok) {
      toast(editing.id ? 'Testimonial updated' : 'Testimonial created', 'success')
      setEditing(null)
      load()
    } else {
      toast('Save failed', 'error')
    }
    setSaving(false)
  }

  async function toggle(t: Testimonial) {
    await fetch('/api/admin/testimonials', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, active: !t.active }) })
    load()
  }

  return (
    <div>
      <ToastContainer />
      <PageHeader
        title="Client Testimonials"
        subtitle={`${testimonials.length} testimonials`}
        action={<Btn onClick={() => setEditing({ rating: 5, active: true, featured: false, sortOrder: testimonials.length + 1 })}>+ Add Testimonial</Btn>}
      />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0e0e1a] border border-slate-800 rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4">{editing.id ? 'Edit Testimonial' : 'New Testimonial'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Client Name" value={editing.clientName || ''} onChange={v => setEditing(e => ({ ...e, clientName: v }))} />
              <Input label="Client Title" value={editing.clientTitle || ''} onChange={v => setEditing(e => ({ ...e, clientTitle: v }))} />
              <div className="col-span-2"><Input label="Company" value={editing.clientCompany || ''} onChange={v => setEditing(e => ({ ...e, clientCompany: v }))} /></div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400 mb-1 block">Quote (EN)</label>
                <textarea value={editing.quoteEn || ''} onChange={e2 => setEditing(e => ({ ...e, quoteEn: e2.target.value }))} rows={3}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400 mb-1 block">Quote (FA)</label>
                <textarea value={editing.quoteFa || ''} onChange={e2 => setEditing(e => ({ ...e, quoteFa: e2.target.value }))} rows={3}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none" dir="rtl" />
              </div>
              <Input label="Rating (1-5)" type="number" value={String(editing.rating || 5)} onChange={v => setEditing(e => ({ ...e, rating: Math.min(5, Math.max(1, parseInt(v) || 5)) }))} />
              <Input label="Solution Slug" value={editing.solutionSlug || ''} onChange={v => setEditing(e => ({ ...e, solutionSlug: v }))} />
              <div className="flex items-center gap-4 col-span-2 pt-2">
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
                <th className="px-4 py-3 text-slate-500 font-medium">Client</th>
                <th className="px-4 py-3 text-slate-500 font-medium">Quote</th>
                <th className="px-4 py-3 text-slate-500 font-medium">Rating</th>
                <th className="px-4 py-3 text-slate-500 font-medium">Status</th>
                <th className="px-4 py-3 text-slate-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {testimonials.map(t => (
                <tr key={t.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{t.clientName}</div>
                    <div className="text-xs text-slate-500">{t.clientTitle} · {t.clientCompany}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 max-w-xs truncate">{t.quoteEn}</td>
                  <td className="px-4 py-3 text-yellow-400">{'★'.repeat(t.rating)}</td>
                  <td className="px-4 py-3">
                    <Badge color={t.active ? 'green' : 'slate'}>{t.active ? 'Active' : 'Inactive'}</Badge>
                    {t.featured && <> <Badge color="yellow">Featured</Badge></>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Btn size="sm" variant="ghost" onClick={() => setEditing(t)}>Edit</Btn>
                      <Btn size="sm" variant="ghost" onClick={() => toggle(t)}>{t.active ? 'Disable' : 'Enable'}</Btn>
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
