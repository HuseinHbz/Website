'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, Badge, Input, Select, useToast } from '@/components/admin/ui'

type Site = {
  id: string
  name: string
  slug: string
  domain: string | null
  type: string
  status: string
  workspaceId: string | null
  defaultLocale: string
  shareMedia: boolean
  shareTemplates: boolean
  shareKb: boolean
  shareUsers: boolean
}

const STATUS_COLORS: Record<string, string> = { active: 'green', staging: 'yellow', archived: 'slate', maintenance: 'red' }
const SITE_TYPES = ['personal', 'corporate', 'academy', 'docs', 'support', 'portal', 'partner', 'developer', 'status']
const STATUSES = ['active', 'staging', 'archived', 'maintenance']

export function SitesManager() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Site> | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/sites')
    setSites(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return
    setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/sites', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    if (res.ok) { toast(editing.id ? 'Site updated' : 'Site created', 'success'); setEditing(null); load() }
    else toast('Save failed', 'error')
    setSaving(false)
  }

  async function del(id: string) {
    if (!confirm('Archive this site?')) return
    await fetch('/api/admin/sites', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load(); toast('Site deleted', 'success')
  }

  function clone(s: Site) {
    setEditing({ ...s, id: undefined, name: `${s.name} (copy)`, slug: `${s.slug}-copy`, domain: null, status: 'staging' })
  }

  return (
    <div>
      <ToastContainer />
      <PageHeader
        title="Multi-Site Management"
        subtitle={`${sites.length} sites across your enterprise ecosystem`}
        action={<Btn onClick={() => setEditing({ type: 'corporate', status: 'staging', defaultLocale: 'en', shareMedia: true, shareTemplates: true, shareKb: false, shareUsers: false })}>+ New Site</Btn>}
      />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0e0e1a] border border-slate-800 rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4">{editing.id ? 'Edit Site' : 'New Site'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Input label="Site Name" value={editing.name || ''} onChange={v => setEditing(e => ({ ...e, name: v }))} /></div>
              <Input label="Slug" value={editing.slug || ''} onChange={v => setEditing(e => ({ ...e, slug: v }))} />
              <Input label="Domain" value={editing.domain || ''} onChange={v => setEditing(e => ({ ...e, domain: v }))} />
              <Select label="Type" value={editing.type || 'corporate'} onChange={v => setEditing(e => ({ ...e, type: v }))} options={SITE_TYPES.map(t => ({ value: t, label: t }))} />
              <Select label="Status" value={editing.status || 'staging'} onChange={v => setEditing(e => ({ ...e, status: v }))} options={STATUSES.map(s => ({ value: s, label: s }))} />
              <Select label="Default Locale" value={editing.defaultLocale || 'en'} onChange={v => setEditing(e => ({ ...e, defaultLocale: v }))} options={[{ value: 'en', label: 'English' }, { value: 'fa', label: 'فارسی' }]} />
              <Input label="Workspace ID" value={editing.workspaceId || ''} onChange={v => setEditing(e => ({ ...e, workspaceId: v }))} />
              <div className="col-span-2">
                <p className="text-xs text-slate-400 mb-2">Sharing Settings</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['shareMedia', 'shareTemplates', 'shareKb', 'shareUsers'] as const).map(field => (
                    <label key={field} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                      <input type="checkbox" checked={!!editing[field]} onChange={e2 => setEditing(e => ({ ...e, [field]: e2.target.checked }))} />
                      {field.replace('share', 'Share ')}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn>
              <Btn variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Sites', value: sites.length, icon: '🌐' },
          { label: 'Active', value: sites.filter(s => s.status === 'active').length, icon: '✅' },
          { label: 'Staging', value: sites.filter(s => s.status === 'staging').length, icon: '🔧' },
          { label: 'Archived', value: sites.filter(s => s.status === 'archived').length, icon: '📦' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="text-2xl">{stat.icon}</span>
            <div>
              <div className="text-2xl font-black text-white">{stat.value}</div>
              <div className="text-xs text-slate-500">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <Card>
        {loading ? <div className="text-slate-500 text-sm text-center py-8">Loading…</div> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-4 py-3 text-slate-500 font-medium">Site</th>
                <th className="px-4 py-3 text-slate-500 font-medium">Domain</th>
                <th className="px-4 py-3 text-slate-500 font-medium">Type</th>
                <th className="px-4 py-3 text-slate-500 font-medium">Status</th>
                <th className="px-4 py-3 text-slate-500 font-medium">Sharing</th>
                <th className="px-4 py-3 text-slate-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites.map(s => (
                <tr key={s.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{s.name}</div>
                    <div className="text-xs text-slate-500">{s.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono">{s.domain || '—'}</td>
                  <td className="px-4 py-3 text-slate-400">{s.type}</td>
                  <td className="px-4 py-3"><Badge color={STATUS_COLORS[s.status] || 'slate'}>{s.status}</Badge></td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {[s.shareMedia && 'Media', s.shareTemplates && 'Templates', s.shareKb && 'KB', s.shareUsers && 'Users'].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Btn size="sm" variant="ghost" onClick={() => setEditing(s)}>Edit</Btn>
                      <Btn size="sm" variant="ghost" onClick={() => clone(s)}>Clone</Btn>
                      <Btn size="sm" variant="danger" onClick={() => del(s.id)}>Delete</Btn>
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
