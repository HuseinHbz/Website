'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, Select, PageHeader, Table, TR, TD, Badge, Modal, useToast, ColorDot } from '@/components/admin/ui'

type Service = {
  id?: number; slug: string; titleEn: string; titleFa: string; categoryEn: string; categoryFa: string
  shortDescEn: string; shortDescFa: string; longDescEn: string; longDescFa: string
  featuresEn: string; featuresFa: string; icon: string; color: string; sortOrder: number; active: boolean
}
const EMPTY: Service = { slug: '', titleEn: '', titleFa: '', categoryEn: '', categoryFa: '', shortDescEn: '', shortDescFa: '', longDescEn: '', longDescFa: '', featuresEn: '[]', featuresFa: '[]', icon: '', color: '#6366f1', sortOrder: 0, active: true }

export function ServicesManager() {
  const [services, setServices] = useState<Service[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Service>(EMPTY)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() { const r = await fetch('/api/admin/services'); setServices(await r.json()) }
  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/services', { method: editing.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    setSaving(false)
    if (res.ok) { toast('Saved'); setModal(false); load() } else toast('Failed', 'error')
  }

  async function del(id: number) {
    if (!confirm('Delete this service?')) return
    await fetch('/api/admin/services', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast('Deleted'); load()
  }

  function set<K extends keyof Service>(k: K, v: Service[K]) { setEditing((e) => ({ ...e, [k]: v })) }

  return (
    <>
      <ToastContainer />
      <PageHeader title="Services" subtitle="Manage the 9 enterprise service offerings" action={<Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>+ New Service</Btn>} />

      <Card>
        <Table headers={['Service', 'Category', 'Color', 'Order', 'Status', 'Actions']}>
          {services.map((s) => (
            <TR key={s.id}>
              <TD>
                <div className="font-medium text-white">{s.titleEn}</div>
                <div className="text-xs text-slate-500">{s.titleFa}</div>
              </TD>
              <TD className="text-slate-400">{s.categoryEn}</TD>
              <TD><ColorDot color={s.color} /></TD>
              <TD className="text-slate-500">{s.sortOrder}</TD>
              <TD><Badge color={s.active ? 'green' : 'slate'}>{s.active ? 'Active' : 'Hidden'}</Badge></TD>
              <TD>
                <div className="flex gap-2">
                  <Btn size="sm" variant="secondary" onClick={() => { setEditing(s); setModal(true) }}>Edit</Btn>
                  <Btn size="sm" variant="danger" onClick={() => del(s.id!)}>Del</Btn>
                </div>
              </TD>
            </TR>
          ))}
        </Table>
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? 'Edit Service' : 'New Service'} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Input label="Slug *" value={editing.slug} onChange={(v) => set('slug', v)} placeholder="network-design" />
            <Input label="Color" type="color" value={editing.color} onChange={(v) => set('color', v)} />
            <Input label="Sort Order" type="number" value={String(editing.sortOrder)} onChange={(v) => set('sortOrder', Number(v))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Title (EN)" value={editing.titleEn} onChange={(v) => set('titleEn', v)} />
            <Input label="Title (FA)" value={editing.titleFa} onChange={(v) => set('titleFa', v)} />
            <Input label="Category (EN)" value={editing.categoryEn} onChange={(v) => set('categoryEn', v)} />
            <Input label="Category (FA)" value={editing.categoryFa} onChange={(v) => set('categoryFa', v)} />
            <Input label="Short Desc (EN)" value={editing.shortDescEn} onChange={(v) => set('shortDescEn', v)} multiline rows={2} />
            <Input label="Short Desc (FA)" value={editing.shortDescFa} onChange={(v) => set('shortDescFa', v)} multiline rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Features (EN) — JSON array" value={editing.featuresEn} onChange={(v) => set('featuresEn', v)} multiline rows={4} placeholder='["Feature 1","Feature 2"]' />
            <Input label="Features (FA) — JSON array" value={editing.featuresFa} onChange={(v) => set('featuresFa', v)} multiline rows={4} />
          </div>
          <Select label="Status" value={editing.active ? 'true' : 'false'} onChange={(v) => set('active', v === 'true')} options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Hidden' }]} />
          <div className="flex gap-3">
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Service'}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>Cancel</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
