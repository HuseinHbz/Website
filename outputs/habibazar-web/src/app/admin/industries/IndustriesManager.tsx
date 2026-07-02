'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, Badge, Input, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

type Industry = {
  id: number
  slug: string
  nameEn: string
  nameFa: string
  taglineEn: string | null
  icon: string
  color: string
  active: boolean
  sortOrder: number
}

export function IndustriesManager() {
  const t = useT()
  const [industries, setIndustries] = useState<Industry[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Industry> | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/industries')
    setIndustries(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return
    setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/industries', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    if (res.ok) {
      toast(editing.id ? t('saved') : t('saved'), 'success')
      setEditing(null)
      load()
    } else {
      toast(t('failed'), 'error')
    }
    setSaving(false)
  }

  return (
    <div>
      <ToastContainer />
      <PageHeader
        title={t('industriesTitle')}
        subtitle={`${industries.length} ${t('industriesSub')}`}
        action={<Btn onClick={() => setEditing({ icon: '🏢', color: '#6366f1', active: true, sortOrder: industries.length + 1 })}>{t('addIndustry')}</Btn>}
      />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-2xl w-full max-w-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">{editing.id ? t('editIndustry') : t('newIndustry')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Input label={t('slug')} value={editing.slug || ''} onChange={v => setEditing(e => ({ ...e, slug: v }))} /></div>
              <Input label={t('nameEn')} value={editing.nameEn || ''} onChange={v => setEditing(e => ({ ...e, nameEn: v }))} />
              <Input label={t('nameFa')} value={editing.nameFa || ''} onChange={v => setEditing(e => ({ ...e, nameFa: v }))} />
              <div className="col-span-2"><Input label={t('taglineEn')} value={editing.taglineEn || ''} onChange={v => setEditing(e => ({ ...e, taglineEn: v }))} /></div>
              <Input label={t('icon')} value={editing.icon || ''} onChange={v => setEditing(e => ({ ...e, icon: v }))} />
              <Input label={t('colorHex')} value={editing.color || ''} onChange={v => setEditing(e => ({ ...e, color: v }))} />
              <Input label={t('sortOrder')} type="number" value={String(editing.sortOrder || 0)} onChange={v => setEditing(e => ({ ...e, sortOrder: parseInt(v) || 0 }))} />
              <div className="flex items-center gap-3 pt-5">
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                  <input type="checkbox" checked={!!editing.active} onChange={e2 => setEditing(e => ({ ...e, active: e2.target.checked }))} />
                  {t('activeLabel')}
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
        {loading ? (
          <div className="text-text-tertiary text-sm text-center py-8">{t('loading')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-text-tertiary font-medium">{t('colIndustry')}</th>
                <th className="px-4 py-3 text-text-tertiary font-medium">{t('colTagline')}</th>
                <th className="px-4 py-3 text-text-tertiary font-medium">{t('status')}</th>
                <th className="px-4 py-3 text-text-tertiary font-medium">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {industries.map(ind => (
                <tr key={ind.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                        style={{ background: `${ind.color}20`, border: `1px solid ${ind.color}30` }}>
                        {ind.icon}
                      </div>
                      <div>
                        <div className="font-medium text-white">{ind.nameEn}</div>
                        <div className="text-xs text-text-tertiary">{ind.nameFa}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary max-w-xs truncate">{ind.taglineEn}</td>
                  <td className="px-4 py-3">
                    <Badge color={ind.active ? 'green' : 'slate'}>{ind.active ? t('active') : t('inactive')}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Btn size="sm" variant="ghost" onClick={() => setEditing(ind)}>{t('edit')}</Btn>
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
