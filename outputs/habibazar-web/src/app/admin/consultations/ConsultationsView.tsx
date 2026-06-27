'use client'

import { useState, useEffect } from 'react'
import { Card, PageHeader, Table, TR, TD, Badge, Modal, Btn, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

type Consult = { id: number; name: string; email: string; phone: string; company: string; serviceInterest: string; projectDescription: string; budget: string; timeline: string; preferredDate: string; preferredTime: string; type: string; status: string; notes: string; createdAt: string }
const STATUS_COLOR: Record<string, string> = { new: 'yellow', scheduled: 'blue', completed: 'green', cancelled: 'red' }

export function ConsultationsView() {
  const t = useT()
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

  return (
    <>
      <ToastContainer />
      <PageHeader title={`${t('consultTitle')}${newCount > 0 ? ` (${newCount} ${t('statusNew')})` : ''}`} />

      <Card>
        <Table headers={[t('name'), t('email'), t('serviceInterest'), t('type'), t('budget'), t('status'), t('date'), t('actions')]}>
          {items.map((c) => (
            <TR key={c.id} onClick={() => setSelected(c)}>
              <TD><span className="font-medium text-white">{c.name}</span></TD>
              <TD className="text-slate-400">{c.email}</TD>
              <TD className="text-slate-400 max-w-28 truncate">{c.serviceInterest || '—'}</TD>
              <TD><Badge>{c.type}</Badge></TD>
              <TD className="text-slate-500">{c.budget || '—'}</TD>
              <TD><Badge color={STATUS_COLOR[c.status]}>{statusLabel[c.status] || c.status}</Badge></TD>
              <TD className="text-xs text-slate-600">{new Date(c.createdAt).toLocaleDateString()}</TD>
              <TD onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <Btn size="sm" variant="danger" onClick={() => del(c.id)}>{t('delete')}</Btn>
              </TD>
            </TR>
          ))}
        </Table>
        {items.length === 0 && <div className="text-center py-12 text-slate-600">{t('noData')}</div>}
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={t('consultTitle')} size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-slate-500 text-xs mb-1">{t('name')}</p><p className="text-white font-medium">{selected.name}</p></div>
              <div><p className="text-slate-500 text-xs mb-1">{t('email')}</p><p className="text-blue-400">{selected.email}</p></div>
              <div><p className="text-slate-500 text-xs mb-1">{t('phone')}</p><p className="text-slate-300">{selected.phone || '—'}</p></div>
              <div><p className="text-slate-500 text-xs mb-1">{t('company')}</p><p className="text-slate-300">{selected.company || '—'}</p></div>
              <div><p className="text-slate-500 text-xs mb-1">{t('serviceInterest')}</p><p className="text-slate-300">{selected.serviceInterest || '—'}</p></div>
              <div><p className="text-slate-500 text-xs mb-1">{t('budget')}</p><p className="text-slate-300">{selected.budget || '—'}</p></div>
              <div><p className="text-slate-500 text-xs mb-1">{t('timeline')}</p><p className="text-slate-300">{selected.timeline || '—'}</p></div>
              <div><p className="text-slate-500 text-xs mb-1">{t('prefDate')}</p><p className="text-slate-300">{selected.preferredDate} {selected.preferredTime}</p></div>
            </div>
            {selected.projectDescription && (
              <div><p className="text-slate-500 text-xs mb-1">{t('projectDesc')}</p>
              <div className="bg-[#0c0c14] rounded-lg p-3 text-sm text-slate-300">{selected.projectDescription}</div></div>
            )}
            <div>
              <p className="text-slate-500 text-xs mb-2">{t('updateStatus')}</p>
              <div className="flex gap-2 flex-wrap">
                {['new', 'scheduled', 'completed', 'cancelled'].map((s) => (
                  <Btn key={s} size="sm" variant={selected.status === s ? 'primary' : 'secondary'} onClick={() => updateStatus(selected.id, s)}>
                    {statusLabel[s] || s}
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
