'use client'

import { useEffect, useState } from 'react'
import { crud } from '@/lib/admin/crud'
import { PageHeader, Card, Btn, Badge, Input, Select, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

type Workspace = { id: string; name: string; slug: string; type: string; icon: string; color: string; isolationLevel: string; active: boolean; sortOrder: number }

const TYPES = ['personal', 'corporate', 'academy', 'docs', 'support', 'customer', 'partner', 'developer']
const ISOLATION = ['shared', 'isolated', 'partial']
const TYPE_ICONS: Record<string, string> = { personal: '👤', corporate: '🏢', academy: '🎓', docs: '📚', support: '🛟', customer: '👥', partner: '🤝', developer: '⚡' }

export function WorkspacesManager() {
  const t = useT()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Workspace> | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() { setLoading(true); const res = await fetch('/api/admin/workspaces'); setWorkspaces(await res.json()); setLoading(false) }
  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return; setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/workspaces', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    if (res.ok) { toast(t('saved'), 'success'); setEditing(null); load() } else toast(await crud.errorOf(res, t('failed')), 'error')
    setSaving(false)
  }

  return (
    <div>
      <ToastContainer />
      <PageHeader title={t('workspacesTitle')} subtitle={`${workspaces.length} workspaces`}
        action={<Btn onClick={() => setEditing({ type: 'corporate', icon: '🏢', color: '#6366f1', isolationLevel: 'partial', active: true, sortOrder: workspaces.length + 1 })}>{t('addWorkspace')}</Btn>} />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-2xl w-full max-w-xl p-6">
            <h3 className="text-lg font-bold text-text-primary mb-4">{editing.id ? t('editWorkspace') : t('newWorkspace')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Input label={t('name')} value={editing.name || ''} onChange={v => setEditing(e => ({ ...e, name: v }))} /></div>
              <Input label={t('slug')} value={editing.slug || ''} onChange={v => setEditing(e => ({ ...e, slug: v }))} />
              <Select label={t('type')} value={editing.type || 'corporate'} onChange={v => setEditing(e => ({ ...e, type: v, icon: TYPE_ICONS[v] || '🏢' }))} options={TYPES.map(tp => ({ value: tp, label: tp }))} />
              <Input label={t('icon')} value={editing.icon || ''} onChange={v => setEditing(e => ({ ...e, icon: v }))} />
              <Input label={t('color')} value={editing.color || ''} onChange={v => setEditing(e => ({ ...e, color: v }))} />
              <Select label={t('isolation')} value={editing.isolationLevel || 'partial'} onChange={v => setEditing(e => ({ ...e, isolationLevel: v }))} options={ISOLATION.map(iso => ({ value: iso, label: iso }))} />
              <div className="flex items-center gap-3 pt-5">
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                  <input type="checkbox" checked={!!editing.active} onChange={e2 => setEditing(e => ({ ...e, active: e2.target.checked }))} /> {t('activeLabel')}
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Btn onClick={save} disabled={saving}>{saving ? t('saving') : t('save')}</Btn>
              <Btn variant="ghost" onClick={() => setEditing(null)}>{t('cancel')}</Btn>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <div className="col-span-3 text-center py-8 text-text-tertiary">{t('loading')}</div> : workspaces.map(ws => (
          <div key={ws.id} className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: `${ws.color}20`, border: `1px solid ${ws.color}30` }}>
                {ws.icon}
              </div>
              <Badge color={ws.active ? 'green' : 'slate'}>{ws.active ? t('active') : t('inactive')}</Badge>
            </div>
            <div className="font-bold text-text-primary mb-1">{ws.name}</div>
            <div className="text-xs text-text-tertiary mb-3">{ws.type} · {ws.isolationLevel} isolation</div>
            <Btn size="sm" variant="ghost" onClick={() => setEditing(ws)}>{t('configure')}</Btn>
          </div>
        ))}
      </div>
    </div>
  )
}
