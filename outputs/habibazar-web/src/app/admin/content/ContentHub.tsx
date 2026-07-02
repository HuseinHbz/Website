'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, Badge, Input, Select, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

type ContentItem = {
  id: number; slug: string; type: string; titleEn: string;
  status: string; featured: boolean; views: number; publishedAt: string | null; readTimeMinutes: number | null
}

const TYPES = ['blog', 'news', 'docs', 'api', 'tutorial', 'guide', 'runbook', 'release', 'research', 'announcement']
const STATUSES = ['draft', 'published', 'archived']
const TYPE_ICONS: Record<string, string> = {
  blog: '✍️', news: '📰', docs: '📄', api: '⚡', tutorial: '📖',
  guide: '🏛️', runbook: '📋', release: '📦', research: '🔬', announcement: '📢',
}
const STATUS_COLORS: Record<string, string> = { published: 'green', draft: 'yellow', archived: 'slate' }

export function ContentHub() {
  const t = useT()
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState<Partial<ContentItem & { titleFa: string; excerptEn: string; contentEn: string; seoTitle: string; version: string }> | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() {
    setLoading(true)
    const url = filter !== 'all' ? `/api/admin/content?type=${filter}` : '/api/admin/content'
    const r = await fetch(url)
    setItems(await r.json())
    setLoading(false)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: reload on filter change only
  useEffect(() => { load() }, [filter])

  async function save() {
    if (!editing) return
    setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/content', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    if (res.ok) { toast(t('saved'), 'success'); setEditing(null); load() } else toast(t('failed'), 'error')
    setSaving(false)
  }

  async function del(id: number) {
    if (!confirm(t('confirmDel'))) return
    await fetch('/api/admin/content', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast(t('deleted'), 'success'); load()
  }

  const stats = {
    total: items.length,
    published: items.filter(i => i.status === 'published').length,
    views: items.reduce((s, i) => s + i.views, 0),
  }

  return (
    <div>
      <ToastContainer />
      <PageHeader
        title={t('contentHubTitle')}
        subtitle={`${stats.total} items · ${stats.published} published · ${stats.views.toLocaleString()} views`}
        action={<Btn onClick={() => setEditing({ type: 'blog', status: 'draft', featured: false })}>{t('addContent')}</Btn>}
      />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-2xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4">{editing.id ? t('editContent') : t('newContent')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Input label="Slug" value={editing.slug || ''} onChange={v => setEditing(e => ({ ...e, slug: v }))} /></div>
              <Select label={t('type')} value={editing.type || 'blog'} onChange={v => setEditing(e => ({ ...e, type: v }))} options={TYPES.map(tp => ({ value: tp, label: `${TYPE_ICONS[tp]} ${tp}` }))} />
              <Select label="Status" value={editing.status || 'draft'} onChange={v => setEditing(e => ({ ...e, status: v }))} options={STATUSES.map(st => ({ value: st, label: st }))} />
              <div className="col-span-2"><Input label={t('titleEn')} value={editing.titleEn || ''} onChange={v => setEditing(e => ({ ...e, titleEn: v }))} /></div>
              <div className="col-span-2"><Input label={t('titleFa')} value={editing.titleFa || ''} onChange={v => setEditing(e => ({ ...e, titleFa: v }))} /></div>
              <Input label={t('version')} value={editing.version || ''} onChange={v => setEditing(e => ({ ...e, version: v }))} />
              <Input label={t('readTime')} type="number" value={String(editing.readTimeMinutes || 5)} onChange={v => setEditing(e => ({ ...e, readTimeMinutes: parseInt(v) || 5 }))} />
              <div className="col-span-2">
                <label className="text-xs text-text-secondary mb-1 block">{t('excerpt')}</label>
                <textarea value={editing.excerptEn || ''} onChange={e2 => setEditing(e => ({ ...e, excerptEn: e2.target.value }))} rows={2}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white outline-none" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-text-secondary mb-1 block">{t('contentMarkdown')}</label>
                <textarea value={editing.contentEn || ''} onChange={e2 => setEditing(e => ({ ...e, contentEn: e2.target.value }))} rows={8}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white outline-none font-mono" />
              </div>
              <div className="col-span-2"><Input label={t('seoTitle')} value={editing.seoTitle || ''} onChange={v => setEditing(e => ({ ...e, seoTitle: v }))} /></div>
              <div className="col-span-2 flex gap-4 pt-1">
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
            {TYPE_ICONS[t] || '📚'} {t}
          </button>
        ))}
      </div>

      <Card>
        {loading ? <div className="text-center py-8 text-text-tertiary">{t('loading')}</div> : items.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📝</div>
            <div className="text-white font-medium mb-1">No content yet</div>
            <div className="text-text-tertiary text-sm">Create your first article, doc, or announcement</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left">
              {[t('content'), t('type'), t('status'), t('views'), t('published'), t('actions')].map(h => (
                <th key={h} className="px-4 py-3 text-text-tertiary font-medium">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{item.titleEn}</div>
                    <div className="text-xs text-text-tertiary">{item.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{TYPE_ICONS[item.type]} {item.type}</td>
                  <td className="px-4 py-3"><Badge color={STATUS_COLORS[item.status] || 'slate'}>{item.status}</Badge></td>
                  <td className="px-4 py-3 text-text-secondary">{item.views.toLocaleString()}</td>
                  <td className="px-4 py-3 text-text-tertiary text-xs">{item.publishedAt?.slice(0, 10) || '—'}</td>
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
