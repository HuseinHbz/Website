'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, Select, PageHeader, Table, TR, TD, Badge, Modal, useToast, EmptyState, ColorDot } from '@/components/admin/ui'

type Item = {
  id?: number; year: string; titleEn: string; titleFa: string
  companyEn: string; companyFa: string; descEn: string; descFa: string
  color: string; sortOrder: number; active: boolean
}
const EMPTY: Item = { year: '', titleEn: '', titleFa: '', companyEn: '', companyFa: '', descEn: '', descFa: '', color: '#6366f1', sortOrder: 0, active: true }

export function TimelineManager() {
  const [items, setItems] = useState<Item[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Item>(EMPTY)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() {
    const r = await fetch('/api/admin/timeline')
    setItems(await r.json())
  }
  useEffect(() => { load() }, [])

  function openNew() { setEditing(EMPTY); setModal(true) }
  function openEdit(item: Item) { setEditing(item); setModal(true) }

  async function save() {
    setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/timeline', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    })
    setSaving(false)
    if (res.ok) { toast('Saved'); setModal(false); load() }
    else toast('Failed to save', 'error')
  }

  async function del(id: number) {
    if (!confirm('Delete this timeline item?')) return
    await fetch('/api/admin/timeline', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast('Deleted'); load()
  }

  return (
    <>
      <ToastContainer />
      <PageHeader title="Career Timeline" subtitle="Manage your career history and milestones" action={<Btn onClick={openNew}>+ Add Item</Btn>} />

      <Card>
        {items.length === 0 ? (
          <EmptyState icon="◎" title="No timeline items" description="Add your career milestones" action={<Btn onClick={openNew}>+ Add First Item</Btn>} />
        ) : (
          <Table headers={['Year', 'Title (EN)', 'Company', 'Color', 'Order', 'Active', 'Actions']}>
            {items.map((item) => (
              <TR key={item.id}>
                <TD><span className="font-mono text-indigo-400">{item.year}</span></TD>
                <TD>{item.titleEn}</TD>
                <TD className="text-slate-500">{item.companyEn}</TD>
                <TD><ColorDot color={item.color} /></TD>
                <TD className="text-slate-500">{item.sortOrder}</TD>
                <TD><Badge color={item.active ? 'green' : 'slate'}>{item.active ? 'Active' : 'Hidden'}</Badge></TD>
                <TD>
                  <div className="flex gap-2">
                    <Btn size="sm" variant="secondary" onClick={() => openEdit(item)}>Edit</Btn>
                    <Btn size="sm" variant="danger" onClick={() => del(item.id!)}>Del</Btn>
                  </div>
                </TD>
              </TR>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? 'Edit Timeline Item' : 'New Timeline Item'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Input label="Year *" value={editing.year} onChange={(v) => setEditing({ ...editing, year: v })} placeholder="2025" />
            <Input label="Color" type="color" value={editing.color} onChange={(v) => setEditing({ ...editing, color: v })} />
            <Input label="Sort Order" type="number" value={String(editing.sortOrder)} onChange={(v) => setEditing({ ...editing, sortOrder: Number(v) })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Title (English) *" value={editing.titleEn} onChange={(v) => setEditing({ ...editing, titleEn: v })} />
            <Input label="Title (Persian) *" value={editing.titleFa} onChange={(v) => setEditing({ ...editing, titleFa: v })} />
            <Input label="Company (English)" value={editing.companyEn} onChange={(v) => setEditing({ ...editing, companyEn: v })} />
            <Input label="Company (Persian)" value={editing.companyFa} onChange={(v) => setEditing({ ...editing, companyFa: v })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Description (English)" value={editing.descEn} onChange={(v) => setEditing({ ...editing, descEn: v })} multiline rows={3} />
            <Input label="Description (Persian)" value={editing.descFa} onChange={(v) => setEditing({ ...editing, descFa: v })} multiline rows={3} />
          </div>
          <Select label="Status" value={editing.active ? 'true' : 'false'} onChange={(v) => setEditing({ ...editing, active: v === 'true' })} options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Hidden' }]} />
          <div className="flex gap-3 pt-2">
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Item'}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>Cancel</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
