'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

type Type = 'server' | 'network' | 'firewall' | 'switch' | 'router' | 'access_point' | 'storage' | 'vm' | 'cloud' | 'laptop' | 'license' | 'other'
type Status = 'active' | 'maintenance' | 'retired' | 'spare'
type WState = 'ok' | 'expiring' | 'expired' | 'none'
interface Asset {
  id?: number; name: string; type: Type; serial: string | null; vendor: string | null; status: Status
  location: string | null; assignedTo: string | null; purchaseDate: string | null; warrantyExpiry: string | null; notes: string | null
  warranty?: { state: WState; days: number | null }
}
interface Stats { total: number; byType: Record<string, number>; byStatus: Record<Status, number>; warrantyExpiring: number; warrantyExpired: number; active: number }

const TYPES: Type[] = ['server', 'network', 'firewall', 'switch', 'router', 'access_point', 'storage', 'vm', 'cloud', 'laptop', 'license', 'other']
const STATUSES: Status[] = ['active', 'maintenance', 'retired', 'spare']
const STATUS_COLOR: Record<Status, string> = { active: 'green', maintenance: 'yellow', retired: 'slate', spare: 'blue' }
const WARRANTY_COLOR: Record<WState, string> = { ok: 'green', expiring: 'yellow', expired: 'red', none: 'slate' }
const EMPTY: Asset = { name: '', type: 'server', serial: '', vendor: '', status: 'active', location: '', assignedTo: '', purchaseDate: '', warrantyExpiry: '', notes: '' }

