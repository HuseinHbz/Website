'use client'

import { useEffect, useState } from 'react'
import { crud } from '@/lib/admin/crud'
import { PageHeader, Card, Btn, Badge, Input, Select, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

type Org = {
  id: number; slug: string; nameEn: string; type: string;
  tier: string | null; website: string | null; country: string | null;
  active: boolean; featured: boolean; sortOrder: number
}

const TYPES = ['client', 'employer', 'tech_partner', 'reseller', 'distributor', 'consultant', 'vendor', 'referral', 'branch']
const TIERS = ['platinum', 'gold', 'silver', 'bronze']
const TIER_COLORS: Record<string, string> = { platinum: 'blue', gold: 'yellow', silver: 'slate', bronze: 'red' }
const TYPE_ICONS: Record<string, string> = {
  client: '🏢', employer: '👔', tech_partner: '🤝', reseller: '🔄',
  distributor: '🚚', consultant: '💼', vendor: '🏪', referral: '📣', branch: '🌿',
}

export function OrganizationHub() {
  const t = useT()
  const locale = useAdminLocale()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Org & { nameFa: string; descriptionEn: string; contactEmail: string; phone: string }> | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() {
    setLoading(true)
    const r = await fetch('/api/admin/organizations')
    setOrgs(await r.json())
    setLoading(false)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return
    setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/organizations', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    if (res.ok) { toast(t('saved'), 'success'); setEditing(null); load() } else toast(await crud.errorOf(res, t('failed')), 'error')
    setSaving(false)
  }

  async function del(id: number) {
    if (!confirm(t('confirmDel'))) return
    await fetch('/api/admin/organizations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast(t('deleted'), 'success'); load()
  }

  const columns: Column<Org>[] = [
    { key: 'nameEn', labelEn: 'Organization', labelFa: t('organization'), render: org => <div><div className="font-medium text-text-primary">{org.nameEn}</div><div className="text-xs text-text-tertiary">{org.country || org.slug}</div></div> },
    { key: 'type', labelEn: 'Type', labelFa: t('type'), type: 'enum', options: TYPES.map(tp => ({ value: tp, labelEn: tp, labelFa: tp })), render: org => <span className="text-text-secondary">{TYPE_ICONS[org.type]} {org.type}</span> },
    { key: 'tier', labelEn: 'Tier', labelFa: t('tier'), type: 'enum', options: TIERS.map(tr => ({ value: tr, labelEn: tr, labelFa: tr })), render: org => org.tier ? <Badge color={TIER_COLORS[org.tier] || 'slate'}>{org.tier}</Badge> : <span className="text-text-disabled">—</span> },
    { key: 'website', labelEn: 'Website', labelFa: t('website'), render: org => <span className="text-text-secondary text-xs">{org.website || '—'}</span> },
    { key: 'active', labelEn: 'Status', labelFa: t('status'), type: 'boolean', value: org => org.active, render: org => <Badge color={org.active ? 'green' : 'slate'}>{org.active ? 'Active' : 'Inactive'}</Badge> },
  ]
  const rowActions: RowAction<Org>[] = [
    { id: 'edit', labelEn: 'Edit', labelFa: t('edit'), icon: '✎', onClick: org => setEditing(org) },
    { id: 'del', labelEn: 'Delete', labelFa: t('del'), icon: '🗑', danger: true, onClick: org => del(org.id) },
  ]

  return (
    <div>
      <ToastContainer />
      <PageHeader
        title={t('orgHubTitle')}
        subtitle={`${orgs.length} organizations — clients, employers, partners, vendors`}
        action={<Btn onClick={() => setEditing({ type: 'client', active: true, featured: false, sortOrder: orgs.length + 1 })}>{t('addOrganization')}</Btn>}
      />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-text-primary mb-4">{editing.id ? t('editOrganization') : t('newOrganization')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Input label={t('slug')} value={editing.slug || ''} onChange={v => setEditing(e => ({ ...e, slug: v }))} /></div>
              <div className="col-span-2"><Input label={t('nameEn')} value={editing.nameEn || ''} onChange={v => setEditing(e => ({ ...e, nameEn: v }))} /></div>
              <div className="col-span-2"><Input label={t('nameFa')} value={editing.nameFa || ''} onChange={v => setEditing(e => ({ ...e, nameFa: v }))} /></div>
              <Select label={t('type')} value={editing.type || 'client'} onChange={v => setEditing(e => ({ ...e, type: v }))} options={TYPES.map(tp => ({ value: tp, label: `${TYPE_ICONS[tp]} ${tp}` }))} />
              <Select label="Tier (partners)" value={editing.tier || ''} onChange={v => setEditing(e => ({ ...e, tier: v || null }))} options={[{ value: '', label: '— None —' }, ...TIERS.map(tr => ({ value: tr, label: tr }))]} />
              <Input label={t('website')} value={editing.website || ''} onChange={v => setEditing(e => ({ ...e, website: v }))} />
              <Input label={t('country')} value={editing.country || ''} onChange={v => setEditing(e => ({ ...e, country: v }))} />
              <Input label={t('contactEmail')} value={editing.contactEmail || ''} onChange={v => setEditing(e => ({ ...e, contactEmail: v }))} />
              <Input label={t('phone')} value={editing.phone || ''} onChange={v => setEditing(e => ({ ...e, phone: v }))} />
              <div className="col-span-2">
                <label className="text-xs text-text-secondary mb-1 block">{t('description')}</label>
                <textarea value={editing.descriptionEn || ''} onChange={e2 => setEditing(e => ({ ...e, descriptionEn: e2.target.value }))} rows={3}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none" />
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
          tableId="organizations"
          columns={columns}
          rows={orgs}
          locale={locale}
          loading={loading}
          rowKey={org => String(org.id)}
          rowActions={rowActions}
          exportName="organizations"
          emptyLabel="No organizations yet"
          quickCreate={{ labelEn: 'Add Organization', labelFa: t('addOrganization'), onClick: () => setEditing({ type: 'client', active: true, featured: false, sortOrder: orgs.length + 1 }) }}
        />
      </Card>
    </div>
  )
}
