'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, Badge, Input, Select, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

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
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState<Partial<Org & { nameFa: string; descriptionEn: string; contactEmail: string; phone: string }> | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() {
    setLoading(true)
    const url = filter !== 'all' ? `/api/admin/organizations?type=${filter}` : '/api/admin/organizations'
    const r = await fetch(url)
    setOrgs(await r.json())
    setLoading(false)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: reload on filter change only
  useEffect(() => { load() }, [filter])

  async function save() {
    if (!editing) return
    setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/organizations', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    if (res.ok) { toast(t('saved'), 'success'); setEditing(null); load() } else toast(t('failed'), 'error')
    setSaving(false)
  }

  async function del(id: number) {
    if (!confirm(t('confirmDel'))) return
    await fetch('/api/admin/organizations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast(t('deleted'), 'success'); load()
  }

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
            <h3 className="text-lg font-bold text-white mb-4">{editing.id ? t('editOrganization') : t('newOrganization')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Input label="Slug" value={editing.slug || ''} onChange={v => setEditing(e => ({ ...e, slug: v }))} /></div>
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

      <div className="flex flex-wrap gap-2 mb-4">
        {['all', ...TYPES].map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === t ? 'bg-brand text-white' : 'bg-white/5 text-text-secondary hover:text-white'}`}>
            {TYPE_ICONS[t] || '🏢'} {t}
          </button>
        ))}
      </div>

      <Card>
        {loading ? <div className="text-center py-8 text-text-tertiary">{t('loading')}</div> : orgs.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🏢</div>
            <div className="text-white font-medium mb-1">No organizations yet</div>
            <div className="text-text-tertiary text-sm">Add clients, employers, partners, and vendors</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left">
              {[t('organization'), t('type'), t('tier'), t('website'), t('status'), t('actions')].map(h => (
                <th key={h} className="px-4 py-3 text-text-tertiary font-medium">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {orgs.map(org => (
                <tr key={org.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{org.nameEn}</div>
                    <div className="text-xs text-text-tertiary">{org.country || org.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{TYPE_ICONS[org.type]} {org.type}</td>
                  <td className="px-4 py-3">
                    {org.tier ? <Badge color={TIER_COLORS[org.tier] || 'slate'}>{org.tier}</Badge> : <span className="text-text-disabled">—</span>}
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-xs">{org.website || '—'}</td>
                  <td className="px-4 py-3"><Badge color={org.active ? 'green' : 'slate'}>{org.active ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="px-4 py-3 flex gap-2">
                    <Btn size="sm" variant="ghost" onClick={() => setEditing(org)}>{t('edit')}</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => del(org.id)}>{t('del')}</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
