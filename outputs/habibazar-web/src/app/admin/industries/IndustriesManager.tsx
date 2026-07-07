'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, Badge, Input, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

type Industry = {
  id: number
  slug: string
  nameEn: string
  nameFa: string
  taglineEn: string | null
  icon: string
  color: string
  active: boolean
  sortOrder: number
}

export function IndustriesManager() {
  const t = useT()
  const locale = useAdminLocale()
  const [industries, setIndustries] = useState<Industry[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Industry> | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/industries')
    setIndustries(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return
    setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/industries', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    if (res.ok) {
      toast(editing.id ? t('saved') : t('saved'), 'success')
      setEditing(null)
      load()
    } else {
      toast(t('failed'), 'error')
    }
    setSaving(false)
  }

  const columns: Column<Industry>[] = [
    {
      key: 'nameEn', labelEn: 'Industry', labelFa: t('colIndustry'),
      render: ind => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base" style={{ background: `${ind.color}20`, border: `1px solid ${ind.color}30` }}>{ind.icon}</div>
          <div><div className="font-medium text-white">{ind.nameEn}</div><div className="text-xs text-text-tertiary">{ind.nameFa}</div></div>
        </div>
      ),
    },
    { key: 'taglineEn', labelEn: 'Tagline', labelFa: t('colTagline'), render: ind => <span className="text-text-secondary">{ind.taglineEn}</span> },
    { key: 'active', labelEn: 'Status', labelFa: t('status'), type: 'boolean', value: ind => ind.active, render: ind => <Badge color={ind.active ? 'green' : 'slate'}>{ind.active ? t('active') : t('inactive')}</Badge> },
  ]
  const rowActions: RowAction<Industry>[] = [{ id: 'edit', labelEn: 'Edit', labelFa: t('edit'), icon: '✎', onClick: ind => setEditing(ind) }]

  return (
    <div>
      <ToastContainer />
      <PageHeader
        title={t('industriesTitle')}
        subtitle={`${industries.length} ${t('industriesSub')}`}
        action={<Btn onClick={() => setEditing({ icon: '🏢', color: '#6366f1', active: true, sortOrder: industries.length + 1 })}>{t('addIndustry')}</Btn>}
      />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-2xl w-full max-w-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">{editing.id ? t('editIndustry') : t('newIndustry')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Input label={t('slug')} value={editing.slug || ''} onChange={v => setEditing(e => ({ ...e, slug: v }))} /></div>
              <Input label={t('nameEn')} value={editing.nameEn || ''} onChange={v => setEditing(e => ({ ...e, nameEn: v }))} />
              <Input label={t('nameFa')} value={editing.nameFa || ''} onChange={v => setEditing(e => ({ ...e, nameFa: v }))} />
              <div className="col-span-2"><Input label={t('taglineEn')} value={editing.taglineEn || ''} onChange={v => setEditing(e => ({ ...e, taglineEn: v }))} /></div>
              <Input label={t('icon')} value={editing.icon || ''} onChange={v => setEditing(e => ({ ...e, icon: v }))} />
              <Input label={t('colorHex')} value={editing.color || ''} onChange={v => setEditing(e => ({ ...e, color: v }))} />
              <Input label={t('sortOrder')} type="number" value={String(editing.sortOrder || 0)} onChange={v => setEditing(e => ({ ...e, sortOrder: parseInt(v) || 0 }))} />
              <div className="flex items-center gap-3 pt-5">
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                  <input type="checkbox" checked={!!editing.active} onChange={e2 => setEditing(e => ({ ...e, active: e2.target.checked }))} />
                  {t('activeLabel')}
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
          tableId="industries"
          columns={columns}
          rows={industries}
          locale={locale}
          loading={loading}
          rowKey={ind => String(ind.id)}
          rowActions={rowActions}
          exportName="industries"
          quickCreate={{ labelEn: 'Add Industry', labelFa: t('addIndustry'), onClick: () => setEditing({ icon: '🏢', color: '#6366f1', active: true, sortOrder: industries.length + 1 }) }}
        />
      </Card>
    </div>
  )
}
