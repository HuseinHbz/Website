'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, Badge, Input, Select, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

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
  const t = useT()
  const locale = useAdminLocale()
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
    if (res.ok) { toast(editing.id ? t('updated') : t('created'), 'success'); setEditing(null); load() }
    else toast(t('saveFailed'), 'error')
    setSaving(false)
  }

  async function del(id: string) {
    if (!confirm(t('confirmDel'))) return
    await fetch('/api/admin/sites', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load(); toast(t('deleted'), 'success')
  }

  function clone(s: Site) {
    setEditing({ ...s, id: undefined, name: `${s.name} (copy)`, slug: `${s.slug}-copy`, domain: null, status: 'staging' })
  }

  const columns: Column<Site>[] = [
    { key: 'name', labelEn: 'Site', labelFa: t('site'), render: s => <div><div className="font-medium text-text-primary">{s.name}</div><div className="text-xs text-text-tertiary">{s.slug}</div></div> },
    { key: 'domain', labelEn: 'Domain', labelFa: t('domain'), render: s => <span className="text-text-secondary text-xs font-mono">{s.domain || '—'}</span> },
    { key: 'type', labelEn: 'Type', labelFa: t('type'), type: 'enum', options: SITE_TYPES.map(st => ({ value: st, labelEn: st, labelFa: st })), render: s => <span className="text-text-secondary">{s.type}</span> },
    { key: 'status', labelEn: 'Status', labelFa: t('status'), type: 'enum', options: STATUSES.map(ss => ({ value: ss, labelEn: ss, labelFa: ss })), render: s => <Badge color={STATUS_COLORS[s.status] || 'slate'}>{s.status}</Badge> },
    { key: 'sharing', labelEn: 'Sharing', labelFa: t('sharing'), sortable: false, value: s => [s.shareMedia, s.shareTemplates, s.shareKb, s.shareUsers].filter(Boolean).length, render: s => <span className="text-xs text-text-tertiary">{[s.shareMedia && 'Media', s.shareTemplates && 'Templates', s.shareKb && 'KB', s.shareUsers && 'Users'].filter(Boolean).join(' · ') || '—'}</span> },
  ]
  const rowActions: RowAction<Site>[] = [
    { id: 'edit', labelEn: 'Edit', labelFa: t('edit'), icon: '✎', onClick: s => setEditing(s) },
    { id: 'clone', labelEn: 'Clone', labelFa: t('clone'), icon: '⧉', onClick: s => clone(s) },
    { id: 'del', labelEn: 'Delete', labelFa: t('del'), icon: '🗑', danger: true, onClick: s => del(s.id) },
  ]

  return (
    <div>
      <ToastContainer />
      <PageHeader
        title={t('sitesTitle')}
        subtitle={`${sites.length} sites across your enterprise ecosystem`}
        action={<Btn onClick={() => setEditing({ type: 'corporate', status: 'staging', defaultLocale: 'en', shareMedia: true, shareTemplates: true, shareKb: false, shareUsers: false })}>{t('addSite')}</Btn>}
      />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-text-primary mb-4">{editing.id ? t('editSite') : t('newSite')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Input label={t('name')} value={editing.name || ''} onChange={v => setEditing(e => ({ ...e, name: v }))} /></div>
              <Input label={t('slug')} value={editing.slug || ''} onChange={v => setEditing(e => ({ ...e, slug: v }))} />
              <Input label={t('domain')} value={editing.domain || ''} onChange={v => setEditing(e => ({ ...e, domain: v }))} />
              <Select label={t('type')} value={editing.type || 'corporate'} onChange={v => setEditing(e => ({ ...e, type: v }))} options={SITE_TYPES.map(st => ({ value: st, label: st }))} />
              <Select label={t('status')} value={editing.status || 'staging'} onChange={v => setEditing(e => ({ ...e, status: v }))} options={STATUSES.map(ss => ({ value: ss, label: ss }))} />
              <Select label={t('defaultLocale')} value={editing.defaultLocale || 'en'} onChange={v => setEditing(e => ({ ...e, defaultLocale: v }))} options={[{ value: 'en', label: 'English' }, { value: 'fa', label: 'فارسی' }]} />
              <Input label={t('workspaceId')} value={editing.workspaceId || ''} onChange={v => setEditing(e => ({ ...e, workspaceId: v }))} />
              <div className="col-span-2">
                <p className="text-xs text-text-secondary mb-2">{t('sharingSettings')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['shareMedia', 'shareTemplates', 'shareKb', 'shareUsers'] as const).map(field => (
                    <label key={field} className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                      <input type="checkbox" checked={!!editing[field]} onChange={e2 => setEditing(e => ({ ...e, [field]: e2.target.checked }))} />
                      {field.replace('share', 'Share ')}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Btn onClick={save} disabled={saving}>{saving ? t('saving') : t('save')}</Btn>
              <Btn variant="ghost" onClick={() => setEditing(null)}>{t('cancel')}</Btn>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {[
          { label: t('totalSites'), value: sites.length, icon: '🌐' },
          { label: t('active'), value: sites.filter(s => s.status === 'active').length, icon: '✅' },
          { label: t('staging'), value: sites.filter(s => s.status === 'staging').length, icon: '🔧' },
          { label: t('archived'), value: sites.filter(s => s.status === 'archived').length, icon: '📦' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="text-2xl">{stat.icon}</span>
            <div>
              <div className="text-2xl font-black text-text-primary">{stat.value}</div>
              <div className="text-xs text-text-tertiary">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <DataTable
          tableId="sites"
          columns={columns}
          rows={sites}
          locale={locale}
          loading={loading}
          rowKey={s => String(s.id)}
          rowActions={rowActions}
          exportName="sites"
          quickCreate={{ labelEn: 'Add Site', labelFa: t('addSite'), onClick: () => setEditing({ type: 'corporate', status: 'staging', defaultLocale: 'en', shareMedia: true, shareTemplates: true, shareKb: false, shareUsers: false }) }}
        />
      </Card>
    </div>
  )
}
