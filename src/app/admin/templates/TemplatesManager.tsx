'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, Badge, Input, Select, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

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
  const t = useT()
  const locale = useAdminLocale()
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
      toast(editing.id ? t('updated') : t('created'), 'success')
      setEditing(null)
      load()
    } else {
      toast(t('saveFailed'), 'error')
    }
    setSaving(false)
  }

  async function del(id: number) {
    if (!confirm(t('confirmDel'))) return
    await fetch('/api/admin/page-templates', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
    toast(t('deleted'), 'success')
  }

  const columns: Column<Template>[] = [
    { key: 'nameEn', labelEn: 'Template', labelFa: t('template'), render: t2 => <div><div className="font-medium text-text-primary">{t2.nameEn}</div><div className="text-xs text-text-tertiary">{t2.slug}</div></div> },
    { key: 'category', labelEn: 'Category', labelFa: t('category'), type: 'enum', options: CATEGORIES.map(cat => ({ value: cat, labelEn: cat, labelFa: cat })), render: t2 => <span className="text-text-secondary">{t2.category}</span> },
    { key: 'active', labelEn: 'Status', labelFa: t('status'), type: 'boolean', value: t2 => t2.active, render: t2 => <Badge color={t2.active ? 'green' : 'slate'}>{t2.active ? t('active') : t('draft')}</Badge> },
  ]
  const rowActions: RowAction<Template>[] = [
    { id: 'edit', labelEn: 'Edit', labelFa: t('edit'), icon: '✎', onClick: t2 => setEditing(t2) },
    { id: 'del', labelEn: 'Delete', labelFa: t('del'), icon: '🗑', danger: true, onClick: t2 => del(t2.id) },
  ]

  return (
    <div>
      <ToastContainer />
      <PageHeader
        title={t('templatesTitle')}
        subtitle={`${templates.length} templates · Webflow-style reusable layouts`}
        action={<Btn onClick={() => setEditing({ active: true, category: 'general' })}>{t('addTemplate')}</Btn>}
      />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-2xl w-full max-w-xl p-6">
            <h3 className="text-lg font-bold text-text-primary mb-4">{editing.id ? t('editTemplate') : t('newTemplate')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Input label={t('slug')} value={editing.slug || ''} onChange={v => setEditing(e => ({ ...e, slug: v }))} /></div>
              <Input label={t('nameEn')} value={editing.nameEn || ''} onChange={v => setEditing(e => ({ ...e, nameEn: v }))} />
              <Input label={t('nameFa')} value={editing.nameFa || ''} onChange={v => setEditing(e => ({ ...e, nameFa: v }))} />
              <div className="col-span-2"><Input label={t('description')} value={editing.descriptionEn || ''} onChange={v => setEditing(e => ({ ...e, descriptionEn: v }))} /></div>
              <Select label={t('category')} value={editing.category || 'general'} onChange={v => setEditing(e => ({ ...e, category: v }))} options={CATEGORIES.map(cat => ({ value: cat, label: cat }))} />
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
          tableId="page-templates"
          columns={columns}
          rows={templates}
          locale={locale}
          loading={loading}
          rowKey={t2 => String(t2.id)}
          rowActions={rowActions}
          exportName="page-templates"
          emptyLabel="No templates yet"
          quickCreate={{ labelEn: 'Add Template', labelFa: t('addTemplate'), onClick: () => setEditing({ active: true, category: 'general' }) }}
        />
      </Card>
    </div>
  )
}
