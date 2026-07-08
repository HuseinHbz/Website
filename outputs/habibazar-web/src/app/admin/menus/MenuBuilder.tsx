'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

interface MenuItem {
  id: number
  labelEn: string
  labelFa: string
  href: string
  icon: string
  location: 'header' | 'footer'
  parentId: number | null
  sortOrder: number
  active: boolean
}

const EMPTY: Omit<MenuItem, 'id'> = {
  labelEn: '', labelFa: '', href: '', icon: '', location: 'header', parentId: null, sortOrder: 0, active: true,
}

const COMMON_LINKS = [
  { label: 'Home', href: '/' }, { label: 'Case Studies', href: '/case-studies' },
  { label: 'Knowledge Center', href: '/blog' }, { label: 'Consultation', href: '/consultation' },
  { label: 'About', href: '/about' },
]

export function MenuBuilder() {
  const t = useT()
  const [items, setItems] = useState<MenuItem[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Omit<MenuItem, 'id'> & { id?: number }>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [location, setLocation] = useState<'header' | 'footer'>('header')
  const { toast, ToastContainer } = useToast()

  async function load() {
    const r = await fetch('/api/admin/navigation')
    const d = await r.json()
    setItems(Array.isArray(d) ? d : [])
  }
  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/navigation', {
      method: editing.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    })
    setSaving(false)
    if (res.ok) { toast(t('saved')); setModal(false); load() } else toast(t('failed'), 'error')
  }

  async function del(id: number) {
    if (!confirm(t('confirmDel'))) return
    await fetch('/api/admin/navigation', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast(t('deleted')); load()
  }

  async function toggle(item: MenuItem) {
    await fetch('/api/admin/navigation', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, active: !item.active }) })
    toast(t('updated')); load()
  }

  async function reorder(id: number, dir: -1 | 1) {
    const filtered = filteredItems
    const idx = filtered.findIndex(i => i.id === id)
    const target = filtered[idx + dir]
    if (!target) return
    await Promise.all([
      fetch('/api/admin/navigation', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, sortOrder: target.sortOrder }) }),
      fetch('/api/admin/navigation', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: target.id, sortOrder: filtered[idx].sortOrder }) }),
    ])
    load()
  }

  function set<K extends keyof typeof editing>(k: K, v: typeof editing[K]) { setEditing(e => ({ ...e, [k]: v })) }

  const filteredItems = items.filter(i => i.location === location).sort((a, b) => a.sortOrder - b.sortOrder)
  const headerItems = items.filter(i => i.location === 'header' && !i.parentId)
  const topLevel = filteredItems.filter(i => !i.parentId)
  const childOf = (parentId: number) => filteredItems.filter(i => i.parentId === parentId)

  function openNew(loc?: 'header' | 'footer', parentId?: number) {
    setEditing({ ...EMPTY, location: loc || location, parentId: parentId ?? null, sortOrder: filteredItems.length })
    setModal(true)
  }

  return (
    <>
      <ToastContainer />
      <PageHeader title={t('menuTitle')} action={<Btn onClick={() => openNew()}>{t('addMenuItem')}</Btn>} />

      {/* Location tabs */}
      <div className="flex gap-2 mb-6">
        {(['header', 'footer'] as const).map(loc => (
          <button key={loc} onClick={() => setLocation(loc)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${location === loc ? 'bg-brand text-white' : 'bg-surface text-text-secondary border border-border hover:text-white'}`}>
            {loc === 'header' ? `☰ ${t('headerNav')}` : `— ${t('footerNav')}`}
          </button>
        ))}
      </div>

      {/* Menu tree */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Tree view */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white capitalize">{location} Menu</h3>
            <Btn size="sm" onClick={() => openNew(location)}>+ Add Item</Btn>
          </div>
          {filteredItems.length === 0 && (
            <div className="text-center py-8 text-text-disabled text-sm">No items in {location} menu yet</div>
          )}
          <div className="space-y-1">
            {topLevel.map((item, idx) => (
              <div key={item.id}>
                <div className={`flex items-center gap-3 p-2.5 rounded-lg ${item.active ? '' : 'opacity-50'}`}
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => reorder(item.id, -1)} className="text-text-disabled hover:text-white text-3xs">▲</button>
                    <button onClick={() => reorder(item.id, 1)} className="text-text-disabled hover:text-white text-3xs">▼</button>
                  </div>
                  <span className="text-base">{item.icon || '◦'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">{item.labelEn}</p>
                    <p className="text-xs text-text-tertiary">{item.labelFa} · <span className="font-mono">{item.href}</span></p>
                  </div>
                  <Badge color={item.active ? 'green' : 'slate'}>{item.active ? 'On' : 'Off'}</Badge>
                  <div className="flex gap-1">
                    <Btn size="sm" variant="ghost" onClick={() => { setEditing({ ...item }); setModal(true) }}>✏</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => toggle(item)}>{item.active ? '⏸' : '▶'}</Btn>
                    {location === 'header' && <Btn size="sm" variant="ghost" onClick={() => openNew(location, item.id)}>+sub</Btn>}
                    <Btn size="sm" variant="danger" onClick={() => del(item.id)}>✕</Btn>
                  </div>
                </div>
                {/* Children */}
                {childOf(item.id).map(child => (
                  <div key={child.id} className="flex items-center gap-3 p-2 rounded-lg ml-6 mt-1"
                    style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.1)' }}>
                    <span className="text-text-disabled text-xs">↳</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white">{child.labelEn}</p>
                      <p className="text-3xs text-text-tertiary font-mono">{child.href}</p>
                    </div>
                    <div className="flex gap-1">
                      <Btn size="sm" variant="ghost" onClick={() => { setEditing({ ...child }); setModal(true) }}>✏</Btn>
                      <Btn size="sm" variant="danger" onClick={() => del(child.id)}>✕</Btn>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Card>

        {/* Preview */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-white mb-4">
            {location === 'header' ? `☰ ${t('headerPreview')}` : `— ${t('footerPreview')}`}
          </h3>
          {location === 'header' ? (
            <div className="rounded-xl overflow-hidden bg-surface-2 border border-subtle">
              <div className="flex items-center gap-4 px-6 py-3 border-b border-subtle">
                <span className="text-white font-bold text-sm">HBZ</span>
                <div className="flex gap-4 ml-auto">
                  {topLevel.filter(i => i.active).map(i => (
                    <span key={i.id} className="text-xs text-text-secondary hover:text-white cursor-pointer">{i.labelEn}</span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden p-6 bg-surface-2 border border-subtle">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-bold text-white mb-2">Navigation</p>
                  {filteredItems.filter(i => i.active && !i.parentId).map(i => (
                    <p key={i.id} className="text-xs text-text-tertiary mb-1 hover:text-white cursor-pointer">{i.labelEn}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Quick add common links */}
          <div className="mt-4">
            <p className="text-xs text-text-tertiary font-medium mb-2">Quick add common links</p>
            <div className="flex flex-wrap gap-2">
              {COMMON_LINKS.map(link => (
                <button key={link.href} onClick={() => {
                  setEditing({ ...EMPTY, labelEn: link.label, labelFa: link.label, href: link.href, location, sortOrder: filteredItems.length })
                  setModal(true)
                }}
                  className="text-xs px-2 py-1 rounded text-text-secondary hover:text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  + {link.label}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? t('editMenuItem') : t('addMenuItem')} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('labelEnStar')} value={editing.labelEn} onChange={v => set('labelEn', v)} placeholder="Case Studies" />
            <Input label={t('labelFaLabel')} value={editing.labelFa} onChange={v => set('labelFa', v)} placeholder="مطالعات موردی" />
          </div>
          <Input label={t('urlPath')} value={editing.href} onChange={v => set('href', v)} placeholder="/case-studies" />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('iconEmoji')} value={editing.icon} onChange={v => set('icon', v)} placeholder="◆" />
            <Select label={t('location')} value={editing.location} onChange={v => set('location', v as 'header' | 'footer')} options={[
              { value: 'header', label: t('headerNav') }, { value: 'footer', label: t('footerNav') },
            ]} />
          </div>
          {editing.location === 'header' && (
            <Select label={t('parentItem')} value={String(editing.parentId ?? '')} onChange={v => set('parentId', v ? Number(v) : null)}
              options={[{ value: '', label: t('topLevel') }, ...headerItems.map(i => ({ value: String(i.id), label: i.labelEn }))]} />
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('sortOrder')} type="number" value={String(editing.sortOrder)} onChange={v => set('sortOrder', Number(v))} />
            <Select label={t('status')} value={editing.active ? 'true' : 'false'} onChange={v => set('active', v === 'true')} options={[
              { value: 'true', label: t('active') }, { value: 'false', label: t('hidden') },
            ]} />
          </div>
          <div className="flex gap-3">
            <Btn onClick={save} disabled={saving}>{saving ? t('saving') : t('save')}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>{t('cancel')}</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
