'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, Badge, Input, Select, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

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
  const locale = useAdminLocale()
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<ContentItem & { titleFa: string; excerptEn: string; contentEn: string; seoTitle: string; version: string }> | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() {
    setLoading(true)
    const r = await fetch('/api/admin/content')
    setItems(await r.json())
    setLoading(false)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  useEffect(() => { load() }, [])

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

  const columns: Column<ContentItem>[] = [
    { key: 'titleEn', labelEn: 'Content', labelFa: t('content'), render: item => <div><div className="font-medium text-text-primary">{item.titleEn}</div><div className="text-xs text-text-tertiary">{item.slug}</div></div> },
    { key: 'type', labelEn: 'Type', labelFa: t('type'), type: 'enum', options: TYPES.map(tp => ({ value: tp, labelEn: tp, labelFa: tp })), render: item => <span className="text-text-secondary">{TYPE_ICONS[item.type]} {item.type}</span> },
    { key: 'status', labelEn: 'Status', labelFa: t('status'), type: 'enum', options: STATUSES.map(st => ({ value: st, labelEn: st, labelFa: st })), render: item => <Badge color={STATUS_COLORS[item.status] || 'slate'}>{item.status}</Badge> },
    { key: 'views', labelEn: 'Views', labelFa: t('views'), type: 'number', numeric: true, render: item => <span className="text-text-secondary">{item.views.toLocaleString()}</span> },
    { key: 'publishedAt', labelEn: 'Published', labelFa: t('published'), type: 'date', render: item => <span className="text-text-tertiary text-xs">{item.publishedAt?.slice(0, 10) || '—'}</span> },
  ]
  const rowActions: RowAction<ContentItem>[] = [
    { id: 'edit', labelEn: 'Edit', labelFa: t('edit'), icon: '✎', onClick: item => setEditing(item) },
    { id: 'del', labelEn: 'Delete', labelFa: t('del'), icon: '🗑', danger: true, onClick: item => del(item.id) },
  ]

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
            <h3 className="text-lg font-bold text-text-primary mb-4">{editing.id ? t('editContent') : t('newContent')}</h3>
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
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-text-secondary mb-1 block">{t('contentMarkdown')}</label>
                <textarea value={editing.contentEn || ''} onChange={e2 => setEditing(e => ({ ...e, contentEn: e2.target.value }))} rows={8}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none font-mono" />
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

      <Card>
        <DataTable
          tableId="content"
          columns={columns}
          rows={items}
          locale={locale}
          loading={loading}
          rowKey={item => String(item.id)}
          rowActions={rowActions}
          exportName="content"
          emptyLabel="No content yet"
          quickCreate={{ labelEn: 'Add Content', labelFa: t('addContent'), onClick: () => setEditing({ type: 'blog', status: 'draft', featured: false }) }}
        />
      </Card>
    </div>
  )
}
