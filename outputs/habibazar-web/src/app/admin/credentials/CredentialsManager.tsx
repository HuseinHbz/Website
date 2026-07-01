'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, Badge, Input, Select, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

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
  const [items, setItems] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState<Partial<Credential & { nameFa: string; descriptionEn: string; credentialId: string; badgeUrl: string; color: string }> | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() {
    setLoading(true)
    const url = filter !== 'all' ? `/api/admin/credentials?type=${filter}` : '/api/admin/credentials'
    const r = await fetch(url)
    setItems(await r.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [filter])

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

      <div className="flex flex-wrap gap-2 mb-4">
        {['all', ...TYPES].map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === t ? 'bg-brand text-white' : 'bg-white/5 text-text-secondary hover:text-white'}`}>
            {TYPE_ICONS[t] || '🏅'} {t}
          </button>
        ))}
      </div>

      <Card>
        {loading ? <div className="text-center py-8 text-text-tertiary">{t('loading')}</div> : items.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🏅</div>
            <div className="text-white font-medium mb-1">{t('noCredentials')}</div>
            <div className="text-text-tertiary text-sm">{t('noCredentialsSub')}</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left">
              {[t('colCredential'), t('type'), t('colIssuer'), t('colIssueDate'), t('colExpiry'), t('status'), t('actions')].map(h => (
                <th key={h} className="px-4 py-3 text-text-tertiary font-medium">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium text-white">{item.nameEn}</td>
                  <td className="px-4 py-3"><Badge color={TYPE_COLORS[item.type] || 'slate'}>{TYPE_ICONS[item.type]} {item.type}</Badge></td>
                  <td className="px-4 py-3 text-text-secondary">{item.issuer || '—'}</td>
                  <td className="px-4 py-3 text-text-secondary text-xs">{item.issueDate || '—'}</td>
                  <td className="px-4 py-3 text-text-secondary text-xs">{item.expiryDate || '∞'}</td>
                  <td className="px-4 py-3"><Badge color={item.active ? 'green' : 'slate'}>{item.active ? t('active') : t('inactive')}</Badge></td>
                  <td className="px-4 py-3 flex gap-2">
                    <Btn size="sm" variant="ghost" onClick={() => setEditing(item)}>{t('edit')}</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => del(item.id)}>{t('del')}</Btn>
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
