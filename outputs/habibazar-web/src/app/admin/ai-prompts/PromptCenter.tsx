'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Btn, Input, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { extractVariables, renderPrompt } from '@/lib/ai/prompts'

interface Prompt {
  id: number; key: string; nameEn: string; nameFa: string | null; category: string
  description: string | null; currentVersion: number; activeVersion: number; status: string; activeBody?: string
}
interface Version { id: number; version: number; body: string; note: string | null; createdAt: string }

const EMPTY = { key: '', nameEn: '', nameFa: '', category: 'general', description: '', body: '' }

function statusColor(s: string) { return s === 'approved' ? 'green' : s === 'archived' ? 'slate' : 'yellow' }

export function PromptCenter() {
  const t = useT()
  const fa = useAdminLocale() === 'fa'
  const { toast, ToastContainer } = useToast()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [draft, setDraft] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)

  // detail view
  const [detail, setDetail] = useState<Prompt | null>(null)
  const [versions, setVersions] = useState<Version[]>([])
  const [newBody, setNewBody] = useState('')
  const [note, setNote] = useState('')
  const [testVars, setTestVars] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/ai/prompts')
      if (r.ok) { const d = await r.json(); setPrompts(d.prompts ?? []) }
    } catch { toast(t('apr_loadFail'), 'error') } finally { setLoading(false) }
  }, [toast, t])
  useEffect(() => { load() }, [load])

  const openDetail = useCallback(async (p: Prompt) => {
    setDetail(p); setVersions([]); setNewBody(''); setNote(''); setTestVars({})
    try {
      const r = await fetch(`/api/admin/ai/prompts?id=${p.id}`)
      if (r.ok) { const d = await r.json(); setDetail(d.prompt); setVersions(d.versions ?? []) }
    } catch { toast(t('apr_loadFail'), 'error') }
  }, [toast, t])

  async function create() {
    if (!draft.key.trim() || !draft.nameEn.trim() || !draft.body.trim()) return
    setSaving(true)
    try {
      const r = await fetch('/api/admin/ai/prompts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'failed')
      toast(t('apr_created'), 'success'); setCreateOpen(false); setDraft({ ...EMPTY }); load()
    } catch (e) { toast(e instanceof Error ? e.message : t('apr_saveFail'), 'error') } finally { setSaving(false) }
  }

  async function op(body: Record<string, unknown>, okMsg: string) {
    try {
      const r = await fetch('/api/admin/ai/prompts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'failed')
      toast(okMsg, 'success')
      if (detail) openDetail(detail); load()
    } catch (e) { toast(e instanceof Error ? e.message : t('apr_saveFail'), 'error') }
  }

  async function del(id: number) {
    if (!confirm(t('apr_confirmDel'))) return
    try {
      const r = await fetch('/api/admin/ai/prompts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      if (!r.ok) throw new Error()
      toast(t('apr_deleted'), 'success'); setDetail(null); load()
    } catch { toast(t('apr_saveFail'), 'error') }
  }

  const activeBody = useMemo(() => versions.find(v => v.version === detail?.activeVersion)?.body ?? '', [versions, detail])
  const vars = useMemo(() => extractVariables(activeBody), [activeBody])
  const preview = useMemo(() => renderPrompt(activeBody, testVars), [activeBody, testVars])

  if (detail) {
    return (
      <>
        <ToastContainer />
        <button onClick={() => setDetail(null)} className="text-xs text-brand hover:underline mb-3">{t('apr_back')}</button>
        <PageHeader
          title={fa ? (detail.nameFa || detail.nameEn) : detail.nameEn}
          subtitle={`${detail.key} · ${t('apr_active')} v${detail.activeVersion} / v${detail.currentVersion}`}
          action={
            <div className="flex gap-2">
              {detail.status !== 'approved' && <Btn size="sm" onClick={() => op({ id: detail.id, op: 'approve' }, t('apr_approved'))}>{t('apr_approve')}</Btn>}
              {detail.status !== 'archived' && <Btn size="sm" variant="secondary" onClick={() => op({ id: detail.id, op: 'archive' }, t('apr_archived'))}>{t('apr_archive')}</Btn>}
              <Btn size="sm" variant="danger" onClick={() => del(detail.id)}>{t('apr_delete')}</Btn>
            </div>
          }
        />
        <div className="mb-4"><Badge color={statusColor(detail.status)}>{detail.status}</Badge></div>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Add a new version */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3">{t('apr_newVersion')}</h3>
            <textarea value={newBody} onChange={e => setNewBody(e.target.value)} rows={8} placeholder={t('apr_bodyPh')} className="form-input w-full mb-2 font-mono text-xs" />
            <Input label={t('apr_note')} value={note} onChange={setNote} />
            <div className="mt-3"><Btn size="sm" disabled={!newBody.trim()} onClick={() => op({ id: detail.id, op: 'newVersion', body: newBody, note }, t('apr_versionAdded')).then(() => { setNewBody(''); setNote('') })}>{t('apr_saveVersion')}</Btn></div>
          </Card>

          {/* Test / preview the active version */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3">{t('apr_test')}</h3>
            {vars.length === 0 ? <p className="text-xs text-text-tertiary mb-2">{t('apr_noVars')}</p> : (
              <div className="space-y-2 mb-3">
                {vars.map(v => (
                  <div key={v}>
                    <label className="text-[11px] text-text-tertiary font-mono">{`{{${v}}}`}</label>
                    <input value={testVars[v] ?? ''} onChange={e => setTestVars(s => ({ ...s, [v]: e.target.value }))} className="form-input w-full !py-1.5" />
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-text-tertiary mb-1">{t('apr_preview')}</p>
            <pre className="text-[11px] text-text-secondary bg-background rounded p-2 whitespace-pre-wrap max-h-48 overflow-y-auto">{preview || '—'}</pre>
          </Card>
        </div>

        {/* Version history */}
        <Card className="p-5 mt-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t('apr_history')}</h3>
          <div className="space-y-2">
            {versions.map(v => (
              <div key={v.id} className="rounded-lg border border-subtle p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-text-primary">v{v.version}</span>
                  {v.version === detail.activeVersion && <Badge color="green">{t('apr_activeBadge')}</Badge>}
                  <span className="text-[11px] text-text-tertiary">{v.note || ''}</span>
                  <span className="text-[11px] text-text-tertiary ml-auto">{v.createdAt}</span>
                  {v.version !== detail.activeVersion && (
                    <Btn size="sm" variant="secondary" onClick={() => op({ id: detail.id, op: 'setActive', version: v.version }, t('apr_rolledBack'))}>{t('apr_makeActive')}</Btn>
                  )}
                </div>
                <pre className="text-[11px] text-text-secondary bg-background rounded p-2 whitespace-pre-wrap max-h-32 overflow-y-auto">{v.body}</pre>
              </div>
            ))}
          </div>
        </Card>
      </>
    )
  }

  return (
    <>
      <ToastContainer />
      <PageHeader title={t('apr_title')} subtitle={t('apr_subtitle')} action={<Btn onClick={() => { setDraft({ ...EMPTY }); setCreateOpen(true) }}>{t('apr_new')}</Btn>} />

      <Card className="p-0 overflow-hidden">
        {loading ? <p className="text-sm text-text-tertiary p-5">{t('apr_loading')}</p>
          : prompts.length === 0 ? <p className="text-sm text-text-tertiary p-5">{t('apr_empty')}</p>
          : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-text-tertiary text-left border-b border-subtle">
                {[t('apr_colName'), t('apr_colKey'), t('apr_colCategory'), t('apr_colVersion'), t('apr_colStatus')].map(h => <th key={h} className="px-4 py-2 text-xs font-medium">{h}</th>)}
              </tr></thead>
              <tbody>
                {prompts.map(p => (
                  <tr key={p.id} className="border-b border-subtle/50 cursor-pointer hover:bg-surface-2" onClick={() => openDetail(p)}>
                    <td className="px-4 py-2.5"><div className="font-medium text-text-primary">{fa ? (p.nameFa || p.nameEn) : p.nameEn}</div><div className="text-xs text-text-tertiary">{p.description || '—'}</div></td>
                    <td className="px-4 py-2.5 text-text-tertiary text-xs font-mono">{p.key}</td>
                    <td className="px-4 py-2.5 text-text-secondary text-xs">{p.category}</td>
                    <td className="px-4 py-2.5 text-text-secondary text-xs">v{p.activeVersion}/v{p.currentVersion}</td>
                    <td className="px-4 py-2.5"><Badge color={statusColor(p.status)}>{p.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('apr_new')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('apr_keyL')} value={draft.key} onChange={v => setDraft(s => ({ ...s, key: v }))} placeholder="seo-meta" />
            <Input label={t('apr_categoryL')} value={draft.category} onChange={v => setDraft(s => ({ ...s, category: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('apr_nameEnL')} value={draft.nameEn} onChange={v => setDraft(s => ({ ...s, nameEn: v }))} />
            <Input label={t('apr_nameFaL')} value={draft.nameFa} onChange={v => setDraft(s => ({ ...s, nameFa: v }))} />
          </div>
          <Input label={t('apr_descriptionL')} value={draft.description} onChange={v => setDraft(s => ({ ...s, description: v }))} />
          <div>
            <label className="form-label">{t('apr_bodyL')}</label>
            <textarea value={draft.body} onChange={e => setDraft(s => ({ ...s, body: e.target.value }))} rows={7} placeholder={t('apr_bodyPh')} className="form-input w-full font-mono text-xs" />
            <p className="text-[11px] text-text-tertiary mt-1">{t('apr_varsHint')}</p>
          </div>
          <div className="flex gap-3">
            <Btn onClick={create} disabled={saving}>{saving ? t('apr_saving') : t('apr_create')}</Btn>
            <Btn variant="secondary" onClick={() => setCreateOpen(false)}>{t('apr_cancel')}</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
