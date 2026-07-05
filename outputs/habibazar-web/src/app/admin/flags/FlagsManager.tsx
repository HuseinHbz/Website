'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, Input, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

interface Flag {
  id?: number; key: string; description: string | null; enabled: boolean; rolloutPercent: number
  evaluatedForMe?: boolean
}
const EMPTY: Flag = { key: '', description: '', enabled: false, rolloutPercent: 100 }

export function FlagsManager() {
  const t = useT()
  const { toast, ToastContainer } = useToast()
  const [flags, setFlags] = useState<Flag[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Flag>(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/flags')
      if (r.ok) { const d = await r.json(); setFlags(d.flags ?? []) }
    } catch { toast(t('flag_loadFail'), 'error') } finally { setLoading(false) }
  }, [toast, t])
  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    try {
      const r = await fetch('/api/admin/flags', { method: editing.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error) }
      toast(t('flag_savedOk'), 'success'); setModal(false); load()
    } catch (e) { toast(e instanceof Error && e.message ? e.message : t('flag_saveFail'), 'error') } finally { setSaving(false) }
  }
  async function toggle(f: Flag) {
    try {
      const r = await fetch('/api/admin/flags', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: f.id, key: f.key, enabled: !f.enabled }) })
      if (r.ok) load()
    } catch { /* ignore */ }
  }
  async function del(id: number) {
    if (!confirm(t('flag_confirmDel'))) return
    try {
      const r = await fetch('/api/admin/flags', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      if (!r.ok) throw new Error()
      toast(t('flag_deletedOk'), 'success'); load()
    } catch { toast(t('flag_delFail'), 'error') }
  }
  function set<K extends keyof Flag>(k: K, v: Flag[K]) { setEditing((e) => ({ ...e, [k]: v })) }

  return (
    <>
      <ToastContainer />
      <PageHeader
        title={t('flag_title')}
        subtitle={t('flag_subtitle')}
        action={<Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>{t('flag_newFlag')}</Btn>}
      />

      <Card className="p-0 overflow-hidden">
        {loading ? <p className="text-sm text-text-tertiary p-5">{t('flag_loading')}</p>
          : flags.length === 0 ? <p className="text-sm text-text-tertiary p-5">{t('flag_empty')}</p>
          : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-text-tertiary text-left border-b border-subtle">
                {[t('flag_colKey'), t('flag_colDescription'), t('flag_colRollout'), t('flag_colState'), t('flag_colForYou'), t('flag_colActions')].map((h) => <th key={h} className="px-4 py-2 text-xs font-medium">{h}</th>)}
              </tr></thead>
              <tbody>
                {flags.map((f) => (
                  <tr key={f.id} className="border-b border-subtle/50">
                    <td className="px-4 py-2.5 font-mono text-text-primary">{f.key}</td>
                    <td className="px-4 py-2.5 text-text-tertiary text-xs max-w-xs truncate">{f.description || '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-sunken overflow-hidden"><div className="h-full rounded-full bg-brand" style={{ width: `${f.rolloutPercent}%` }} /></div>
                        <span className="text-xs text-text-secondary">{f.rolloutPercent}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => toggle(f)} className={`relative w-9 h-5 rounded-full transition-colors ${f.enabled ? 'bg-success' : 'bg-surface-2'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${f.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-2.5"><Badge color={f.evaluatedForMe ? 'green' : 'slate'}>{f.evaluatedForMe ? t('flag_on') : t('flag_off')}</Badge></td>
                    <td className="px-4 py-2.5"><div className="flex gap-2">
                      <Btn size="sm" variant="secondary" onClick={() => { setEditing(f); setModal(true) }}>{t('flag_edit')}</Btn>
                      <Btn size="sm" variant="danger" onClick={() => del(f.id!)}>{t('flag_del')}</Btn>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-[11px] text-text-tertiary mt-3">{t('flag_footnote')} <span className="font-mono">isEnabled(flag, subjectId)</span>.</p>

      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? t('flag_editFlag') : t('flag_newFlag')} size="md">
        <div className="space-y-4">
          <Input label={t('flag_keyL')} value={editing.key} onChange={(v) => set('key', v)} placeholder="new_dashboard" />
          <Input label={t('flag_descriptionL')} value={editing.description || ''} onChange={(v) => set('description', v)} multiline rows={2} />
          <Input label={t('flag_rolloutL')} type="number" value={String(editing.rolloutPercent)} onChange={(v) => set('rolloutPercent', Math.max(0, Math.min(100, Number(v) || 0)))} />
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" checked={editing.enabled} onChange={(e) => set('enabled', e.target.checked)} /> {t('flag_enabled')}
          </label>
          <div className="flex gap-3">
            <Btn onClick={save} disabled={saving}>{saving ? t('flag_saving') : t('flag_save')}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>{t('flag_cancel')}</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
