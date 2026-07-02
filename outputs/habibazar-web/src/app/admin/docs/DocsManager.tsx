'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, Badge, Input, Select, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

type Doc = { id: number; slug: string; titleEn: string; type: string; version: string | null; status: string; featured: boolean; views: number; helpful: number; sortOrder: number }

const TYPES = ['docs', 'api', 'runbook', 'tutorial', 'guide', 'release']
const STATUSES = ['draft', 'published', 'archived']

export function DocsManager() {
  const t = useT()
  const [docList, setDocList] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Doc & { contentEn: string; excerptEn: string }> | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('all')
  const { toast, ToastContainer } = useToast()

  async function load() { setLoading(true); const r = await fetch('/api/admin/docs'); setDocList(await r.json()); setLoading(false) }
  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return; setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/docs', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    if (res.ok) { toast(t('saved'), 'success'); setEditing(null); load() } else toast(t('failed'), 'error')
    setSaving(false)
  }

  const filtered = filter === 'all' ? docList : docList.filter(d => d.type === filter)

  const TYPE_ICONS: Record<string, string> = { docs: '📄', api: '⚡', runbook: '📋', tutorial: '📖', guide: '🏛️', release: '📦' }

  return (
    <div>
      <ToastContainer />
      <PageHeader title={t('docsTitle')} subtitle={`${docList.length} documents · ${docList.filter(d => d.status === 'published').length} published`}
        action={<Btn onClick={() => setEditing({ type: 'docs', status: 'draft', version: 'latest', sortOrder: docList.length + 1 })}>{t('addDoc')}</Btn>} />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-2xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4">{editing.id ? t('editDoc') : t('newDoc')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Input label="Slug" value={editing.slug || ''} onChange={v => setEditing(e => ({ ...e, slug: v }))} /></div>
              <div className="col-span-2"><Input label={t('titleEn')} value={editing.titleEn || ''} onChange={v => setEditing(e => ({ ...e, titleEn: v }))} /></div>
              <Select label={t('type')} value={editing.type || 'docs'} onChange={v => setEditing(e => ({ ...e, type: v }))} options={TYPES.map(tp => ({ value: tp, label: tp }))} />
              <Select label="Status" value={editing.status || 'draft'} onChange={v => setEditing(e => ({ ...e, status: v }))} options={STATUSES.map(s => ({ value: s, label: s }))} />
              <Input label={t('version')} value={editing.version || ''} onChange={v => setEditing(e => ({ ...e, version: v }))} />
              <Input label={t('sortOrder')} type="number" value={String(editing.sortOrder || 0)} onChange={v => setEditing(e => ({ ...e, sortOrder: parseInt(v) || 0 }))} />
              <div className="col-span-2">
                <label className="text-xs text-text-secondary mb-1 block">{t('excerpt')}</label>
                <textarea value={editing.excerptEn || ''} onChange={e2 => setEditing(e => ({ ...e, excerptEn: e2.target.value }))} rows={2}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white outline-none" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-text-secondary mb-1 block">{t('contentMarkdown')}</label>
                <textarea value={editing.contentEn || ''} onChange={e2 => setEditing(e => ({ ...e, contentEn: e2.target.value }))} rows={10}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white outline-none font-mono" />
              </div>
            </div>
            <div className="flex gap-3 mt-6"><Btn onClick={save} disabled={saving}>{saving ? t('saving') : t('save')}</Btn><Btn variant="ghost" onClick={() => setEditing(null)}>{t('cancel')}</Btn></div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {['all', ...TYPES].map(tp => (
          <button key={tp} onClick={() => setFilter(tp)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === tp ? 'bg-brand text-white' : 'bg-white/5 text-text-secondary hover:text-white'}`}>
            {TYPE_ICONS[tp] || '📚'} {tp}
          </button>
        ))}
      </div>

      <Card>
        {loading ? <div className="text-center py-8 text-text-tertiary">{t('loading')}</div> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left">{[t('document'), t('type'), t('version'), t('status'), t('views'), t('actions')].map(h => <th key={h} className="px-4 py-3 text-text-tertiary font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3"><div className="font-medium text-white">{d.titleEn}</div><div className="text-xs text-text-tertiary">{d.slug}</div></td>
                  <td className="px-4 py-3 text-text-secondary">{TYPE_ICONS[d.type]} {d.type}</td>
                  <td className="px-4 py-3 text-text-secondary font-mono text-xs">{d.version || '—'}</td>
                  <td className="px-4 py-3"><Badge color={d.status === 'published' ? 'green' : d.status === 'draft' ? 'yellow' : 'slate'}>{d.status}</Badge></td>
                  <td className="px-4 py-3 text-text-secondary">{d.views}</td>
                  <td className="px-4 py-3"><Btn size="sm" variant="ghost" onClick={() => setEditing(d)}>{t('edit')}</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
