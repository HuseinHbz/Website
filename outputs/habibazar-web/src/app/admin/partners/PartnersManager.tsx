'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, Badge, Input, Select, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

type Partner = { id: number; slug: string; nameEn: string; type: string; tier: string; website: string | null; active: boolean; featured: boolean; sortOrder: number }

const TYPES = ['technology', 'reseller', 'consultant', 'distributor', 'referral']
const TIERS = ['platinum', 'gold', 'silver', 'bronze']
const TIER_COLORS: Record<string, string> = { platinum: 'blue', gold: 'yellow', silver: 'slate', bronze: 'red' }

export function PartnersManager() {
  const t = useT()
  const locale = useAdminLocale()
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Partner & { descriptionEn: string }> | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() { setLoading(true); const r = await fetch('/api/admin/partners'); setPartners(await r.json()); setLoading(false) }
  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return; setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/partners', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    if (res.ok) { toast(t('saved'), 'success'); setEditing(null); load() } else toast(t('failed'), 'error')
    setSaving(false)
  }

  const columns: Column<Partner>[] = [
    { key: 'nameEn', labelEn: 'Partner', labelFa: t('partner'), render: p => <span className="font-medium text-white">{p.nameEn}</span> },
    { key: 'type', labelEn: 'Type', labelFa: t('type'), type: 'enum', options: TYPES.map(tp => ({ value: tp, labelEn: tp, labelFa: tp })) },
    { key: 'tier', labelEn: 'Tier', labelFa: t('tier'), type: 'enum', options: TIERS.map(tr => ({ value: tr, labelEn: tr, labelFa: tr })), render: p => <Badge color={TIER_COLORS[p.tier] || 'slate'}>{p.tier}</Badge> },
    { key: 'website', labelEn: 'Website', labelFa: t('website'), render: p => <span className="text-text-secondary text-xs">{p.website || '—'}</span> },
    { key: 'active', labelEn: 'Status', labelFa: t('status'), type: 'boolean', value: p => p.active, render: p => <Badge color={p.active ? 'green' : 'slate'}>{p.active ? t('active') : t('inactive')}</Badge> },
  ]
  const rowActions: RowAction<Partner>[] = [
    { id: 'edit', labelEn: 'Edit', labelFa: t('edit'), icon: '✎', onClick: p => setEditing(p) },
  ]

  return (
    <div>
      <ToastContainer />
      <PageHeader title={t('partnersTitle')} subtitle={`${partners.length} partners`}
        action={<Btn onClick={() => setEditing({ type: 'technology', tier: 'silver', active: true, featured: false, sortOrder: partners.length + 1 })}>{t('addPartner')}</Btn>} />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-2xl w-full max-w-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">{editing.id ? t('editPartner') : t('newPartner')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Input label="Slug" value={editing.slug || ''} onChange={v => setEditing(e => ({ ...e, slug: v }))} /></div>
              <div className="col-span-2"><Input label={t('nameEn')} value={editing.nameEn || ''} onChange={v => setEditing(e => ({ ...e, nameEn: v }))} /></div>
              <Select label={t('type')} value={editing.type || 'technology'} onChange={v => setEditing(e => ({ ...e, type: v }))} options={TYPES.map(tp => ({ value: tp, label: tp }))} />
              <Select label={t('tier')} value={editing.tier || 'silver'} onChange={v => setEditing(e => ({ ...e, tier: v }))} options={TIERS.map(tr => ({ value: tr, label: tr }))} />
              <div className="col-span-2"><Input label={t('website')} value={editing.website || ''} onChange={v => setEditing(e => ({ ...e, website: v }))} /></div>
              <div className="flex items-center gap-4 col-span-2 pt-1">
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer"><input type="checkbox" checked={!!editing.active} onChange={e2 => setEditing(e => ({ ...e, active: e2.target.checked }))} /> {t('activeLabel')}</label>
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer"><input type="checkbox" checked={!!editing.featured} onChange={e2 => setEditing(e => ({ ...e, featured: e2.target.checked }))} /> {t('featuredLabel')}</label>
              </div>
            </div>
            <div className="flex gap-3 mt-6"><Btn onClick={save} disabled={saving}>{saving ? t('saving') : t('save')}</Btn><Btn variant="ghost" onClick={() => setEditing(null)}>{t('cancel')}</Btn></div>
          </div>
        </div>
      )}

      <Card>
        <DataTable
          tableId="partners"
          columns={columns}
          rows={partners}
          locale={locale}
          loading={loading}
          rowKey={p => String(p.id)}
          rowActions={rowActions}
          exportName="partners"
          quickCreate={{ labelEn: 'Add Partner', labelFa: t('addPartner'), onClick: () => setEditing({ type: 'technology', tier: 'silver', active: true, featured: false, sortOrder: partners.length + 1 }) }}
        />
      </Card>
    </div>
  )
}
