'use client'

import { useState, useMemo } from 'react'
import { Card, Btn, Input, Select, PageHeader, Table, TR, TD, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'
import { crud, useResource } from '@/lib/admin/crud'

type Client = { id?: number; nameEn: string; nameFa: string; typeEn: string; typeFa: string; logoUrl: string; website: string; isTechPartner: boolean; sortOrder: number; active: boolean }
const EMPTY: Client = { nameEn: '', nameFa: '', typeEn: '', typeFa: '', logoUrl: '', website: '', isTechPartner: false, sortOrder: 0, active: true }

export function ClientsManager() {
  const t = useT()
  const { data: clients, reload: load } = useResource<Client>('/api/admin/clients')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Client>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'partner' | 'client'>('all')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'hidden'>('all')
  const { toast, ToastContainer } = useToast()

  const filtered = useMemo(() => clients.filter((c) => {
    const q = search.toLowerCase()
    if (q && !c.nameEn.toLowerCase().includes(q) && !c.nameFa.includes(q) && !c.typeEn.toLowerCase().includes(q)) return false
    if (filterType === 'partner' && !c.isTechPartner) return false
    if (filterType === 'client' && c.isTechPartner) return false
    if (filterActive === 'active' && !c.active) return false
    if (filterActive === 'hidden' && c.active) return false
    return true
  }), [clients, search, filterType, filterActive])

  async function save() {
    setSaving(true)
    const res = await crud.save('/api/admin/clients', editing)
    setSaving(false)
    if (res.ok) { toast(t('saved')); setModal(false); load() } else toast(t('failed'), 'error')
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

  return (
    <>
      <ToastContainer />
      <PageHeader title={t('clientsTitle')} action={<Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>{t('clientNew')}</Btn>} />

      <div className="flex flex-wrap gap-3 mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients..." className="flex-1 min-w-[200px] bg-background border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-text-disabled focus:outline-none focus:border-brand" />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value as typeof filterType)} className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand">
          <option value="all">All Types</option>
          <option value="partner">Tech Partners</option>
          <option value="client">Clients</option>
        </select>
        <select value={filterActive} onChange={(e) => setFilterActive(e.target.value as typeof filterActive)} className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="hidden">Hidden</option>
        </select>
        {(search || filterType !== 'all' || filterActive !== 'all') && <button onClick={() => { setSearch(''); setFilterType('all'); setFilterActive('all') }} className="px-3 py-2 text-xs text-text-secondary hover:text-white border border-border rounded-lg">✕ Clear</button>}
        <span className="px-3 py-2 text-xs text-text-tertiary">{filtered.length} / {clients.length}</span>
      </div>

      <Card>
        <Table headers={[t('name'), t('type'), t('isTechPartner'), t('status'), t('actions')]}>
          {filtered.map((c) => (
            <TR key={c.id}>
              <TD><div className="font-medium text-white">{c.nameEn}</div><div className="text-xs text-text-tertiary">{c.nameFa}</div></TD>
              <TD className="text-text-secondary">{c.typeEn}</TD>
              <TD><Badge color={c.isTechPartner ? 'blue' : 'slate'}>{c.isTechPartner ? t('isTechPartner') : t('isClient')}</Badge></TD>
              <TD><Badge color={c.active ? 'green' : 'slate'}>{c.active ? t('active') : t('hidden')}</Badge></TD>
              <TD>
                <div className="flex gap-2">
                  <Btn size="sm" variant="secondary" onClick={() => { setEditing(c); setModal(true) }}>{t('edit')}</Btn>
                  <Btn size="sm" variant="secondary" onClick={() => toggle(c)}>{c.active ? '⏸' : '▶'}</Btn>
                  <Btn size="sm" variant="danger" onClick={() => del(c.id!)}>{t('delete')}</Btn>
                </div>
              </TD>
            </TR>
          ))}
        </Table>
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
