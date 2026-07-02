'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, Btn, Input, PageHeader, Table, TR, TD, Badge, Modal, useToast } from '@/components/admin/ui'
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
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast, ToastContainer } = useToast()

  async function load() {
    const r = await fetch('/api/admin/certifications')
    const d = await r.json()
    setCerts(Array.isArray(d) ? d : [])
  }
  useEffect(() => { load() }, [])

  const filtered = certs.filter((c) => {
    if (search && !c.nameEn.toLowerCase().includes(search.toLowerCase()) && !c.nameFa.includes(search) && !c.issuer.toLowerCase().includes(search.toLowerCase())) return false
    if (filterActive === 'active' && !c.active) return false
    if (filterActive === 'inactive' && c.active) return false
    return true
  })

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

      {/* Filter bar */}
      <div className="mb-4 rounded-xl border border-border bg-background p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-text-secondary mb-1.5">{isFA ? 'جستجو' : 'Search'}</label>
            <div className="relative">
              <span className={`absolute top-1/2 -translate-y-1/2 text-text-tertiary text-sm ${isFA ? 'right-3' : 'left-3'}`}>🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isFA ? 'نام یا صادرکننده...' : 'name or issuer...'}
                className={`w-full bg-background border border-border rounded-lg py-2 text-sm text-white placeholder:text-text-disabled focus:outline-none focus:border-brand ${isFA ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
              />
            </div>
          </div>
          <div className="w-36">
            <label className="block text-xs text-text-secondary mb-1.5">{isFA ? 'وضعیت' : 'Status'}</label>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand"
            >
              <option value="">{isFA ? 'همه' : 'All'}</option>
              <option value="active">{isFA ? 'فعال' : 'Active'}</option>
              <option value="inactive">{isFA ? 'غیرفعال' : 'Inactive'}</option>
            </select>
          </div>
          <div className={`flex items-end gap-2 ${isFA ? 'mr-auto' : 'ml-auto'}`}>
            {(search || filterActive) && (
              <button onClick={() => { setSearch(''); setFilterActive('') }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-text-secondary border border-border hover:border-red-500 hover:text-red-400 transition-colors">
                ✕ {isFA ? 'پاک کردن' : 'Clear'}
              </button>
            )}
            <span className="text-xs text-text-tertiary py-2 px-1 whitespace-nowrap">
              {filtered.length} / {certs.length} {isFA ? 'گواهینامه' : 'certs'}
            </span>
          </div>
        </div>
      </div>

      <Card>
        <Table headers={isFA
          ? ['گواهینامه', 'صادرکننده', 'تاریخ صدور', 'تاریخ انقضا', 'وضعیت', 'عملیات']
          : ['Certification', 'Issuer', 'Issue Date', 'Expiry', 'Status', 'Actions']}>
          {filtered.map((c) => (
            <TR key={c.id}>
              <TD>
                <div className="flex items-center gap-3">
                  {c.badgeUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.badgeUrl} alt={c.nameEn} className="w-8 h-8 rounded object-contain" style={{ background: `${c.color}15` }} />
                  ) : (
                    <div className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold text-white" style={{ background: c.color }}>
                      {c.nameEn.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-white">{c.nameEn}</div>
                    <div className="text-xs text-text-tertiary">{c.nameFa}</div>
                  </div>
                </div>
              </TD>
              <TD>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                  <span className="text-text-primary">{c.issuer || '—'}</span>
                </span>
              </TD>
              <TD className="text-text-secondary text-sm">{c.issueDate || '—'}</TD>
              <TD className="text-text-secondary text-sm">{c.expiryDate || <span className="text-green-500 text-xs">{isFA ? 'بدون انقضا' : 'No expiry'}</span>}</TD>
              <TD><Badge color={c.active ? 'green' : 'slate'}>{c.active ? (isFA ? 'فعال' : 'Active') : (isFA ? 'غیرفعال' : 'Inactive')}</Badge></TD>
              <TD>
                <div className="flex gap-2">
                  <Btn size="sm" variant="secondary" onClick={() => { setEditing(c); setModal(true) }}>{t('edit')}</Btn>
                  <Btn size="sm" variant="secondary" onClick={() => toggle(c)}>{c.active ? '⏸' : '▶'}</Btn>
                  <Btn size="sm" variant="danger" onClick={() => del(c.id!)}>{t('delete')}</Btn>
                </div>
              </TD>
            </TR>
          ))}
          {filtered.length === 0 && (
            <TR><TD colSpan={6} className="text-center text-text-tertiary py-8">{isFA ? 'گواهینامه‌ای یافت نشد' : 'No certifications found'}</TD></TR>
          )}
        </Table>
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
                <div className="w-14 h-14 rounded-lg flex items-center justify-center text-sm font-bold text-white border border-border" style={{ background: editing.color }}>
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
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand"
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
