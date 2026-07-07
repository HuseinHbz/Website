'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, Badge, Input, Select, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

type Credential = {
  id: number; type: string; nameEn: string; issuer: string | null;
  issueDate: string | null; expiryDate: string | null;
  credentialUrl: string | null; active: boolean; featured: boolean; sortOrder: number
}

const TYPES = ['certification', 'award', 'membership', 'badge', 'license', 'recognition']
const TYPE_ICONS: Record<string, string> = {
  certification: '🏅', award: '🏆', membership: '🎫',
  badge: '🔖', license: '📜', recognition: '⭐',
}
const TYPE_COLORS: Record<string, string> = {
  certification: 'blue', award: 'yellow', membership: 'green',
  badge: 'red', license: 'slate', recognition: 'yellow',
}

export function CredentialsManager() {
  const t = useT()
  const locale = useAdminLocale()
  const [items, setItems] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Credential & { nameFa: string; descriptionEn: string; credentialId: string; badgeUrl: string; color: string }> | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() {
    setLoading(true)
    const r = await fetch('/api/admin/credentials')
    setItems(await r.json())
    setLoading(false)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return
    setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/credentials', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    if (res.ok) { toast(t('saved'), 'success'); setEditing(null); load() } else toast(t('failed'), 'error')
    setSaving(false)
  }

  async function del(id: number) {
    if (!confirm(t('confirmDel'))) return
    await fetch('/api/admin/credentials', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast(t('deleted'), 'success'); load()
  }

  const columns: Column<Credential>[] = [
    { key: 'nameEn', labelEn: 'Credential', labelFa: t('colCredential'), render: item => <span className="font-medium text-white">{item.nameEn}</span> },
    { key: 'type', labelEn: 'Type', labelFa: t('type'), type: 'enum', options: TYPES.map(tp => ({ value: tp, labelEn: tp, labelFa: tp })), render: item => <Badge color={TYPE_COLORS[item.type] || 'slate'}>{TYPE_ICONS[item.type]} {item.type}</Badge> },
    { key: 'issuer', labelEn: 'Issuer', labelFa: t('colIssuer'), render: item => <span className="text-text-secondary">{item.issuer || '—'}</span> },
    { key: 'issueDate', labelEn: 'Issued', labelFa: t('colIssueDate'), type: 'date', render: item => <span className="text-text-secondary text-xs">{item.issueDate || '—'}</span> },
    { key: 'expiryDate', labelEn: 'Expiry', labelFa: t('colExpiry'), type: 'date', render: item => <span className="text-text-secondary text-xs">{item.expiryDate || '∞'}</span> },
    { key: 'active', labelEn: 'Status', labelFa: t('status'), type: 'boolean', value: item => item.active, render: item => <Badge color={item.active ? 'green' : 'slate'}>{item.active ? t('active') : t('inactive')}</Badge> },
  ]
  const rowActions: RowAction<Credential>[] = [
    { id: 'edit', labelEn: 'Edit', labelFa: t('edit'), icon: '✎', onClick: item => setEditing(item) },
    { id: 'del', labelEn: 'Delete', labelFa: t('del'), icon: '🗑', danger: true, onClick: item => del(item.id) },
  ]

  return (
    <div>
      <ToastContainer />
      <PageHeader
        title={t('credentialsTitle')}
        subtitle={`${items.length} ${t('credentialsSub')}`}
        action={<Btn onClick={() => setEditing({ type: 'certification', active: true, featured: false, sortOrder: items.length + 1 })}>{t('addCredential')}</Btn>}
      />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-2xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4">{editing.id ? t('editCredential') : t('newCredential')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <Select label={t('type')} value={editing.type || 'certification'} onChange={v => setEditing(e => ({ ...e, type: v }))} options={TYPES.map(t2 => ({ value: t2, label: `${TYPE_ICONS[t2]} ${t2}` }))} />
              <Input label={t('color')} value={editing.color || '#6366f1'} onChange={v => setEditing(e => ({ ...e, color: v }))} />
              <div className="col-span-2"><Input label={t('nameEn')} value={editing.nameEn || ''} onChange={v => setEditing(e => ({ ...e, nameEn: v }))} /></div>
              <div className="col-span-2"><Input label={t('nameFa')} value={editing.nameFa || ''} onChange={v => setEditing(e => ({ ...e, nameFa: v }))} /></div>
              <div className="col-span-2"><Input label={t('credIssuer')} value={editing.issuer || ''} onChange={v => setEditing(e => ({ ...e, issuer: v }))} /></div>
              <Input label={t('credIssueDate')} value={editing.issueDate || ''} onChange={v => setEditing(e => ({ ...e, issueDate: v }))} />
              <Input label={t('credExpiryDate')} value={editing.expiryDate || ''} onChange={v => setEditing(e => ({ ...e, expiryDate: v }))} />
              <Input label={t('credentialId')} value={editing.credentialId || ''} onChange={v => setEditing(e => ({ ...e, credentialId: v }))} />
              <Input label={t('credentialUrl')} value={editing.credentialUrl || ''} onChange={v => setEditing(e => ({ ...e, credentialUrl: v }))} />
              <div className="col-span-2"><Input label={t('badgeImgUrl')} value={editing.badgeUrl || ''} onChange={v => setEditing(e => ({ ...e, badgeUrl: v }))} /></div>
              <div className="col-span-2">
                <label className="text-xs text-text-secondary mb-1 block">{t('description')}</label>
                <textarea value={editing.descriptionEn || ''} onChange={e2 => setEditing(e => ({ ...e, descriptionEn: e2.target.value }))} rows={2}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white outline-none" />
              </div>
              <div className="col-span-2 flex gap-4 pt-1">
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                  <input type="checkbox" checked={!!editing.active} onChange={e2 => setEditing(e => ({ ...e, active: e2.target.checked }))} /> {t('activeLabel')}
                </label>
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                  <input type="checkbox" checked={!!editing.featured} onChange={e2 => setEditing(e => ({ ...e, featured: e2.target.checked }))} /> {t('featuredLabel')}
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Btn onClick={save} disabled={saving}>{saving ? t('saving') : t('save')}</Btn>
              <Btn variant="ghost" onClick={() => setEditing(null)}>{t('cancel')}</Btn>
            </div>
          </div>
        </div>
      )}

      <Card>
        <DataTable
          tableId="credentials"
          columns={columns}
          rows={items}
          locale={locale}
          loading={loading}
          rowKey={item => String(item.id)}
          rowActions={rowActions}
          exportName="credentials"
          emptyLabel={t('noCredentials')}
          quickCreate={{ labelEn: 'Add Credential', labelFa: t('addCredential'), onClick: () => setEditing({ type: 'certification', active: true, featured: false, sortOrder: items.length + 1 }) }}
        />
      </Card>
    </div>
  )
}
