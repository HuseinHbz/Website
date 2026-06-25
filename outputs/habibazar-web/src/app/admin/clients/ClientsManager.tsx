'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, Select, PageHeader, Table, TR, TD, Badge, Modal, useToast } from '@/components/admin/ui'

type Client = { id?: number; nameEn: string; nameFa: string; typeEn: string; typeFa: string; logoUrl: string; website: string; isTechPartner: boolean; sortOrder: number; active: boolean }
const EMPTY: Client = { nameEn: '', nameFa: '', typeEn: '', typeFa: '', logoUrl: '', website: '', isTechPartner: false, sortOrder: 0, active: true }

export function ClientsManager() {
  const [clients, setClients] = useState<Client[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Client>(EMPTY)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() { const r = await fetch('/api/admin/clients'); setClients(await r.json()) }
  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/clients', { method: editing.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    setSaving(false)
    if (res.ok) { toast('Saved'); setModal(false); load() } else toast('Failed', 'error')
  }

  async function del(id: number) {
    if (!confirm('Delete?')) return
    await fetch('/api/admin/clients', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast('Deleted'); load()
  }

  function set<K extends keyof Client>(k: K, v: Client[K]) { setEditing((e) => ({ ...e, [k]: v })) }

  return (
    <>
      <ToastContainer />
      <PageHeader title="Clients & Technology Partners" action={<Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>+ Add Client</Btn>} />

      <Card>
        <Table headers={['Name', 'Type', 'Partner?', 'Status', 'Actions']}>
          {clients.map((c) => (
            <TR key={c.id}>
              <TD>
                <div className="font-medium text-white">{c.nameEn}</div>
                <div className="text-xs text-slate-500">{c.nameFa}</div>
              </TD>
              <TD className="text-slate-400">{c.typeEn}</TD>
              <TD><Badge color={c.isTechPartner ? 'blue' : 'slate'}>{c.isTechPartner ? 'Tech Partner' : 'Client'}</Badge></TD>
              <TD><Badge color={c.active ? 'green' : 'slate'}>{c.active ? 'Active' : 'Hidden'}</Badge></TD>
              <TD>
                <div className="flex gap-2">
                  <Btn size="sm" variant="secondary" onClick={() => { setEditing(c); setModal(true) }}>Edit</Btn>
                  <Btn size="sm" variant="danger" onClick={() => del(c.id!)}>Del</Btn>
                </div>
              </TD>
            </TR>
          ))}
        </Table>
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? 'Edit Client' : 'New Client'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Name (EN)" value={editing.nameEn} onChange={(v) => set('nameEn', v)} />
            <Input label="Name (FA)" value={editing.nameFa} onChange={(v) => set('nameFa', v)} />
            <Input label="Type (EN)" value={editing.typeEn} onChange={(v) => set('typeEn', v)} placeholder="Hospitality" />
            <Input label="Type (FA)" value={editing.typeFa} onChange={(v) => set('typeFa', v)} />
          </div>
          <Input label="Logo URL" value={editing.logoUrl} onChange={(v) => set('logoUrl', v)} placeholder="/uploads/logos/client.png" />
          <Input label="Website URL" value={editing.website} onChange={(v) => set('website', v)} placeholder="https://..." />
          <div className="grid grid-cols-3 gap-4">
            <Select label="Type" value={editing.isTechPartner ? 'true' : 'false'} onChange={(v) => set('isTechPartner', v === 'true')} options={[{ value: 'false', label: 'Client' }, { value: 'true', label: 'Tech Partner' }]} />
            <Select label="Status" value={editing.active ? 'true' : 'false'} onChange={(v) => set('active', v === 'true')} options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Hidden' }]} />
            <Input label="Sort Order" type="number" value={String(editing.sortOrder)} onChange={(v) => set('sortOrder', Number(v))} />
          </div>
          <div className="flex gap-3">
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>Cancel</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
