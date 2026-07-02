'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, Select, PageHeader, Table, TR, TD, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

type Item = { id?: number; title: string; type: 'document' | 'faq' | 'snippet' | 'url'; content: string; fileUrl: string; sourceUrl: string; tags: string; locale: string; active: boolean; priority: number }
const EMPTY: Item = { title: '', type: 'snippet', content: '', fileUrl: '', sourceUrl: '', tags: '', locale: 'both', active: true, priority: 0 }

export function AiKbManager() {
  const [items, setItems] = useState<Item[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Item>(EMPTY)
  const [saving, setSaving] = useState(false)
  const t = useT()
  const { toast, ToastContainer } = useToast()

  async function load() { const r = await fetch('/api/admin/ai-kb'); const d = await r.json(); setItems(Array.isArray(d) ? d : []) }
  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/ai-kb', { method: editing.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    setSaving(false)
    if (res.ok) { toast('Saved'); setModal(false); load() } else toast('Failed', 'error')
  }

  async function del(id: number) {
    if (!confirm('Delete?')) return
    await fetch('/api/admin/ai-kb', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast('Deleted'); load()
  }

  function set<K extends keyof Item>(k: K, v: Item[K]) { setEditing((e) => ({ ...e, [k]: v })) }
  const typeColor: Record<string, string> = { document: 'blue', faq: 'green', snippet: 'yellow', url: 'indigo' }

  return (
    <>
      <ToastContainer />
      <PageHeader
        title="AI Knowledge Base"
        subtitle="Manage knowledge items for the AI chatbot — documents, FAQs, snippets, and URLs"
        action={<Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>+ Add Knowledge Item</Btn>}
      />

      <Card>
        <Table headers={['Title', 'Type', 'Locale', 'Priority', 'Status', 'Actions']}>
          {items.map((item) => (
            <TR key={item.id}>
              <TD>
                <div className="font-medium text-white">{item.title}</div>
                {item.tags && <div className="text-xs text-text-disabled mt-0.5">{item.tags}</div>}
              </TD>
              <TD><Badge color={typeColor[item.type]}>{item.type}</Badge></TD>
              <TD className="text-text-tertiary">{item.locale}</TD>
              <TD className="text-text-tertiary">{item.priority}</TD>
              <TD><Badge color={item.active ? 'green' : 'slate'}>{item.active ? 'Active' : 'Disabled'}</Badge></TD>
              <TD>
                <div className="flex gap-2">
                  <Btn size="sm" variant="secondary" onClick={() => { setEditing(item); setModal(true) }}>Edit</Btn>
                  <Btn size="sm" variant="danger" onClick={() => del(item.id!)}>Del</Btn>
                </div>
              </TD>
            </TR>
          ))}
        </Table>
        {items.length === 0 && <div className="text-center py-12 text-text-disabled text-sm">No knowledge items yet. Add your first one to power the AI chatbot.</div>}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? 'Edit Knowledge Item' : 'New Knowledge Item'} size="lg">
        <div className="space-y-4">
          <Input label="Title *" value={editing.title} onChange={(v) => set('title', v)} placeholder="HBZ Professional Profile" />
          <div className="grid grid-cols-3 gap-4">
            <Select label="Type" value={editing.type} onChange={(v) => set('type', v as Item['type'])} options={[{ value: 'snippet', label: 'Snippet' }, { value: 'document', label: 'Document' }, { value: 'faq', label: 'FAQ' }, { value: 'url', label: 'URL' }]} />
            <Select label="Locale" value={editing.locale} onChange={(v) => set('locale', v)} options={[{ value: 'both', label: 'Both' }, { value: 'en', label: 'English' }, { value: 'fa', label: 'Persian' }]} />
            <Input label="Priority (higher = more important)" type="number" value={String(editing.priority)} onChange={(v) => set('priority', Number(v))} />
          </div>
          {(editing.type === 'snippet' || editing.type === 'faq' || editing.type === 'document') && (
            <Input label="Content" value={editing.content} onChange={(v) => set('content', v)} multiline rows={8} placeholder="Knowledge content that the AI can reference..." />
          )}
          {editing.type === 'url' && (
            <Input label="Source URL" value={editing.sourceUrl} onChange={(v) => set('sourceUrl', v)} placeholder="https://..." />
          )}
          {editing.type === 'document' && (
            <Input label="File URL (if uploaded)" value={editing.fileUrl} onChange={(v) => set('fileUrl', v)} placeholder="/uploads/knowledge/doc.pdf" />
          )}
          <Input label="Tags (comma-separated)" value={editing.tags} onChange={(v) => set('tags', v)} placeholder="profile, services, about" />
          <Select label="Status" value={editing.active ? 'true' : 'false'} onChange={(v) => set('active', v === 'true')} options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Disabled' }]} />
          <div className="flex gap-3">
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Item'}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>Cancel</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
