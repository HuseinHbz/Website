'use client'

import { useState, useEffect } from 'react'
import { Card, PageHeader, Badge, Modal, Btn, Select, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { formatDateTime } from '@/lib/admin/datetime'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

type Contact = { id: number; name: string; email: string; phone: string; company: string; subject: string; message: string; status: string; locale: string; createdAt: string }
const STATUS_COLOR: Record<string, string> = { new: 'yellow', read: 'blue', replied: 'green', archived: 'slate' }

export function ContactsView() {
  const t = useT()
  const locale = useAdminLocale()
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

  const columns: Column<Contact>[] = [
    { key: 'name', labelEn: 'Name', labelFa: t('name'), render: c => <span className="font-medium text-text-primary">{c.name}</span> },
    { key: 'email', labelEn: 'Email', labelFa: t('email'), render: c => <span className="text-text-secondary">{c.email}</span> },
    { key: 'company', labelEn: 'Company', labelFa: t('company'), render: c => <span className="text-text-tertiary">{c.company || '—'}</span> },
    { key: 'subject', labelEn: 'Subject', labelFa: t('subject'), render: c => <span className="text-text-secondary">{c.subject || '—'}</span> },
    { key: 'status', labelEn: 'Status', labelFa: t('status'), type: 'enum', options: ['new', 'read', 'replied', 'archived'].map(s => ({ value: s, labelEn: s, labelFa: s })), render: c => <Badge color={STATUS_COLOR[c.status]}>{t(`status${c.status.charAt(0).toUpperCase() + c.status.slice(1)}`) || c.status}</Badge> },
    { key: 'createdAt', labelEn: 'Date', labelFa: t('date'), type: 'date', render: c => <span className="text-xs text-text-disabled">{formatDateTime(c.createdAt, locale)}</span> },
  ]
  const rowActions: RowAction<Contact>[] = [
    { id: 'del', labelEn: 'Delete', labelFa: t('delete'), icon: '🗑', danger: true, onClick: c => del(c.id) },
  ]

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
        <DataTable tableId="contacts" columns={columns} rows={filtered} locale={locale} rowKey={c => String(c.id)} onRowClick={c => setSelected(c)} rowActions={rowActions} exportName="contacts" emptyLabel={t('noContacts')} />
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={t('contactsTitle')} size="md">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-text-tertiary text-xs mb-1">{t('name')}</p><p className="text-text-primary font-medium">{selected.name}</p></div>
              <div><p className="text-text-tertiary text-xs mb-1">{t('email')}</p><p className="text-blue-400">{selected.email}</p></div>
              <div><p className="text-text-tertiary text-xs mb-1">{t('phone')}</p><p className="text-text-primary">{selected.phone || '—'}</p></div>
              <div><p className="text-text-tertiary text-xs mb-1">{t('company')}</p><p className="text-text-primary">{selected.company || '—'}</p></div>
              <div><p className="text-text-tertiary text-xs mb-1">{t('subject')}</p><p className="text-text-primary">{selected.subject || '—'}</p></div>
              <div><p className="text-text-tertiary text-xs mb-1">{t('date')}</p><p className="text-text-primary">{formatDateTime(selected.createdAt, locale)}</p></div>
            </div>
            <div>
              <p className="text-text-tertiary text-xs mb-1">{t('message')}</p>
              <div className="bg-background rounded-lg p-3 text-sm text-text-primary whitespace-pre-wrap">{selected.message}</div>
            </div>
            <div>
              <p className="text-text-tertiary text-xs mb-2">{t('updateStatus')}</p>
              <div className="flex gap-2 flex-wrap">
                {['new', 'read', 'replied', 'archived'].map((s) => (
                  <Btn key={s} size="sm" variant={selected.status === s ? 'primary' : 'secondary'} onClick={() => updateStatus(selected.id, s)}>
                    {t(`status${s.charAt(0).toUpperCase() + s.slice(1)}`) || s}
                  </Btn>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t border-border">
              <a href={`mailto:${selected.email}`} className="bg-brand hover:bg-brand text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
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
