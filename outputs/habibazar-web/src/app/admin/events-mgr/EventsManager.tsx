'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, Badge, Input, Select, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

type Event = { id: number; slug: string; titleEn: string; type: string; status: string; format: string; startDate: string; registrationsCount: number; isFree: boolean; featured: boolean }

const TYPES = ['webinar', 'conference', 'meetup', 'workshop', 'training', 'announcement']
const STATUSES = ['upcoming', 'live', 'completed', 'cancelled']
const FORMATS = ['online', 'in_person', 'hybrid']
const STATUS_COLORS: Record<string, string> = { upcoming: 'blue', live: 'green', completed: 'slate', cancelled: 'red' }

export function EventsManager() {
  const t = useT()
  const locale = useAdminLocale()
  const [eventList, setEventList] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Event & { descriptionEn: string; meetingUrl: string }> | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() { setLoading(true); const r = await fetch('/api/admin/events'); setEventList(await r.json()); setLoading(false) }
  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return; setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/events', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    if (res.ok) { toast(t('saved'), 'success'); setEditing(null); load() } else toast(t('failed'), 'error')
    setSaving(false)
  }

  const columns: Column<Event>[] = [
    { key: 'titleEn', labelEn: 'Event', labelFa: t('colEvent'), render: e => <div><div className="font-medium text-white">{e.titleEn}</div><div className="text-xs text-text-tertiary">{e.slug}</div></div> },
    { key: 'type', labelEn: 'Type', labelFa: t('type'), type: 'enum', options: TYPES.map(tp => ({ value: tp, labelEn: tp, labelFa: tp })), render: e => <span className="text-text-secondary">{e.type}</span> },
    { key: 'startDate', labelEn: 'Date', labelFa: t('date'), type: 'date', render: e => <span className="text-text-secondary text-xs">{e.startDate}</span> },
    { key: 'format', labelEn: 'Format', labelFa: t('format'), type: 'enum', options: FORMATS.map(fm => ({ value: fm, labelEn: fm, labelFa: fm })), render: e => <span className="text-text-secondary">{e.format}</span> },
    { key: 'status', labelEn: 'Status', labelFa: t('status'), type: 'enum', options: STATUSES.map(st => ({ value: st, labelEn: st, labelFa: st })), render: e => <Badge color={STATUS_COLORS[e.status] || 'slate'}>{e.status}</Badge> },
    { key: 'registrationsCount', labelEn: 'Registrations', labelFa: t('colRegistrations'), type: 'number', numeric: true },
  ]
  const rowActions: RowAction<Event>[] = [{ id: 'edit', labelEn: 'Edit', labelFa: t('edit'), icon: '✎', onClick: e => setEditing(e) }]

  return (
    <div>
      <ToastContainer />
      <PageHeader title={t('eventsTitle')} subtitle={`${eventList.length} events · ${eventList.filter(e => e.status === 'upcoming').length} upcoming`}
        action={<Btn onClick={() => setEditing({ type: 'webinar', status: 'upcoming', format: 'online', isFree: true, startDate: new Date().toISOString().slice(0, 10), registrationsCount: 0 })}>{t('addEvent')}</Btn>} />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4">{editing.id ? t('editEvent') : t('addEvent')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Input label="Slug" value={editing.slug || ''} onChange={v => setEditing(e => ({ ...e, slug: v }))} /></div>
              <div className="col-span-2"><Input label={t('titleEn')} value={editing.titleEn || ''} onChange={v => setEditing(e => ({ ...e, titleEn: v }))} /></div>
              <Select label={t('type')} value={editing.type || 'webinar'} onChange={v => setEditing(e => ({ ...e, type: v }))} options={TYPES.map(tp => ({ value: tp, label: tp }))} />
              <Select label={t('status')} value={editing.status || 'upcoming'} onChange={v => setEditing(e => ({ ...e, status: v }))} options={STATUSES.map(st => ({ value: st, label: st }))} />
              <Select label={t('format')} value={editing.format || 'online'} onChange={v => setEditing(e => ({ ...e, format: v }))} options={FORMATS.map(fm => ({ value: fm, label: fm }))} />
              <Input label={t('startDate')} value={editing.startDate || ''} onChange={v => setEditing(e => ({ ...e, startDate: v }))} />
              <div className="col-span-2"><Input label={t('meetingUrl')} value={editing.meetingUrl || ''} onChange={v => setEditing(e => ({ ...e, meetingUrl: v }))} /></div>
              <div className="col-span-2">
                <label className="text-xs text-text-secondary mb-1 block">{t('description')}</label>
                <textarea value={editing.descriptionEn || ''} onChange={e2 => setEditing(e => ({ ...e, descriptionEn: e2.target.value }))} rows={3}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white outline-none" />
              </div>
              <div className="flex items-center gap-4 col-span-2 pt-1">
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer"><input type="checkbox" checked={!!editing.isFree} onChange={e2 => setEditing(e => ({ ...e, isFree: e2.target.checked }))} /> {t('free')}</label>
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer"><input type="checkbox" checked={!!editing.featured} onChange={e2 => setEditing(e => ({ ...e, featured: e2.target.checked }))} /> {t('featuredLabel')}</label>
              </div>
            </div>
            <div className="flex gap-3 mt-6"><Btn onClick={save} disabled={saving}>{saving ? t('saving') : t('save')}</Btn><Btn variant="ghost" onClick={() => setEditing(null)}>{t('cancel')}</Btn></div>
          </div>
        </div>
      )}

      <Card>
        <DataTable
          tableId="events"
          columns={columns}
          rows={eventList}
          locale={locale}
          loading={loading}
          rowKey={e => String(e.id)}
          rowActions={rowActions}
          exportName="events"
          emptyLabel="No events yet"
          quickCreate={{ labelEn: 'Add Event', labelFa: t('addEvent'), onClick: () => setEditing({ type: 'webinar', status: 'upcoming', format: 'online', isFree: true, startDate: new Date().toISOString().slice(0, 10), registrationsCount: 0 }) }}
        />
      </Card>
    </div>
  )
}
