'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, Badge, Input, Select, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'
import { deleteRowAction } from '@/lib/admin/rowDelete'

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
  const t = useT()
  const locale = useAdminLocale()
  const [techs, setTechs] = useState<Technology[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Technology> | null>(null)
  const [saving, setSaving] = useState(false)
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
      toast(editing.id ? t('updated') : t('created'), 'success')
      setEditing(null)
      load()
    } else {
      toast(t('saveFailed'), 'error')
    }
    setSaving(false)
  }

  const columns: Column<Technology>[] = [
    {
      key: 'nameEn', labelEn: 'Technology', labelFa: t('technology'),
      render: tech => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base" style={{ background: `${tech.color}20`, border: `1px solid ${tech.color}30` }}>{tech.icon}</div>
          <div><div className="font-medium text-text-primary">{tech.nameEn}</div><div className="text-xs text-text-tertiary">{tech.nameFa}</div></div>
        </div>
      ),
    },
    { key: 'category', labelEn: 'Category', labelFa: t('category'), type: 'enum', options: CATEGORIES.map(c => ({ value: c, labelEn: c, labelFa: c })), render: tech => <span className="text-text-secondary">{tech.category}</span> },
    { key: 'tier', labelEn: 'Tier', labelFa: t('tier'), type: 'enum', options: TIERS.map(tr => ({ value: tr, labelEn: tr, labelFa: tr })), render: tech => <Badge color={tech.tier === 'core' ? 'green' : tech.tier === 'advanced' ? 'blue' : 'yellow'}>{tech.tier}</Badge> },
    { key: 'vendor', labelEn: 'Vendor', labelFa: t('vendor'), render: tech => <span className="text-text-secondary">{tech.vendor}</span> },
  ]
  const rowActions: RowAction<Technology>[] = [
    { id: 'edit', labelEn: 'Edit', labelFa: t('edit'), icon: '✎', onClick: tech => setEditing(tech) },
    // 26.33 BUG-205: the DELETE API always worked; this manager simply
    // never rendered a Delete affordance, so there was nothing to click.
    deleteRowAction<Technology>({ path: '/api/admin/technologies', fa: locale === 'fa', toast, reload: load, labelOf: r => String(r.nameEn ?? '') }),
  ]

  return (
    <div>
      <ToastContainer />
      <PageHeader
        title={t('techTitle')}
        subtitle={`${techs.length} technologies`}
        action={<Btn onClick={() => setEditing({ icon: '⚙️', color: '#6366f1', active: true, category: 'networking', tier: 'core', sortOrder: techs.length + 1 })}>{t('addTech')}</Btn>}
      />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-2xl w-full max-w-xl p-6">
            <h3 className="text-lg font-bold text-text-primary mb-4">{editing.id ? t('editTech') : t('newTech')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Input label={t('slug')} value={editing.slug || ''} onChange={v => setEditing(e => ({ ...e, slug: v }))} /></div>
              <Input label={t('nameEn')} value={editing.nameEn || ''} onChange={v => setEditing(e => ({ ...e, nameEn: v }))} />
              <Input label={t('nameFa')} value={editing.nameFa || ''} onChange={v => setEditing(e => ({ ...e, nameFa: v }))} />
              <Select label={t('category')} value={editing.category || 'networking'} onChange={v => setEditing(e => ({ ...e, category: v }))} options={CATEGORIES.map(cat => ({ value: cat, label: cat }))} />
              <Select label={t('tier')} value={editing.tier || 'core'} onChange={v => setEditing(e => ({ ...e, tier: v as Technology['tier'] }))} options={TIERS.map(tr => ({ value: tr, label: tr }))} />
              <Input label={t('icon')} value={editing.icon || ''} onChange={v => setEditing(e => ({ ...e, icon: v }))} />
              <Input label={t('colorHex')} value={editing.color || ''} onChange={v => setEditing(e => ({ ...e, color: v }))} />
              <div className="col-span-2"><Input label={t('vendor')} value={editing.vendor || ''} onChange={v => setEditing(e => ({ ...e, vendor: v }))} /></div>
              <Input label={t('sortOrder')} type="number" value={String(editing.sortOrder || 0)} onChange={v => setEditing(e => ({ ...e, sortOrder: parseInt(v) || 0 }))} />
              <div className="flex items-center gap-3 pt-5">
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                  <input type="checkbox" checked={!!editing.active} onChange={e2 => setEditing(e => ({ ...e, active: e2.target.checked }))} />
                  Active
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

      <Card>
        <DataTable
          tableId="technologies"
          columns={columns}
          rows={techs}
          locale={locale}
          loading={loading}
          rowKey={tech => String(tech.id)}
          rowActions={rowActions}
          exportName="technologies"
          quickCreate={{ labelEn: 'Add Technology', labelFa: t('addTech'), onClick: () => setEditing({ icon: '⚙️', color: '#6366f1', active: true, category: 'networking', tier: 'core', sortOrder: techs.length + 1 }) }}
        />
      </Card>
    </div>
  )
}
