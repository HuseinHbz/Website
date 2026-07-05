'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'

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
    } catch { toast('Failed to load workflows', 'error') } finally { setLoading(false) }
  }, [toast])
  useEffect(() => { load() }, [load])

  function set<K extends keyof Workflow>(k: K, v: Workflow[K]) { setEditing((e) => ({ ...e, [k]: v })) }

  async function save() {
    // client-side JSON sanity before hitting the API (which fully validates)
    try { JSON.parse(editing.definition) } catch { toast('Definition is not valid JSON', 'error'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/admin/workflows', {
        method: editing.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'save failed')
      toast('Workflow saved', 'success'); setModal(false); load()
    } catch (e) { toast(e instanceof Error ? e.message : 'Save failed', 'error') } finally { setSaving(false) }
  }

  async function del(id: number) {
    if (!confirm('Delete this workflow and its run history?')) return
    try {
      const r = await fetch('/api/admin/workflows', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      if (!r.ok) throw new Error()
      toast('Deleted', 'success'); load()
    } catch { toast('Delete failed', 'error') }
  }

  async function run(w: Workflow) {
    let input: unknown = {}
    try { input = JSON.parse(runInput || '{}') } catch { toast('Run input is not valid JSON', 'error'); return }
    try {
      const r = await fetch('/api/admin/workflows/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: w.id, input }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'run failed')
      toast(`Run ${d.status} in ${d.steps} steps`, d.status === 'failed' ? 'error' : 'success')
      if (runsFor?.id === w.id) openRuns(w)
    } catch (e) { toast(e instanceof Error ? e.message : 'Run failed', 'error') }
  }

  async function openRuns(w: Workflow) {
    setRunsFor(w); setRuns([])
    try {
      const r = await fetch(`/api/admin/workflows/run?workflowId=${w.id}`)
      if (r.ok) { const d = await r.json(); setRuns(d.runs ?? []) }
    } catch { toast('Failed to load runs', 'error') }
  }

  return (
    <>
      <ToastContainer />
      <PageHeader
        title="Workflow Designer"
        subtitle="Script-less, versioned business workflows — sequential, conditional, approval & task nodes, executed by a deterministic engine."
        action={<Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>New Workflow</Btn>}
      />

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <p className="text-sm text-text-tertiary p-5">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-text-tertiary p-5">No workflows yet. Click “New Workflow” to design one.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-text-tertiary text-left border-b border-subtle">
                {['Workflow', 'Key', 'Status', 'Version', 'Runs', 'Actions'].map((h) => <th key={h} className="px-4 py-2 text-xs font-medium">{h}</th>)}
              </tr></thead>
              <tbody>
                {items.map((w) => (
                  <tr key={w.id} className="border-b border-subtle/50">
                    <td className="px-4 py-2.5"><div className="font-medium text-text-primary">{w.nameEn}</div><div className="text-xs text-text-tertiary">{w.nameFa || '—'}</div></td>
                    <td className="px-4 py-2.5 text-text-tertiary text-xs font-mono">{w.key}</td>
                    <td className="px-4 py-2.5"><Badge color={statusColor(w.status)}>{w.status}</Badge></td>
                    <td className="px-4 py-2.5 text-text-secondary text-xs">v{w.version}</td>
                    <td className="px-4 py-2.5 text-text-secondary text-xs">{w.runs ?? 0}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-2 flex-wrap">
                        <Btn size="sm" onClick={() => run(w)}>Run</Btn>
                        <Btn size="sm" variant="secondary" onClick={() => openRuns(w)}>History</Btn>
                        <Btn size="sm" variant="secondary" onClick={() => { setEditing({ ...w, nameFa: w.nameFa ?? '', description: w.description ?? '' }); setModal(true) }}>Edit</Btn>
                        <Btn size="sm" variant="danger" onClick={() => del(w.id!)}>Del</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Editor */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? 'Edit Workflow' : 'New Workflow'} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Key *" value={editing.key} onChange={(v) => set('key', v)} placeholder="expense-approval" />
            <Select label="Status" value={editing.status} onChange={(v) => set('status', v as Status)} options={STATUSES.map((s) => ({ value: s, label: s }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Name (EN) *" value={editing.nameEn} onChange={(v) => set('nameEn', v)} />
            <Input label="Name (FA)" value={editing.nameFa || ''} onChange={(v) => set('nameFa', v)} />
          </div>
          <Input label="Description" value={editing.description || ''} onChange={(v) => set('description', v)} multiline rows={2} />
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-text-secondary">Definition (JSON graph)</label>
              <button type="button" onClick={() => set('definition', STARTER)} className="text-xs text-brand hover:underline">Reset to starter template</button>
            </div>
            <textarea
              value={editing.definition}
              onChange={(e) => set('definition', e.target.value)}
              rows={16}
              spellCheck={false}
              className="w-full font-mono text-xs bg-background border border-border rounded-lg p-3 text-text-primary"
            />
            <p className="text-xs text-text-tertiary mt-1">Node types: start · end · set · condition · log · task · delay · approval. Saved after structural validation; the graph version bumps on change.</p>
          </div>
          <div className="flex gap-3">
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Workflow'}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>Cancel</Btn>
          </div>
        </div>
      </Modal>

      {/* Run history */}
      <Modal open={!!runsFor} onClose={() => setRunsFor(null)} title={runsFor ? `Runs — ${runsFor.nameEn}` : ''} size="xl">
        <div className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1"><Input label="Run input (JSON)" value={runInput} onChange={setRunInput} /></div>
            <Btn onClick={() => runsFor && run(runsFor)}>Run now</Btn>
          </div>
          {runs.length === 0 ? (
            <p className="text-sm text-text-tertiary">No runs yet.</p>
          ) : runs.map((r) => (
            <div key={r.id} className="rounded-lg border border-subtle p-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge color={runColor(r.status)}>{r.status}</Badge>
                <span className="text-xs text-text-tertiary">#{r.id} · {r.steps} steps{r.waitingNode ? ` · waiting @ ${r.waitingNode}` : ''}</span>
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
