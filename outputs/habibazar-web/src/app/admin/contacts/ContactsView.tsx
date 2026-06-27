'use client'

import { useState, useEffect } from 'react'
import { Card, PageHeader, Table, TR, TD, Badge, Modal, Btn, Select, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

type Contact = { id: number; name: string; email: string; phone: string; company: string; subject: string; message: string; status: string; locale: string; createdAt: string }
const STATUS_COLOR: Record<string, string> = { new: 'yellow', read: 'blue', replied: 'green', archived: 'slate' }

export function ContactsView() {
  const t = useT()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selected, setSelected] = useState<Contact | null>(null)
  const [filter, setFilter] = useState('all')
  const { toast, ToastContainer } = useToast()

  async function load() {
    const r = await fetch('/api/admin/contacts')
    const d = await r.json(); setContacts(Array.isArray(d) ? d : [])
  }
  useEffect(() => { load() }, [])

  async function updateStatus(id: number, status: string) {
    await fetch('/api/admin/contacts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    toast(t('saved'))
    if (selected?.id === id) setSelected({ ...selected, status })
    load()
  }

  async function del(id: number) {
    if (!confirm(t('confirmDel'))) return
    await fetch('/api/admin/contacts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast(t('deleted')); setSelected(null); load()
  }

  const filtered = filter === 'all' ? contacts : contacts.filter((c) => c.status === filter)
  const newCount = contacts.filter((c) => c.status === 'new').length

  return (
    <>
      <ToastContainer />
      <PageHeader
        title={`${t('contactsTitle')}${newCount > 0 ? ` (${newCount} ${t('statusNew')})` : ''}`}
        action={
          <Select value={filter} onChange={setFilter} options={[
            { value: 'all', label: t('all') },
            { value: 'new', label: t('statusNew') },
            { value: 'read', label: t('statusRead') },
            { value: 'replied', label: t('statusReplied') },
            { value: 'archived', label: t('statusArchived') },
          ]} />
        }
      />

      <Card>
        <Table headers={[t('name'), t('email'), t('company'), t('subject'), t('status'), t('date'), t('actions')]}>
          {filtered.map((c) => (
            <TR key={c.id} onClick={() => setSelected(c)}>
              <TD><span className="font-medium text-white">{c.name}</span></TD>
              <TD className="text-slate-400">{c.email}</TD>
              <TD className="text-slate-500">{c.company || '—'}</TD>
              <TD className="text-slate-400 max-w-32 truncate">{c.subject || '—'}</TD>
              <TD><Badge color={STATUS_COLOR[c.status]}>{t(`status${c.status.charAt(0).toUpperCase() + c.status.slice(1)}`) || c.status}</Badge></TD>
              <TD className="text-xs text-slate-600">{new Date(c.createdAt).toLocaleDateString()}</TD>
              <TD onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <Btn size="sm" variant="danger" onClick={() => del(c.id)}>{t('delete')}</Btn>
              </TD>
            </TR>
          ))}
        </Table>
        {filtered.length === 0 && <div className="text-center py-12 text-slate-600">{t('noContacts')}</div>}
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={t('contactsTitle')} size="md">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-slate-500 text-xs mb-1">{t('name')}</p><p className="text-white font-medium">{selected.name}</p></div>
              <div><p className="text-slate-500 text-xs mb-1">{t('email')}</p><p className="text-blue-400">{selected.email}</p></div>
              <div><p className="text-slate-500 text-xs mb-1">{t('phone')}</p><p className="text-slate-300">{selected.phone || '—'}</p></div>
              <div><p className="text-slate-500 text-xs mb-1">{t('company')}</p><p className="text-slate-300">{selected.company || '—'}</p></div>
              <div><p className="text-slate-500 text-xs mb-1">{t('subject')}</p><p className="text-slate-300">{selected.subject || '—'}</p></div>
              <div><p className="text-slate-500 text-xs mb-1">{t('date')}</p><p className="text-slate-300">{new Date(selected.createdAt).toLocaleString()}</p></div>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">{t('message')}</p>
              <div className="bg-[#0c0c14] rounded-lg p-3 text-sm text-slate-300 whitespace-pre-wrap">{selected.message}</div>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-2">{t('updateStatus')}</p>
              <div className="flex gap-2 flex-wrap">
                {['new', 'read', 'replied', 'archived'].map((s) => (
                  <Btn key={s} size="sm" variant={selected.status === s ? 'primary' : 'secondary'} onClick={() => updateStatus(selected.id, s)}>
                    {t(`status${s.charAt(0).toUpperCase() + s.slice(1)}`) || s}
                  </Btn>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t border-[#1e1e2e]">
              <a href={`mailto:${selected.email}`} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                {t('replyByEmail')}
              </a>
              <Btn size="sm" variant="danger" onClick={() => del(selected.id)}>{t('delete')}</Btn>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
