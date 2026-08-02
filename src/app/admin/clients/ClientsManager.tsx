'use client'

import { useState } from 'react'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { crud, useResource } from '@/lib/admin/crud'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

type Client = { id?: number; nameEn: string; nameFa: string; typeEn: string; typeFa: string; logoUrl: string; website: string; isTechPartner: boolean; sortOrder: number; active: boolean }
const EMPTY: Client = { nameEn: '', nameFa: '', typeEn: '', typeFa: '', logoUrl: '', website: '', isTechPartner: false, sortOrder: 0, active: true }

export function ClientsManager() {
  const t = useT()
  const locale = useAdminLocale()
  const { data: clients, reload: load } = useResource<Client>('/api/admin/clients')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Client>(EMPTY)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function save() {
    setSaving(true)
    const res = await crud.save('/api/admin/clients', editing)
    setSaving(false)
    if (res.ok) { toast(t('saved')); setModal(false); load() } else toast(await crud.errorOf(res, t('failed')), 'error')
  }

  async function del(id: number) {
    if (!confirm(t('confirmDel'))) return
    await crud.remove('/api/admin/clients', id)
    toast(t('deleted')); load()
  }

  async function toggle(c: Client) {
    await crud.patch('/api/admin/clients', { id: c.id, active: !c.active })
    toast(t('saved')); load()
  }

  function set<K extends keyof Client>(k: K, v: Client[K]) { setEditing((e) => ({ ...e, [k]: v })) }

  const columns: Column<Client>[] = [
    { key: 'nameEn', labelEn: 'Name', labelFa: t('name'), render: c => <div><div className="font-medium text-text-primary">{c.nameEn}</div><div className="text-xs text-text-tertiary">{c.nameFa}</div></div> },
    { key: 'typeEn', labelEn: 'Type', labelFa: t('type'), type: 'enum', render: c => <span className="text-text-secondary">{c.typeEn}</span> },
    { key: 'isTechPartner', labelEn: 'Tech Partner', labelFa: t('isTechPartner'), type: 'boolean', value: c => c.isTechPartner, render: c => <Badge color={c.isTechPartner ? 'blue' : 'slate'}>{c.isTechPartner ? t('isTechPartner') : t('isClient')}</Badge> },
    { key: 'active', labelEn: 'Status', labelFa: t('status'), type: 'boolean', value: c => c.active, render: c => <Badge color={c.active ? 'green' : 'slate'}>{c.active ? t('active') : t('hidden')}</Badge> },
  ]
  const rowActions: RowAction<Client>[] = [
    { id: 'edit', labelEn: 'Edit', labelFa: t('edit'), icon: '✎', onClick: c => { setEditing(c); setModal(true) } },
    { id: 'toggle', labelEn: 'Toggle', labelFa: t('status'), icon: '⇄', onClick: c => toggle(c) },
    { id: 'del', labelEn: 'Delete', labelFa: t('delete'), icon: '🗑', danger: true, onClick: c => del(c.id!) },
  ]

  return (
    <>
      <ToastContainer />
      <PageHeader title={t('clientsTitle')} action={<Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>{t('clientNew')}</Btn>} />

      <Card>
        <DataTable tableId="clients" columns={columns} rows={clients} locale={locale} rowKey={c => String(c.id)} rowActions={rowActions} exportName="clients" />
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? t('clientEdit') : t('clientNew')}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('nameEn')} value={editing.nameEn} onChange={(v) => set('nameEn', v)} />
            <Input label={t('nameFa')} value={editing.nameFa} onChange={(v) => set('nameFa', v)} />
            <Input label={t('typeEn')} value={editing.typeEn} onChange={(v) => set('typeEn', v)} placeholder="Hospitality" />
            <Input label={t('typeFa')} value={editing.typeFa} onChange={(v) => set('typeFa', v)} />
          </div>
          <Input label={t('logoUrl')} value={editing.logoUrl} onChange={(v) => set('logoUrl', v)} placeholder="/uploads/logos/client.png" />
          <Input label={t('website')} value={editing.website} onChange={(v) => set('website', v)} placeholder="https://..." />
          <div className="grid grid-cols-3 gap-4">
            <Select label={t('type')} value={editing.isTechPartner ? 'true' : 'false'} onChange={(v) => set('isTechPartner', v === 'true')} options={[{ value: 'false', label: t('isClient') }, { value: 'true', label: t('isTechPartner') }]} />
            <Select label={t('status')} value={editing.active ? 'true' : 'false'} onChange={(v) => set('active', v === 'true')} options={[{ value: 'true', label: t('active') }, { value: 'false', label: t('hidden') }]} />
            <Input label={t('sortOrder')} type="number" value={String(editing.sortOrder)} onChange={(v) => set('sortOrder', Number(v))} />
          </div>
          <div className="flex gap-3">
            <Btn onClick={save} disabled={saving}>{saving ? t('saving') : t('save')}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>{t('cancel')}</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
