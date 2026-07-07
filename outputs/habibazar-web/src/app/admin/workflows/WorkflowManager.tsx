'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { WorkflowCanvas } from './WorkflowCanvas'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

type Status = 'draft' | 'active' | 'archived'
interface Workflow {
  id?: number; key: string; nameEn: string; nameFa: string | null; description: string | null
  definition: string; version?: number; status: Status; runs?: number
}
interface Run {
  id: number; status: 'completed' | 'waiting' | 'failed'; steps: number; waitingNode: string | null
  error: string | null; startedAt: string; log: string; variables: string
}

const STARTER = JSON.stringify({
  version: 1,
  start: 'start',
  nodes: [
    { id: 'start', type: 'start', next: 'check' },
    { id: 'check', type: 'condition', variable: 'amount', op: 'gte', value: 1000, whenTrue: 'approve', whenFalse: 'auto' },
    { id: 'approve', type: 'approval', label: 'Manager approval required', next: 'notify' },
    { id: 'auto', type: 'log', message: 'Auto-approved (under threshold)', next: 'notify' },
    { id: 'notify', type: 'task', action: 'notify', config: { message: 'Workflow finished' }, next: 'end' },
    { id: 'end', type: 'end' },
  ],
}, null, 2)

const EMPTY: Workflow = { key: '', nameEn: '', nameFa: '', description: '', definition: STARTER, status: 'draft' }
const STATUSES: Status[] = ['draft', 'active', 'archived']

function statusColor(s: Status) { return s === 'active' ? 'green' : s === 'archived' ? 'slate' : 'yellow' }
function runColor(s: Run['status']) { return s === 'completed' ? 'green' : s === 'waiting' ? 'yellow' : 'red' }

