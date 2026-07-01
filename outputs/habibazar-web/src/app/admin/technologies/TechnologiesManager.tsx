'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, Badge, Input, Select, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

type Technology = {
  id: number
  slug: string
  nameEn: string
  nameFa: string
  category: string
  icon: string
  color: string
  vendor: string | null
  tier: 'core' | 'advanced' | 'specialized'
  active: boolean
  sortOrder: number
}

const CATEGORIES = ['networking', 'virtualization', 'cloud', 'os', 'monitoring', 'security', 'identity', 'automation', 'containers', 'backup']
const TIERS = ['core', 'advanced', 'specialized']


export function TechnologiesManager() {
  const t = useT()
  const [techs, setTechs] = useState<Technology[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Technology> | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('all')
  const { toast, ToastContainer } = useToast()

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/technologies')
    setTechs(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return
    setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/technologies', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    if (res.ok) {
      toast(editing.id ? t('updated') : t('created'), 'success')
      setEditing(null)
      load()
    } else {
      toast(t('saveFailed'), 'error')
    }
    setSaving(false)
  }

  const filtered = filter === 'all' ? techs : techs.filter(tech => tech.category === filter)

  return (
    <div>
      <ToastContainer />
      <PageHeader
        title={t('techTitle')}
        subtitle={`${techs.length} technologies`}
        action={<Btn onClick={() => setEditing({ icon: '⚙️', color: '#6366f1', active: true, category: 'networking', tier: 'core', sortOrder: techs.length + 1 })}>{t('addTech')}</Btn>}
      />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-2xl w-full max-w-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">{editing.id ? t('editTech') : t('newTech')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Input label="Slug" value={editing.slug || ''} onChange={v => setEditing(e => ({ ...e, slug: v }))} /></div>
              <Input label={t('nameEn')} value={editing.nameEn || ''} onChange={v => setEditing(e => ({ ...e, nameEn: v }))} />
              <Input label={t('nameFa')} value={editing.nameFa || ''} onChange={v => setEditing(e => ({ ...e, nameFa: v }))} />
              <Select label={t('category')} value={editing.category || 'networking'} onChange={v => setEditing(e => ({ ...e, category: v }))} options={CATEGORIES.map(cat => ({ value: cat, label: cat }))} />
              <Select label={t('tier')} value={editing.tier || 'core'} onChange={v => setEditing(e => ({ ...e, tier: v as Technology['tier'] }))} options={TIERS.map(tr => ({ value: tr, label: tr }))} />
              <Input label="Icon" value={editing.icon || ''} onChange={v => setEditing(e => ({ ...e, icon: v }))} />
              <Input label={t('colorHex')} value={editing.color || ''} onChange={v => setEditing(e => ({ ...e, color: v }))} />
              <div className="col-span-2"><Input label={t('vendor')} value={editing.vendor || ''} onChange={v => setEditing(e => ({ ...e, vendor: v }))} /></div>
              <Input label="Sort Order" type="number" value={String(editing.sortOrder || 0)} onChange={v => setEditing(e => ({ ...e, sortOrder: parseInt(v) || 0 }))} />
              <div className="flex items-center gap-3 pt-5">
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                  <input type="checkbox" checked={!!editing.active} onChange={e2 => setEditing(e => ({ ...e, active: e2.target.checked }))} />
                  Active
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

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        {['all', ...CATEGORIES].map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === cat ? 'bg-brand text-white' : 'bg-white/5 text-text-secondary hover:text-white'}`}>
            {cat}
          </button>
        ))}
      </div>

      <Card>
        {loading ? (
          <div className="text-text-tertiary text-sm text-center py-8">{t('loading')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-text-tertiary font-medium">{t('technology')}</th>
                <th className="px-4 py-3 text-text-tertiary font-medium">{t('category')}</th>
                <th className="px-4 py-3 text-text-tertiary font-medium">{t('tier')}</th>
                <th className="px-4 py-3 text-text-tertiary font-medium">{t('vendor')}</th>
                <th className="px-4 py-3 text-text-tertiary font-medium">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(tech => (
                <tr key={tech.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                        style={{ background: `${tech.color}20`, border: `1px solid ${tech.color}30` }}>
                        {tech.icon}
                      </div>
                      <div>
                        <div className="font-medium text-white">{tech.nameEn}</div>
                        <div className="text-xs text-text-tertiary">{tech.nameFa}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{tech.category}</td>
                  <td className="px-4 py-3">
                    <Badge color={tech.tier === 'core' ? 'green' : tech.tier === 'advanced' ? 'blue' : 'yellow'}>{tech.tier}</Badge>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{tech.vendor}</td>
                  <td className="px-4 py-3">
                    <Btn size="sm" variant="ghost" onClick={() => setEditing(tech)}>{t('edit')}</Btn>
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
