'use client'

import { useState, useEffect } from 'react'
import { Card, PageHeader, Badge, Modal, Btn, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

type Consult = { id: number; name: string; email: string; phone: string; company: string; serviceInterest: string; projectDescription: string; budget: string; timeline: string; preferredDate: string; preferredTime: string; type: string; status: string; notes: string; createdAt: string }
const STATUS_COLOR: Record<string, string> = { new: 'yellow', scheduled: 'blue', completed: 'green', cancelled: 'red' }

export function ConsultationsView() {
  const t = useT()
  const locale = useAdminLocale()
  const [items, setItems] = useState<Consult[]>([])
  const [selected, setSelected] = useState<Consult | null>(null)
  const { toast, ToastContainer } = useToast()

  async function load() {
    const r = await fetch('/api/admin/consultations')
    const d = await r.json(); setItems(Array.isArray(d) ? d : [])
  }
  useEffect(() => { load() }, [])

  async function updateStatus(id: number, status: string) {
    await fetch('/api/admin/consultations', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    toast(t('saved')); if (selected?.id === id) setSelected({ ...selected, status }); load()
  }

  async function del(id: number) {
    if (!confirm(t('confirmDel'))) return
    await fetch('/api/admin/consultations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast(t('deleted')); setSelected(null); load()
  }

  const newCount = items.filter((i) => i.status === 'new').length
  const statusLabel: Record<string, string> = { new: t('statusNew'), scheduled: t('scheduled'), completed: t('completed'), cancelled: t('cancelled') }

  const columns: Column<Consult>[] = [
    { key: 'name', labelEn: 'Name', labelFa: t('name'), render: c => <span className="font-medium text-white">{c.name}</span> },
    { key: 'email', labelEn: 'Email', labelFa: t('email'), render: c => <span className="text-text-secondary">{c.email}</span> },
    { key: 'serviceInterest', labelEn: 'Service', labelFa: t('serviceInterest'), render: c => <span className="text-text-secondary">{c.serviceInterest || '—'}</span> },
    { key: 'type', labelEn: 'Type', labelFa: t('type'), type: 'enum', render: c => <Badge>{c.type}</Badge> },
    { key: 'budget', labelEn: 'Budget', labelFa: t('budget'), render: c => <span className="text-text-tertiary">{c.budget || '—'}</span> },
    { key: 'status', labelEn: 'Status', labelFa: t('status'), type: 'enum', options: ['new', 'scheduled', 'completed', 'cancelled'].map(s => ({ value: s, labelEn: s, labelFa: s })), render: c => <Badge color={STATUS_COLOR[c.status]}>{statusLabel[c.status] || c.status}</Badge> },
    { key: 'createdAt', labelEn: 'Date', labelFa: t('date'), type: 'date', render: c => <span className="text-xs text-text-disabled">{new Date(c.createdAt).toLocaleDateString()}</span> },
  ]
  const rowActions: RowAction<Consult>[] = [{ id: 'del', labelEn: 'Delete', labelFa: t('delete'), icon: '🗑', danger: true, onClick: c => del(c.id) }]

  return (
    <>
      <ToastContainer />
      <PageHeader title={`${t('consultTitle')}${newCount > 0 ? ` (${newCount} ${t('statusNew')})` : ''}`} />

      <Card>
        <DataTable tableId="consultations" columns={columns} rows={items} locale={locale} rowKey={c => String(c.id)} onRowClick={c => setSelected(c)} rowActions={rowActions} exportName="consultations" emptyLabel={t('noData')} />
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={t('consultTitle')} size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-text-tertiary text-xs mb-1">{t('name')}</p><p className="text-white font-medium">{selected.name}</p></div>
              <div><p className="text-text-tertiary text-xs mb-1">{t('email')}</p><p className="text-blue-400">{selected.email}</p></div>
              <div><p className="text-text-tertiary text-xs mb-1">{t('phone')}</p><p className="text-text-primary">{selected.phone || '—'}</p></div>
              <div><p className="text-text-tertiary text-xs mb-1">{t('company')}</p><p className="text-text-primary">{selected.company || '—'}</p></div>
              <div><p className="text-text-tertiary text-xs mb-1">{t('serviceInterest')}</p><p className="text-text-primary">{selected.serviceInterest || '—'}</p></div>
              <div><p className="text-text-tertiary text-xs mb-1">{t('budget')}</p><p className="text-text-primary">{selected.budget || '—'}</p></div>
              <div><p className="text-text-tertiary text-xs mb-1">{t('timeline')}</p><p className="text-text-primary">{selected.timeline || '—'}</p></div>
              <div><p className="text-text-tertiary text-xs mb-1">{t('prefDate')}</p><p className="text-text-primary">{selected.preferredDate} {selected.preferredTime}</p></div>
            </div>
            {selected.projectDescription && (
              <div><p className="text-text-tertiary text-xs mb-1">{t('projectDesc')}</p>
              <div className="bg-background rounded-lg p-3 text-sm text-text-primary">{selected.projectDescription}</div></div>
            )}
            <div>
              <p className="text-text-tertiary text-xs mb-2">{t('updateStatus')}</p>
              <div className="flex gap-2 flex-wrap">
                {['new', 'scheduled', 'completed', 'cancelled'].map((s) => (
                  <Btn key={s} size="sm" variant={selected.status === s ? 'primary' : 'secondary'} onClick={() => updateStatus(selected.id, s)}>
                    {statusLabel[s] || s}
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
