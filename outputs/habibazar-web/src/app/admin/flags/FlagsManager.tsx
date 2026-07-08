'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, Input, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'
import type { RowAction } from '@/components/admin/DataTable'

interface Flag {
  id?: number; key: string; description: string | null; enabled: boolean; rolloutPercent: number
  evaluatedForMe?: boolean
}
const EMPTY: Flag = { key: '', description: '', enabled: false, rolloutPercent: 100 }

export function FlagsManager() {
  const t = useT()
  const locale = useAdminLocale()
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

  const columns: Column<Flag>[] = [
    { key: 'key', labelEn: 'Key', labelFa: t('flag_colKey'), render: (f) => <span className="font-mono text-text-primary">{f.key}</span> },
    { key: 'description', labelEn: 'Description', labelFa: t('flag_colDescription'), render: (f) => <span className="text-text-tertiary text-xs">{f.description || '—'}</span> },
    {
      key: 'rolloutPercent', labelEn: 'Rollout', labelFa: t('flag_colRollout'), type: 'number', numeric: true,
      render: (f) => (
        <div className="flex items-center gap-2 justify-end">
          <div className="h-1.5 w-16 rounded-full bg-sunken overflow-hidden"><div className="h-full rounded-full bg-brand" style={{ width: `${f.rolloutPercent}%` }} /></div>
          <span className="text-xs text-text-secondary tabular-nums">{f.rolloutPercent}%</span>
        </div>
      ),
    },
    {
      key: 'enabled', labelEn: 'State', labelFa: t('flag_colState'), type: 'boolean', value: (f) => f.enabled,
      render: (f) => (
        <button onClick={() => toggle(f)} className={`relative w-9 h-5 rounded-full transition-colors ${f.enabled ? 'bg-success' : 'bg-surface-2'}`} aria-pressed={f.enabled}>
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${f.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      ),
    },
    { key: 'evaluatedForMe', labelEn: 'For you', labelFa: t('flag_colForYou'), type: 'boolean', value: (f) => !!f.evaluatedForMe, render: (f) => <Badge color={f.evaluatedForMe ? 'green' : 'slate'}>{f.evaluatedForMe ? t('flag_on') : t('flag_off')}</Badge> },
  ]
  const rowActions: RowAction<Flag>[] = [
    { id: 'edit', labelEn: 'Edit', labelFa: t('flag_edit'), icon: '✎', onClick: (f) => { setEditing(f); setModal(true) } },
    { id: 'del', labelEn: 'Delete', labelFa: t('flag_del'), icon: '🗑', danger: true, onClick: (f) => del(f.id!) },
  ]

  return (
    <>
      <ToastContainer />
      <PageHeader
        title={t('flag_title')}
        subtitle={t('flag_subtitle')}
        action={<Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>{t('flag_newFlag')}</Btn>}
      />

      <Card className="p-4">
        <DataTable
          tableId="flags"
          columns={columns}
          rows={flags}
          locale={locale}
          loading={loading}
          rowKey={(f) => String(f.id)}
          rowActions={rowActions}
          exportName="feature-flags"
          emptyLabel={t('flag_empty')}
          quickCreate={{ labelEn: 'New Flag', labelFa: t('flag_newFlag'), onClick: () => { setEditing(EMPTY); setModal(true) } }}
        />
      </Card>
      <p className="text-2xs text-text-tertiary mt-3">{t('flag_footnote')} <span className="font-mono">isEnabled(flag, subjectId)</span>.</p>

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
