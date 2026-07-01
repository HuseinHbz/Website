'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, Btn, Input, Select, PageHeader, Table, TR, TD, Badge, Modal, useToast, ColorDot } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

type Service = {
  id?: number; slug: string; titleEn: string; titleFa: string; categoryEn: string; categoryFa: string
  shortDescEn: string; shortDescFa: string; longDescEn: string; longDescFa: string
  featuresEn: string; featuresFa: string; icon: string; color: string; sortOrder: number; active: boolean
}
const EMPTY: Service = { slug: '', titleEn: '', titleFa: '', categoryEn: '', categoryFa: '', shortDescEn: '', shortDescFa: '', longDescEn: '', longDescFa: '', featuresEn: '[]', featuresFa: '[]', icon: '', color: '#6366f1', sortOrder: 0, active: true }

export function ServicesManager() {
  const t = useT()
  const [services, setServices] = useState<Service[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Service>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'hidden'>('all')
  const { toast, ToastContainer } = useToast()

  const filtered = useMemo(() => services.filter((s) => {
    const q = search.toLowerCase()
    if (q && !s.titleEn.toLowerCase().includes(q) && !s.titleFa.includes(q) && !s.categoryEn.toLowerCase().includes(q)) return false
    if (filterActive === 'active' && !s.active) return false
    if (filterActive === 'hidden' && s.active) return false
    return true
  }), [services, search, filterActive])

  async function load() {
    const r = await fetch('/api/admin/services')
    const d = await r.json(); setServices(Array.isArray(d) ? d : [])
  }
  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/services', { method: editing.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    setSaving(false)
    if (res.ok) { toast(t('saved')); setModal(false); load() } else toast(t('failed'), 'error')
  }

  async function del(id: number) {
    if (!confirm(t('confirmDel'))) return
    await fetch('/api/admin/services', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast(t('deleted')); load()
  }

  async function toggle(s: Service) {
    await fetch('/api/admin/services', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, active: !s.active }) })
    toast(t('saved')); load()
  }

  function set<K extends keyof Service>(k: K, v: Service[K]) { setEditing((e) => ({ ...e, [k]: v })) }

  return (
    <>
      <ToastContainer />
      <PageHeader title={t('servicesTitle')} action={<Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>{t('addNew')} {t('servicesTitle')}</Btn>} />

      <div className="flex flex-wrap gap-3 mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search services..." className="flex-1 min-w-[200px] bg-background border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-text-disabled focus:outline-none focus:border-brand" />
        <select value={filterActive} onChange={(e) => setFilterActive(e.target.value as typeof filterActive)} className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="hidden">Hidden</option>
        </select>
        {(search || filterActive !== 'all') && <button onClick={() => { setSearch(''); setFilterActive('all') }} className="px-3 py-2 text-xs text-text-secondary hover:text-white border border-border rounded-lg">✕ Clear</button>}
        <span className="px-3 py-2 text-xs text-text-tertiary">{filtered.length} / {services.length}</span>
      </div>

      <Card>
        <Table headers={[t('title'), t('category'), t('color'), t('sortOrder'), t('status'), t('actions')]}>
          {filtered.map((s) => (
            <TR key={s.id}>
              <TD><div className="font-medium text-white">{s.titleEn}</div><div className="text-xs text-text-tertiary">{s.titleFa}</div></TD>
              <TD className="text-text-secondary">{s.categoryEn}</TD>
              <TD><ColorDot color={s.color} /></TD>
              <TD className="text-text-tertiary">{s.sortOrder}</TD>
              <TD><Badge color={s.active ? 'green' : 'slate'}>{s.active ? t('active') : t('hidden')}</Badge></TD>
              <TD>
                <div className="flex gap-2">
                  <Btn size="sm" variant="secondary" onClick={() => { setEditing(s); setModal(true) }}>{t('edit')}</Btn>
                  <Btn size="sm" variant="secondary" onClick={() => toggle(s)}>{s.active ? '⏸' : '▶'}</Btn>
                  <Btn size="sm" variant="danger" onClick={() => del(s.id!)}>{t('delete')}</Btn>
                </div>
              </TD>
            </TR>
          ))}
        </Table>
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? t('serviceEdit') : t('serviceNew')} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Input label={`${t('slug')} *`} value={editing.slug} onChange={(v) => set('slug', v)} placeholder="network-design" />
            <Input label={t('color')} type="color" value={editing.color} onChange={(v) => set('color', v)} />
            <Input label={t('sortOrder')} type="number" value={String(editing.sortOrder)} onChange={(v) => set('sortOrder', Number(v))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('titleEn')} value={editing.titleEn} onChange={(v) => set('titleEn', v)} />
            <Input label={t('titleFa')} value={editing.titleFa} onChange={(v) => set('titleFa', v)} />
            <Input label={t('catEn')} value={editing.categoryEn} onChange={(v) => set('categoryEn', v)} />
            <Input label={t('catFa')} value={editing.categoryFa} onChange={(v) => set('categoryFa', v)} />
            <Input label={t('shortDescEn')} value={editing.shortDescEn} onChange={(v) => set('shortDescEn', v)} multiline rows={2} />
            <Input label={t('shortDescFa')} value={editing.shortDescFa} onChange={(v) => set('shortDescFa', v)} multiline rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('featuresEn')} value={editing.featuresEn} onChange={(v) => set('featuresEn', v)} multiline rows={4} placeholder='["Feature 1","Feature 2"]' />
            <Input label={t('featuresFa')} value={editing.featuresFa} onChange={(v) => set('featuresFa', v)} multiline rows={4} />
          </div>
          <Select label={t('status')} value={editing.active ? 'true' : 'false'} onChange={(v) => set('active', v === 'true')} options={[{ value: 'true', label: t('active') }, { value: 'false', label: t('hidden') }]} />
          <div className="flex gap-3">
            <Btn onClick={save} disabled={saving}>{saving ? t('saving') : t('save')}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>{t('cancel')}</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
