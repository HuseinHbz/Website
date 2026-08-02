'use client'

import { useState, useEffect } from 'react'
import { crud } from '@/lib/admin/crud'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast, EmptyState, ColorDot } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

type Item = {
  id?: number; year: string; titleEn: string; titleFa: string
  companyEn: string; companyFa: string; descEn: string; descFa: string
  color: string; sortOrder: number; active: boolean
}
const EMPTY: Item = { year: '', titleEn: '', titleFa: '', companyEn: '', companyFa: '', descEn: '', descFa: '', color: '#6366f1', sortOrder: 0, active: true }

export function TimelineManager() {
  const t = useT()
  const locale = useAdminLocale()
  const [items, setItems] = useState<Item[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Item>(EMPTY)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() {
    const r = await fetch('/api/admin/timeline')
    const d = await r.json()
    setItems(Array.isArray(d) ? d : [])
  }
  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/timeline', {
      method: editing.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    })
    setSaving(false)
    if (res.ok) { toast(t('saved')); setModal(false); load() }
    else toast(await crud.errorOf(res, t('failed')), 'error')
  }

  async function del(id: number) {
    if (!confirm(t('confirmDel'))) return
    await fetch('/api/admin/timeline', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast(t('deleted')); load()
  }

  async function toggle(item: Item) {
    await fetch('/api/admin/timeline', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, active: !item.active }) })
    toast(t('saved')); load()
  }

  return (
    <>
      <ToastContainer />
      <PageHeader title={t('timelineTitle')} subtitle={t('timelineSub')} action={<Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>{t('timelineAdd')}</Btn>} />

      <Card>
        {items.length === 0 ? (
          <EmptyState icon="◎" title={t('timelineEmpty')} description={t('timelineEmptySub')} action={<Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>{t('timelineAddFirst')}</Btn>} />
        ) : (
          <DataTable
            tableId="timeline"
            columns={[
              { key: 'year', labelEn: 'Year', labelFa: t('year'), type: 'number', numeric: true, render: item => <span className="font-mono text-brand">{item.year}</span> },
              { key: 'titleEn', labelEn: 'Title', labelFa: t('titleEn'), render: item => <span>{item.titleEn}</span> },
              { key: 'companyEn', labelEn: 'Company', labelFa: t('companyEn'), type: 'enum', render: item => <span className="text-text-tertiary">{item.companyEn}</span> },
              { key: 'color', labelEn: 'Color', labelFa: t('color'), sortable: false, render: item => <ColorDot color={item.color} /> },
              { key: 'sortOrder', labelEn: 'Order', labelFa: t('sortOrder'), type: 'number', numeric: true, render: item => <span className="text-text-tertiary">{item.sortOrder}</span> },
              { key: 'active', labelEn: 'Status', labelFa: t('status'), type: 'boolean', value: item => item.active, render: item => <Badge color={item.active ? 'green' : 'slate'}>{item.active ? t('active') : t('hidden')}</Badge> },
            ] as Column<Item>[]}
            rows={items}
            locale={locale}
            rowKey={item => String(item.id)}
            rowActions={[
              { id: 'edit', labelEn: 'Edit', labelFa: t('edit'), icon: '✎', onClick: item => { setEditing(item); setModal(true) } },
              { id: 'toggle', labelEn: 'Toggle', labelFa: t('status'), icon: '⇄', onClick: item => toggle(item) },
              { id: 'del', labelEn: 'Delete', labelFa: t('delete'), icon: '🗑', danger: true, onClick: item => del(item.id!) },
            ] as RowAction<Item>[]}
            exportName="timeline"
          />
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? t('timelineEdit') : t('timelineNew')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Input label={`${t('year')} *`} value={editing.year} onChange={(v) => setEditing({ ...editing, year: v })} placeholder="2025" />
            <Input label={t('color')} type="color" value={editing.color} onChange={(v) => setEditing({ ...editing, color: v })} />
            <Input label={t('sortOrder')} type="number" value={String(editing.sortOrder)} onChange={(v) => setEditing({ ...editing, sortOrder: Number(v) })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={`${t('titleEn')} *`} value={editing.titleEn} onChange={(v) => setEditing({ ...editing, titleEn: v })} />
            <Input label={`${t('titleFa')} *`} value={editing.titleFa} onChange={(v) => setEditing({ ...editing, titleFa: v })} />
            <Input label={t('companyEn')} value={editing.companyEn} onChange={(v) => setEditing({ ...editing, companyEn: v })} />
            <Input label={t('companyFa')} value={editing.companyFa} onChange={(v) => setEditing({ ...editing, companyFa: v })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('descEn')} value={editing.descEn} onChange={(v) => setEditing({ ...editing, descEn: v })} multiline rows={3} />
            <Input label={t('descFa')} value={editing.descFa} onChange={(v) => setEditing({ ...editing, descFa: v })} multiline rows={3} />
          </div>
          <Select label={t('status')} value={editing.active ? 'true' : 'false'} onChange={(v) => setEditing({ ...editing, active: v === 'true' })} options={[{ value: 'true', label: t('active') }, { value: 'false', label: t('hidden') }]} />
          <div className="flex gap-3 pt-2">
            <Btn onClick={save} disabled={saving}>{saving ? t('saving') : t('save')}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>{t('cancel')}</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