export function AssetManager() {
  const t = useT()
  const { toast, ToastContainer } = useToast()
  const [assets, setAssets] = useState<Asset[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<Type | 'all'>('all')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Asset>(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/erp/assets')
      if (r.ok) { const d = await r.json(); setAssets(d.assets ?? []); setStats(d.stats ?? null) }
    } catch { toast(t('asset_loadFail'), 'error') } finally { setLoading(false) }
  }, [toast, t])
  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    try {
      const r = await fetch('/api/admin/erp/assets', {
        method: editing.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing),
      })
      if (!r.ok) throw new Error()
      toast(t('asset_savedOk'), 'success'); setModal(false); load()
    } catch { toast(t('asset_saveFail'), 'error') } finally { setSaving(false) }
  }
  async function del(id: number) {
    if (!confirm(t('asset_confirmDel'))) return
    try {
      const r = await fetch('/api/admin/erp/assets', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      if (!r.ok) throw new Error()
      toast(t('asset_delOk'), 'success'); load()
    } catch { toast(t('asset_delFail'), 'error') }
  }
  function set<K extends keyof Asset>(k: K, v: Asset[K]) { setEditing((e) => ({ ...e, [k]: v })) }

  const filtered = useMemo(() => assets.filter((a) => {
    if (typeFilter !== 'all' && a.type !== typeFilter) return false
    if (search) { const q = search.toLowerCase(); if (!`${a.name} ${a.serial ?? ''} ${a.vendor ?? ''} ${a.location ?? ''} ${a.assignedTo ?? ''}`.toLowerCase().includes(q)) return false }
    return true
  }), [assets, typeFilter, search])

  return (
    <>
      <ToastContainer />
      <PageHeader title={t('asset_title')} action={<Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>{t('asset_newAsset')}</Btn>} />

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="rounded-xl p-4 bg-surface-2 border border-subtle"><p className="text-xs text-text-tertiary mb-1">{t('asset_total')}</p><p className="text-2xl font-bold text-text-primary">{stats.total}</p></div>
          <div className="rounded-xl p-4 bg-surface-2 border border-success/40"><p className="text-xs text-text-tertiary mb-1">{t('asset_active')}</p><p className="text-2xl font-bold text-success">{stats.active}</p></div>
          <div className="rounded-xl p-4 bg-surface-2 border border-warning/40"><p className="text-xs text-text-tertiary mb-1">{t('asset_inMaint')}</p><p className="text-2xl font-bold text-text-primary">{stats.byStatus.maintenance}</p></div>
          <div className="rounded-xl p-4 bg-surface-2 border border-warning/40"><p className="text-xs text-text-tertiary mb-1">{t('asset_wExpiring')}</p><p className="text-2xl font-bold text-warning">{stats.warrantyExpiring}</p></div>
          <div className="rounded-xl p-4 bg-surface-2 border border-danger/40"><p className="text-xs text-text-tertiary mb-1">{t('asset_wExpired')}</p><p className="text-2xl font-bold text-danger">{stats.warrantyExpired}</p></div>
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as Type | 'all')} className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-white capitalize">
          <option value="all">{t('asset_allTypes')} ({assets.length})</option>
          {TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')} ({stats?.byType[t] ?? 0})</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('asset_searchPh')} className="flex-1 min-w-[200px] bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-white placeholder-text-disabled" />
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? <p className="text-sm text-text-tertiary p-5">{t('asset_loading')}</p>
          : filtered.length === 0 ? <p className="text-sm text-text-tertiary p-5">{t('asset_empty')}</p>
          : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-text-tertiary text-left border-b border-subtle">
                {[t('asset_colAsset'), t('asset_colType'), t('asset_colSerial'), t('asset_colStatus'), t('asset_colWarranty'), t('asset_colAssigned'), t('asset_colActions')].map((h) => <th key={h} className="px-4 py-2 text-xs font-medium">{h}</th>)}
              </tr></thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-b border-subtle/50">
                    <td className="px-4 py-2.5"><div className="font-medium text-text-primary">{a.name}</div><div className="text-xs text-text-tertiary">{a.vendor || '—'}</div></td>
                    <td className="px-4 py-2.5 text-text-tertiary text-xs capitalize">{a.type.replace('_', ' ')}</td>
                    <td className="px-4 py-2.5 text-text-secondary text-xs font-mono">{a.serial || '—'}</td>
                    <td className="px-4 py-2.5"><Badge color={STATUS_COLOR[a.status]}>{a.status}</Badge></td>
                    <td className="px-4 py-2.5">
                      {a.warranty && a.warranty.state !== 'none'
                        ? <Badge color={WARRANTY_COLOR[a.warranty.state]}>{a.warranty.state}{a.warranty.days != null ? ` · ${a.warranty.days}d` : ''}</Badge>
                        : <span className="text-xs text-text-disabled">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-text-tertiary text-xs">{[a.assignedTo, a.location].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="px-4 py-2.5"><div className="flex gap-2">
                      <Btn size="sm" variant="secondary" onClick={() => { setEditing(a); setModal(true) }}>{t('asset_edit')}</Btn>
                      <Btn size="sm" variant="danger" onClick={() => del(a.id!)}>{t('asset_del')}</Btn>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? t('asset_editAsset') : t('asset_newAsset')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('asset_name') + ' *'} value={editing.name} onChange={(v) => set('name', v)} />
            <Input label={t('asset_vendor')} value={editing.vendor || ''} onChange={(v) => set('vendor', v)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select label={t('asset_typeL')} value={editing.type} onChange={(v) => set('type', v as Type)} options={TYPES.map((t) => ({ value: t, label: t.replace('_', ' ') }))} />
            <Select label={t('asset_statusL')} value={editing.status} onChange={(v) => set('status', v as Status)} options={STATUSES.map((s) => ({ value: s, label: s }))} />
            <Input label={t('asset_serial')} value={editing.serial || ''} onChange={(v) => set('serial', v)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('asset_assignedTo')} value={editing.assignedTo || ''} onChange={(v) => set('assignedTo', v)} />
            <Input label={t('asset_location')} value={editing.location || ''} onChange={(v) => set('location', v)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('asset_purchaseDate')} type="date" value={editing.purchaseDate || ''} onChange={(v) => set('purchaseDate', v)} />
            <Input label={t('asset_warrantyExpiry')} type="date" value={editing.warrantyExpiry || ''} onChange={(v) => set('warrantyExpiry', v)} />
          </div>
          <Input label={t('asset_notes')} value={editing.notes || ''} onChange={(v) => set('notes', v)} multiline rows={3} />
          <div className="flex gap-3">
            <Btn onClick={save} disabled={saving}>{saving ? t('asset_saving') : t('asset_save')}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>{t('asset_cancel')}</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