export function WorkflowManager() {
  const t = useT()
  const locale = useAdminLocale()
  const { toast, ToastContainer } = useToast()
  const [items, setItems] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Workflow>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [runsFor, setRunsFor] = useState<Workflow | null>(null)
  const [runs, setRuns] = useState<Run[]>([])
  const [runInput, setRunInput] = useState('{ "amount": 500 }')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/workflows')
      if (r.ok) { const d = await r.json(); setItems(d.workflows ?? []) }
    } catch { toast(t('wf_loadFail'), 'error') } finally { setLoading(false) }
  }, [toast, t])
  useEffect(() => { load() }, [load])

  function set<K extends keyof Workflow>(k: K, v: Workflow[K]) { setEditing((e) => ({ ...e, [k]: v })) }

  async function save() {
    // client-side JSON sanity before hitting the API (which fully validates)
    try { JSON.parse(editing.definition) } catch { toast(t('wf_jsonInvalid'), 'error'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/admin/workflows', {
        method: editing.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'save failed')
      toast(t('wf_savedOk'), 'success'); setModal(false); load()
    } catch (e) { toast(e instanceof Error ? e.message : t('wf_saveFail'), 'error') } finally { setSaving(false) }
  }

  async function del(id: number) {
    if (!confirm(t('wf_confirmDel'))) return
    try {
      const r = await fetch('/api/admin/workflows', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      if (!r.ok) throw new Error()
      toast(t('wf_deleted'), 'success'); load()
    } catch { toast(t('wf_delFail'), 'error') }
  }

  async function run(w: Workflow) {
    let input: unknown = {}
    try { input = JSON.parse(runInput || '{}') } catch { toast(t('wf_runInvalidInput'), 'error'); return }
    try {
      const r = await fetch('/api/admin/workflows/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: w.id, input }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'run failed')
      toast(`${t('wf_run')}: ${d.status} · ${d.steps} ${t('wf_steps')}`, d.status === 'failed' ? 'error' : 'success')
      if (runsFor?.id === w.id) openRuns(w)
    } catch (e) { toast(e instanceof Error ? e.message : t('wf_runFail'), 'error') }
  }

  async function openRuns(w: Workflow) {
    setRunsFor(w); setRuns([])
    try {
      const r = await fetch(`/api/admin/workflows/run?workflowId=${w.id}`)
      if (r.ok) { const d = await r.json(); setRuns(d.runs ?? []) }
    } catch { toast(t('wf_loadRunsFail'), 'error') }
  }

  const columns: Column<Workflow>[] = [
    { key: 'nameEn', labelEn: 'Workflow', labelFa: t('wf_colWorkflow'), render: w => <div><div className="font-medium text-text-primary">{w.nameEn}</div><div className="text-xs text-text-tertiary">{w.nameFa || '—'}</div></div> },
    { key: 'key', labelEn: 'Key', labelFa: t('wf_colKey'), render: w => <span className="text-text-tertiary text-xs font-mono">{w.key}</span> },
    { key: 'status', labelEn: 'Status', labelFa: t('wf_colStatus'), type: 'enum', options: STATUSES.map(s => ({ value: s, labelEn: s, labelFa: s })), render: w => <Badge color={statusColor(w.status)}>{w.status}</Badge> },
    { key: 'version', labelEn: 'Version', labelFa: t('wf_colVersion'), type: 'number', numeric: true, render: w => <span className="text-text-secondary text-xs">v{w.version}</span> },
    { key: 'runs', labelEn: 'Runs', labelFa: t('wf_colRuns'), type: 'number', numeric: true, value: w => w.runs ?? 0, render: w => <span className="text-text-secondary text-xs">{w.runs ?? 0}</span> },
  ]
  const rowActions: RowAction<Workflow>[] = [
    { id: 'run', labelEn: 'Run', labelFa: t('wf_run'), icon: '▶', onClick: w => run(w) },
    { id: 'history', labelEn: 'History', labelFa: t('wf_history'), icon: '🕓', onClick: w => openRuns(w) },
    { id: 'edit', labelEn: 'Edit', labelFa: t('wf_edit'), icon: '✎', onClick: w => { setEditing({ ...w, nameFa: w.nameFa ?? '', description: w.description ?? '' }); setModal(true) } },
    { id: 'del', labelEn: 'Delete', labelFa: t('wf_del'), icon: '🗑', danger: true, onClick: w => del(w.id!) },
  ]

  return (
    <>
      <ToastContainer />
      <PageHeader
        title={t('wf_title')}
        subtitle={t('wf_subtitle')}
        action={<Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>{t('wf_newWorkflow')}</Btn>}
      />

      <Card className="p-4">
        <DataTable
          tableId="workflows"
          columns={columns}
          rows={items}
          locale={locale}
          loading={loading}
          rowKey={w => String(w.id)}
          rowActions={rowActions}
          exportName="workflows"
          emptyLabel={t('wf_empty')}
          quickCreate={{ labelEn: 'New Workflow', labelFa: t('wf_newWorkflow'), onClick: () => { setEditing(EMPTY); setModal(true) } }}
        />
      </Card>

      {/* Editor */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? t('wf_editWorkflow') : t('wf_newWorkflow')} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('wf_keyL')} value={editing.key} onChange={(v) => set('key', v)} placeholder="expense-approval" />
            <Select label={t('wf_statusL')} value={editing.status} onChange={(v) => set('status', v as Status)} options={STATUSES.map((s) => ({ value: s, label: s }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('wf_nameEnL')} value={editing.nameEn} onChange={(v) => set('nameEn', v)} />
            <Input label={t('wf_nameFaL')} value={editing.nameFa || ''} onChange={(v) => set('nameFa', v)} />
          </div>
          <Input label={t('wf_description')} value={editing.description || ''} onChange={(v) => set('description', v)} multiline rows={2} />
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-text-secondary">{t('wf_definition')}</label>
              <button type="button" onClick={() => set('definition', STARTER)} className="text-xs text-brand hover:underline">{t('wf_resetStarter')}</button>
            </div>
            <WorkflowCanvas value={editing.definition} onChange={(v) => set('definition', v)} />
            <p className="text-xs text-text-tertiary mt-1">{t('wf_nodeHint')}</p>
          </div>
          <div className="flex gap-3">
            <Btn onClick={save} disabled={saving}>{saving ? t('wf_saving') : t('wf_save')}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>{t('wf_cancel')}</Btn>
          </div>
        </div>
      </Modal>

      {/* Run history */}
      <Modal open={!!runsFor} onClose={() => setRunsFor(null)} title={runsFor ? `${t('wf_colRuns')} — ${runsFor.nameEn}` : ''} size="xl">
        <div className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1"><Input label={t('wf_runsInput')} value={runInput} onChange={setRunInput} /></div>
            <Btn onClick={() => runsFor && run(runsFor)}>{t('wf_runNow')}</Btn>
          </div>
          {runs.length === 0 ? (
            <p className="text-sm text-text-tertiary">{t('wf_noRuns')}</p>
          ) : runs.map((r) => (
            <div key={r.id} className="rounded-lg border border-subtle p-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge color={runColor(r.status)}>{r.status}</Badge>
                <span className="text-xs text-text-tertiary">#{r.id} · {r.steps} {t('wf_steps')}{r.waitingNode ? ` · ${t('wf_waitingAt')} ${r.waitingNode}` : ''}</span>
                <span className="text-xs text-text-tertiary ml-auto">{r.startedAt}</span>
              </div>
              {r.error && <p className="text-xs text-danger mb-1">{r.error}</p>}
              <pre className="text-[11px] text-text-secondary bg-background rounded p-2 overflow-x-auto max-h-40">{
                (() => { try { return (JSON.parse(r.log) as { node: string; message: string }[]).map((l) => `• ${l.node}: ${l.message}`).join('\n') } catch { return r.log } })()
              }</pre>
            </div>
          ))}
        </div>
      </Modal>
    </>
  )
}
