'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, Select, PageHeader, Table, TR, TD, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

type Client = { id?: number; nameEn: string; nameFa: string; typeEn: string; typeFa: string; logoUrl: string; website: string; isTechPartner: boolean; sortOrder: number; active: boolean }
const EMPTY: Client = { nameEn: '', nameFa: '', typeEn: '', typeFa: '', logoUrl: '', website: '', isTechPartner: false, sortOrder: 0, active: true }

export function ClientsManager() {
  const t = useT()
  const [clients, setClients] = useState<Client[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Client>(EMPTY)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() {
    const r = await fetch('/api/admin/clients')
    const d = await r.json(); setClients(Array.isArray(d) ? d : [])
  }
  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/clients', { method: editing.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    setSaving(false)
    if (res.ok) { toast(t('saved')); setModal(false); load() } else toast(t('failed'), 'error')
  }

  async function del(id: number) {
    if (!confirm(t('confirmDel'))) return
    await fetch('/api/admin/clients', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast(t('deleted')); load()
  }

  async function toggle(c: Client) {
    await fetch('/api/admin/clients', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, active: !c.active }) })
    toast(t('saved')); load()
  }

  function set<K extends keyof Client>(k: K, v: Client[K]) { setEditing((e) => ({ ...e, [k]: v })) }

  return (
    <>
      <ToastContainer />
      <PageHeader title={t('clientsTitle')} action={<Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>{t('clientNew')}</Btn>} />

      <Card>
        <Table headers={[t('name'), t('type'), t('isTechPartner'), t('status'), t('actions')]}>
          {clients.map((c) => (
            <TR key={c.id}>
              <TD><div className="font-medium text-white">{c.nameEn}</div><div className="text-xs text-slate-500">{c.nameFa}</div></TD>
              <TD className="text-slate-400">{c.typeEn}</TD>
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
