'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast, ColorDot } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

type Service = {
  id?: number; slug: string; titleEn: string; titleFa: string; categoryEn: string; categoryFa: string
  shortDescEn: string; shortDescFa: string; longDescEn: string; longDescFa: string
  featuresEn: string; featuresFa: string; icon: string; color: string; sortOrder: number; active: boolean
}
const EMPTY: Service = { slug: '', titleEn: '', titleFa: '', categoryEn: '', categoryFa: '', shortDescEn: '', shortDescFa: '', longDescEn: '', longDescFa: '', featuresEn: '[]', featuresFa: '[]', icon: '', color: '#6366f1', sortOrder: 0, active: true }

export function ServicesManager() {
  const t = useT()
  const locale = useAdminLocale()
  const [services, setServices] = useState<Service[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Service>(EMPTY)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() {
    const r = await fetch('/api/admin/services')
    const d = await r.json(); setServices(Array.isArray(d) ? d : [])
  }
  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/services', { method: editing.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    setSaving(false)
    if (res.ok) { toast(t('saved')); setModal(false); load() } else toast(t('failed'), 'error')
  }

  async function del(id: number) {
    if (!confirm(t('confirmDel'))) return
    await fetch('/api/admin/services', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast(t('deleted')); load()
  }

  async function toggle(s: Service) {
    await fetch('/api/admin/services', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, active: !s.active }) })
    toast(t('saved')); load()
  }

  function set<K extends keyof Service>(k: K, v: Service[K]) { setEditing((e) => ({ ...e, [k]: v })) }

  const serviceColumns: Column<Service>[] = [
    { key: 'titleEn', labelEn: 'Title', labelFa: t('title'), render: s => <div><div className="font-medium text-text-primary">{s.titleEn}</div><div className="text-xs text-text-tertiary">{s.titleFa}</div></div> },
    { key: 'categoryEn', labelEn: 'Category', labelFa: t('category'), type: 'enum', render: s => <span className="text-text-secondary">{s.categoryEn}</span> },
    { key: 'color', labelEn: 'Color', labelFa: t('color'), sortable: false, render: s => <ColorDot color={s.color} /> },
    { key: 'sortOrder', labelEn: 'Order', labelFa: t('sortOrder'), type: 'number', numeric: true, render: s => <span className="text-text-tertiary">{s.sortOrder}</span> },
    { key: 'active', labelEn: 'Status', labelFa: t('status'), type: 'boolean', value: s => s.active, render: s => <Badge color={s.active ? 'green' : 'slate'}>{s.active ? t('active') : t('hidden')}</Badge> },
  ]
  const serviceActions: RowAction<Service>[] = [
    { id: 'edit', labelEn: 'Edit', labelFa: t('edit'), icon: '✎', onClick: s => { setEditing(s); setModal(true) } },
    { id: 'toggle', labelEn: 'Toggle', labelFa: t('status'), icon: '⇄', onClick: s => toggle(s) },
    { id: 'del', labelEn: 'Delete', labelFa: t('delete'), icon: '🗑', danger: true, onClick: s => del(s.id!) },
  ]

  return (
    <>
      <ToastContainer />
      <PageHeader title={t('servicesTitle')} action={<Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>{t('addNew')} {t('servicesTitle')}</Btn>} />

      <Card>
        <DataTable tableId="services" columns={serviceColumns} rows={services} locale={locale} rowKey={s => String(s.id)} rowActions={serviceActions} exportName="services" />
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? t('serviceEdit') : t('serviceNew')} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Input label={`${t('slug')} *`} value={editing.slug} onChange={(v) => set('slug', v)} placeholder="network-design" />
            <Input label={t('color')} type="color" value={editing.color} onChange={(v) => set('color', v)} />
            <Input label={t('sortOrder')} type="number" value={String(editing.sortOrder)} onChange={(v) => set('sortOrder', Number(v))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('titleEn')} value={editing.titleEn} onChange={(v) => set('titleEn', v)} />
            <Input label={t('titleFa')} value={editing.titleFa} onChange={(v) => set('titleFa', v)} />
            <Input label={t('catEn')} value={editing.categoryEn} onChange={(v) => set('categoryEn', v)} />
            <Input label={t('catFa')} value={editing.categoryFa} onChange={(v) => set('categoryFa', v)} />
            <Input label={t('shortDescEn')} value={editing.shortDescEn} onChange={(v) => set('shortDescEn', v)} multiline rows={2} />
            <Input label={t('shortDescFa')} value={editing.shortDescFa} onChange={(v) => set('shortDescFa', v)} multiline rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('featuresEn')} value={editing.featuresEn} onChange={(v) => set('featuresEn', v)} multiline rows={4} placeholder='["Feature 1","Feature 2"]' />
            <Input label={t('featuresFa')} value={editing.featuresFa} onChange={(v) => set('featuresFa', v)} multiline rows={4} />
          </div>
          <Select label={t('status')} value={editing.active ? 'true' : 'false'} onChange={(v) => set('active', v === 'true')} options={[{ value: 'true', label: t('active') }, { value: 'false', label: t('hidden') }]} />
          <div className="flex gap-3">
            <Btn onClick={save} disabled={saving}>{saving ? t('saving') : t('save')}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>{t('cancel')}</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
