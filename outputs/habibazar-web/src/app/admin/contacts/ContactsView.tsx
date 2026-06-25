'use client'

import { useState, useEffect } from 'react'
import { Card, PageHeader, Table, TR, TD, Badge, Modal, Btn, Select, useToast } from '@/components/admin/ui'

type Contact = { id: number; name: string; email: string; phone: string; company: string; subject: string; message: string; status: string; locale: string; createdAt: string }
const STATUS_COLOR: Record<string, string> = { new: 'yellow', read: 'blue', replied: 'green', archived: 'slate' }

export function ContactsView() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selected, setSelected] = useState<Contact | null>(null)
  const [filter, setFilter] = useState('all')
  const { toast, ToastContainer } = useToast()

  async function load() { const r = await fetch('/api/admin/contacts'); setContacts(await r.json()) }
  useEffect(() => { load() }, [])

  async function updateStatus(id: number, status: string) {
    await fetch('/api/admin/contacts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    toast('Status updated')
    if (selected?.id === id) setSelected({ ...selected, status })
    load()
  }

  async function del(id: number) {
    if (!confirm('Delete this contact request?')) return
    await fetch('/api/admin/contacts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast('Deleted'); setSelected(null); load()
  }

  const filtered = filter === 'all' ? contacts : contacts.filter((c) => c.status === filter)
  const newCount = contacts.filter((c) => c.status === 'new').length

  return (
    <>
      <ToastContainer />
      <PageHeader
        title={`Contact Requests ${newCount > 0 ? `(${newCount} new)` : ''}`}
        action={
          <Select value={filter} onChange={setFilter} options={[
            { value: 'all', label: 'All' },
            { value: 'new', label: 'New' },
            { value: 'read', label: 'Read' },
            { value: 'replied', label: 'Replied' },
            { value: 'archived', label: 'Archived' },
          ]} />
        }
      />

      <Card>
        <Table headers={['Name', 'Email', 'Company', 'Subject', 'Status', 'Date', 'Actions']}>
          {filtered.map((c) => (
            <TR key={c.id} onClick={() => setSelected(c)}>
              <TD><span className="font-medium text-white">{c.name}</span></TD>
              <TD className="text-slate-400">{c.email}</TD>
              <TD className="text-slate-500">{c.company || '—'}</TD>
              <TD className="text-slate-400 max-w-32 truncate">{c.subject || '—'}</TD>
              <TD><Badge color={STATUS_COLOR[c.status]}>{c.status}</Badge></TD>
              <TD className="text-xs text-slate-600">{new Date(c.createdAt).toLocaleDateString()}</TD>
              <TD onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <Btn size="sm" variant="danger" onClick={() => del(c.id)}>Del</Btn>
              </TD>
            </TR>
          ))}
        </Table>
        {filtered.length === 0 && <div className="text-center py-12 text-slate-600">No contact requests</div>}
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Contact Request" size="md">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-slate-500 text-xs mb-1">Name</p><p className="text-white font-medium">{selected.name}</p></div>
              <div><p className="text-slate-500 text-xs mb-1">Email</p><p className="text-blue-400">{selected.email}</p></div>
              <div><p className="text-slate-500 text-xs mb-1">Phone</p><p className="text-slate-300">{selected.phone || '—'}</p></div>
              <div><p className="text-slate-500 text-xs mb-1">Company</p><p className="text-slate-300">{selected.company || '—'}</p></div>
              <div><p className="text-slate-500 text-xs mb-1">Subject</p><p className="text-slate-300">{selected.subject || '—'}</p></div>
              <div><p className="text-slate-500 text-xs mb-1">Date</p><p className="text-slate-300">{new Date(selected.createdAt).toLocaleString()}</p></div>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Message</p>
              <div className="bg-[#0c0c14] rounded-lg p-3 text-sm text-slate-300 whitespace-pre-wrap">{selected.message}</div>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-2">Update Status</p>
              <div className="flex gap-2 flex-wrap">
                {['new', 'read', 'replied', 'archived'].map((s) => (
                  <Btn
                    key={s}
                    size="sm"
                    variant={selected.status === s ? 'primary' : 'secondary'}
                    onClick={() => updateStatus(selected.id, s)}
                  >
                    {s}
                  </Btn>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t border-[#1e1e2e]">
              <a href={`mailto:${selected.email}`} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                Reply via Email
              </a>
              <Btn size="sm" variant="danger" onClick={() => del(selected.id)}>Delete</Btn>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
