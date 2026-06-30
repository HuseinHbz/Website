'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, Badge, Input, Select, useToast } from '@/components/admin/ui'

type Template = {
  id: number
  slug: string
  nameEn: string
  nameFa: string
  descriptionEn: string | null
  category: string
  active: boolean
  createdAt: string
}

const CATEGORIES = ['general', 'solution', 'industry', 'blog', 'landing', 'service']

export function TemplatesManager() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Template> | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/page-templates')
    setTemplates(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return
    setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/page-templates', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    if (res.ok) {
      toast(editing.id ? 'Template updated' : 'Template created', 'success')
      setEditing(null)
      load()
    } else {
      toast('Save failed', 'error')
    }
    setSaving(false)
  }

  async function del(id: number) {
    if (!confirm('Delete this template?')) return
    await fetch('/api/admin/page-templates', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
    toast('Template deleted', 'success')
  }

  return (
    <div>
      <ToastContainer />
      <PageHeader
        title="Page Templates"
        subtitle={`${templates.length} templates · Webflow-style reusable layouts`}
        action={<Btn onClick={() => setEditing({ active: true, category: 'general' })}>+ New Template</Btn>}
      />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0e0e1a] border border-slate-800 rounded-2xl w-full max-w-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">{editing.id ? 'Edit Template' : 'New Template'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Input label="Slug" value={editing.slug || ''} onChange={v => setEditing(e => ({ ...e, slug: v }))} /></div>
              <Input label="Name (EN)" value={editing.nameEn || ''} onChange={v => setEditing(e => ({ ...e, nameEn: v }))} />
              <Input label="Name (FA)" value={editing.nameFa || ''} onChange={v => setEditing(e => ({ ...e, nameFa: v }))} />
              <div className="col-span-2"><Input label="Description" value={editing.descriptionEn || ''} onChange={v => setEditing(e => ({ ...e, descriptionEn: v }))} /></div>
              <Select label="Category" value={editing.category || 'general'} onChange={v => setEditing(e => ({ ...e, category: v }))} options={CATEGORIES.map(c => ({ value: c, label: c }))} />
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

      <Card>
        {loading ? (
          <div className="text-slate-500 text-sm text-center py-8">Loading…</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-3xl mb-3">📄</div>
            <div className="text-slate-400 font-medium mb-1">No templates yet</div>
            <div className="text-slate-600 text-sm">Create your first page template to enable reusable layouts</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-4 py-3 text-slate-500 font-medium">Template</th>
                <th className="px-4 py-3 text-slate-500 font-medium">Category</th>
                <th className="px-4 py-3 text-slate-500 font-medium">Status</th>
                <th className="px-4 py-3 text-slate-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{t.nameEn}</div>
                    <div className="text-xs text-slate-500">{t.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{t.category}</td>
                  <td className="px-4 py-3">
                    <Badge color={t.active ? 'green' : 'slate'}>{t.active ? 'Active' : 'Draft'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Btn size="sm" variant="ghost" onClick={() => setEditing(t)}>Edit</Btn>
                      <Btn size="sm" variant="danger" onClick={() => del(t.id)}>Delete</Btn>
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
