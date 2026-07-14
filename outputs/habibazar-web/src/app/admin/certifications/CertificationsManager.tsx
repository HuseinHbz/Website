'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, Btn, Input, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'
import { useT, useAdminLocale } from '@/lib/admin/locale'

type Cert = {
  id?: number
  nameEn: string; nameFa: string; issuer: string
  issueDate: string; expiryDate: string
  credentialId: string; credentialUrl: string; badgeUrl: string
  color: string; sortOrder: number; active: boolean
}

const EMPTY: Cert = {
  nameEn: '', nameFa: '', issuer: '', issueDate: '', expiryDate: '',
  credentialId: '', credentialUrl: '', badgeUrl: '',
  color: '#6366f1', sortOrder: 0, active: true,
}

export function CertificationsManager() {
  const t = useT()
  const locale = useAdminLocale()
  const isFA = locale === 'fa'
  const [certs, setCerts] = useState<Cert[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Cert>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast, ToastContainer } = useToast()

  async function load() {
    const r = await fetch('/api/admin/certifications')
    const d = await r.json()
    setCerts(Array.isArray(d) ? d : [])
  }
  useEffect(() => { load() }, [])

  function set<K extends keyof Cert>(k: K, v: Cert[K]) { setEditing((e) => ({ ...e, [k]: v })) }

  async function save() {
    setSaving(true)
    const { id, ...body } = editing as Cert & { id?: number }
    const method = id ? 'PUT' : 'POST'
    const payload = id ? { id, ...body } : body
    const res = await fetch('/api/admin/certifications', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setSaving(false)
    if (res.ok) { toast(t('saved')); setModal(false); load() } else {
      const err = await res.json().catch(() => ({}))
      toast(err.error || t('failed'), 'error')
    }
  }

  async function del(id: number) {
    if (!confirm(t('confirmDel'))) return
    await fetch('/api/admin/certifications', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast(t('deleted')); load()
  }

  async function toggle(c: Cert) {
    await fetch('/api/admin/certifications', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, active: !c.active }) })
    toast(t('saved')); load()
  }

  async function uploadBadge(file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('folder', 'certifications')
    fd.append('alt', editing.nameEn || 'certification badge')
    const res = await fetch('/api/admin/media', { method: 'POST', body: fd })
    setUploading(false)
    if (res.ok) { const d = await res.json(); set('badgeUrl', d.url); toast(t('saved')) }
    else toast(t('failed'), 'error')
  }

  return (
    <>
      <ToastContainer />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadBadge(e.target.files[0]) }} />

      <PageHeader
        title={isFA ? 'گواهینامه‌ها' : 'Certifications'}
        subtitle={isFA ? 'مدیریت گواهینامه‌های حرفه‌ای' : 'Manage professional certifications'}
        action={<Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>{isFA ? '+ گواهینامه جدید' : '+ New Cert'}</Btn>}
      />

      <Card>
        <DataTable
          tableId="certifications"
          columns={[
            { key: 'nameEn', labelEn: 'Certification', labelFa: 'گواهینامه', render: c => <div className="flex items-center gap-3">{c.badgeUrl ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={c.badgeUrl} alt={c.nameEn} className="w-8 h-8 rounded object-contain" style={{ background: `${c.color}15` }} />) : (<div className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold text-text-primary" style={{ background: c.color }}>{c.nameEn.slice(0, 2).toUpperCase()}</div>)}<div><div className="font-medium text-text-primary">{c.nameEn}</div><div className="text-xs text-text-tertiary">{c.nameFa}</div></div></div> },
            { key: 'issuer', labelEn: 'Issuer', labelFa: 'صادرکننده', type: 'enum', render: c => <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: c.color }} /><span className="text-text-primary">{c.issuer || '—'}</span></span> },
            { key: 'issueDate', labelEn: 'Issue Date', labelFa: 'تاریخ صدور', type: 'date', render: c => <span className="text-text-secondary text-sm">{c.issueDate || '—'}</span> },
            { key: 'expiryDate', labelEn: 'Expiry', labelFa: 'تاریخ انقضا', type: 'date', render: c => <span className="text-text-secondary text-sm">{c.expiryDate || <span className="text-green-500 text-xs">{isFA ? 'بدون انقضا' : 'No expiry'}</span>}</span> },
            { key: 'active', labelEn: 'Status', labelFa: 'وضعیت', type: 'boolean', value: c => c.active, render: c => <Badge color={c.active ? 'green' : 'slate'}>{c.active ? (isFA ? 'فعال' : 'Active') : (isFA ? 'غیرفعال' : 'Inactive')}</Badge> },
          ] as Column<Cert>[]}
          rows={certs}
          locale={isFA ? 'fa' : 'en'}
          rowKey={c => String(c.id)}
          rowActions={[
            { id: 'edit', labelEn: 'Edit', labelFa: t('edit'), icon: '✎', onClick: c => { setEditing(c); setModal(true) } },
            { id: 'toggle', labelEn: 'Toggle', labelFa: 'وضعیت', icon: '⇄', onClick: c => toggle(c) },
            { id: 'del', labelEn: 'Delete', labelFa: t('delete'), icon: '🗑', danger: true, onClick: c => del(c.id!) },
          ] as RowAction<Cert>[]}
          exportName="certifications"
          emptyLabel={isFA ? 'گواهینامه‌ای یافت نشد' : 'No certifications found'}
        />
      </Card>

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? (isFA ? 'ویرایش گواهینامه' : 'Edit Certification') : (isFA ? 'گواهینامه جدید' : 'New Certification')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={isFA ? 'نام انگلیسی *' : 'Name (EN) *'} value={editing.nameEn} onChange={(v) => set('nameEn', v)} placeholder="Cisco CCNA" />
            <Input label={isFA ? 'نام فارسی *' : 'Name (FA) *'} value={editing.nameFa} onChange={(v) => set('nameFa', v)} placeholder="سیسکو CCNA" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={isFA ? 'صادرکننده' : 'Issuer'} value={editing.issuer} onChange={(v) => set('issuer', v)} placeholder="Cisco" />
            <Input label={isFA ? 'کد گواهینامه' : 'Credential ID'} value={editing.credentialId} onChange={(v) => set('credentialId', v)} placeholder="CSCO-12345678" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={isFA ? 'تاریخ صدور' : 'Issue Date'} value={editing.issueDate} onChange={(v) => set('issueDate', v)} placeholder="Jan 2024" />
            <Input label={isFA ? 'تاریخ انقضا' : 'Expiry Date'} value={editing.expiryDate} onChange={(v) => set('expiryDate', v)} placeholder="Jan 2027 (leave empty if no expiry)" />
          </div>
          <Input label={isFA ? 'لینک تأیید گواهینامه' : 'Credential URL'} value={editing.credentialUrl} onChange={(v) => set('credentialUrl', v)} placeholder="https://www.credly.com/badges/..." />

          {/* Badge image */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-text-secondary">{isFA ? 'تصویر بج / لوگو' : 'Badge / Logo Image'}</p>
            <div className="flex items-center gap-4">
              {editing.badgeUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={editing.badgeUrl} alt="badge" className="w-14 h-14 rounded-lg object-contain border border-border" style={{ background: `${editing.color}15` }} />
              ) : (
                <div className="w-14 h-14 rounded-lg flex items-center justify-center text-sm font-bold text-text-primary border border-border" style={{ background: editing.color }}>
                  {editing.nameEn.slice(0, 3).toUpperCase() || '?'}
                </div>
              )}
              <div className="flex-1 space-y-2">
                <Btn variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? '⏳' : '↑'} {isFA ? 'آپلود تصویر' : 'Upload Badge'}
                </Btn>
                <Input label={isFA ? 'یا URL تصویر' : 'Or image URL'} value={editing.badgeUrl} onChange={(v) => set('badgeUrl', v)} placeholder="/uploads/certifications/cisco.png" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input label={isFA ? 'رنگ' : 'Color'} type="color" value={editing.color} onChange={(v) => set('color', v)} />
            <Input label={isFA ? 'ترتیب نمایش' : 'Sort Order'} type="number" value={String(editing.sortOrder)} onChange={(v) => set('sortOrder', Number(v))} />
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">{isFA ? 'وضعیت' : 'Status'}</label>
              <select
                value={editing.active ? 'true' : 'false'}
                onChange={(e) => set('active', e.target.value === 'true')}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand"
              >
                <option value="true">{isFA ? 'فعال' : 'Active'}</option>
                <option value="false">{isFA ? 'غیرفعال' : 'Inactive'}</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Btn onClick={save} disabled={saving}>{saving ? t('saving') : t('save')}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>{t('cancel')}</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
