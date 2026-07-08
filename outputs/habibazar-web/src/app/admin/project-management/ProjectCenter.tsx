'use client'

import { useCallback, useEffect, useState } from 'react'
import { fmtMoney } from '@/lib/format'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

type Health = 'on_track' | 'at_risk' | 'overdue' | 'done'
type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'

interface Project { id?: number; code: string; name: string; customer: string | null; manager: string | null; status: string; startDate: string | null; endDate: string | null; budget: number; hourlyRate: number; notes?: string | null; progress?: number; health?: Health; taskCount?: number; doneCount?: number; loggedHours?: number; laborCost?: number }
interface Task { id: number; title: string; description: string | null; status: TaskStatus; priority: string; assignee: string | null; estimateHours: number; startDate: string | null; dueDate: string | null }
interface Milestone { id: number; name: string; dueDate: string | null; status: string }
interface Timesheet { id: number; person: string; date: string; hours: number; note: string | null; taskTitle: string | null }
interface GanttBar { id: number; offsetPct: number; widthPct: number; visible: boolean }
interface Detail { project: Project; tasks: Task[]; milestones: Milestone[]; timesheets: Timesheet[]; gantt: { bars: GanttBar[]; rangeStart: string; rangeEnd: string }; loggedHours: number }
interface Kpis { total: number; active: number; completed: number; budget: number; laborCost: number; budgetUsedPct: number; taskCompletion: number; atRisk: number }
interface Overview { kpis: Kpis; projects: Project[]; attention: Project[] }

const P_STATUSES = ['planning', 'active', 'on_hold', 'completed', 'cancelled']
const T_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'review', 'done']
const PRIORITIES = ['low', 'medium', 'high', 'urgent']
const HEALTH_COLOR: Record<Health, 'green' | 'yellow' | 'red' | 'blue'> = { on_track: 'green', at_risk: 'yellow', overdue: 'red', done: 'blue' }
const PRIO_COLOR: Record<string, 'slate' | 'blue' | 'yellow' | 'red'> = { low: 'slate', medium: 'blue', high: 'yellow', urgent: 'red' }
const money = (n: number | null | undefined) => fmtMoney(n, { max: 0 })
const EMPTY: Project = { code: '', name: '', customer: '', manager: '', status: 'planning', startDate: '', endDate: '', budget: 0, hourlyRate: 0, notes: '' }

export function ProjectCenter() {
  const t = useT()
  const { toast, ToastContainer } = useToast()
  const [detailId, setDetailId] = useState<number | null>(null)
  const [tab, setTab] = useState<'dashboard' | 'projects'>('dashboard')

  if (detailId) return <><ToastContainer /><ProjectDetail t={t} id={detailId} onBack={() => setDetailId(null)} toast={toast} /></>
  return (
    <>
      <ToastContainer />
      <PageHeader title={t('pm_title')} subtitle={t('pm_subtitle')} />
      <div className="flex gap-1 mb-6 border-b border-subtle">
        {(['dashboard', 'projects'] as const).map(tb => (
          <button key={tb} onClick={() => setTab(tb)} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === tb ? 'border-brand text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}>{t(`pm_tab_${tb}` as 'pm_tab_dashboard')}</button>
        ))}
      </div>
      {tab === 'dashboard' ? <Dashboard t={t} onOpen={setDetailId} /> : <Projects t={t} toast={toast} onOpen={setDetailId} />}
    </>
  )
}
type T = ReturnType<typeof useT>
type Toast = ReturnType<typeof useToast>['toast']

function ProgressBar({ pct }: { pct: number }) {
  return <div className="h-1.5 rounded-full bg-sunken overflow-hidden w-full"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, pct)}%` }} /></div>
}

function Dashboard({ t, onOpen }: { t: T; onOpen: (id: number) => void }) {
  const [d, setD] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { setLoading(true); try { const r = await fetch('/api/admin/erp/projects?overview=1'); if (r.ok) setD(await r.json()) } finally { setLoading(false) } }, [])
  useEffect(() => { load() }, [load])
  if (loading && !d) return <p className="text-sm text-text-tertiary">{t('pm_loading')}</p>
  if (!d) return <Card className="p-5"><p className="text-sm text-text-tertiary">{t('pm_empty')}</p></Card>
  const k = d.kpis
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label={t('pm_kTotal')} value={String(k.total)} icon="📁" />
        <Kpi label={t('pm_kActive')} value={String(k.active)} icon="🚀" tone="ok" />
        <Kpi label={t('pm_kCompleted')} value={String(k.completed)} icon="✅" />
        <Kpi label={t('pm_kAtRisk')} value={String(k.atRisk)} icon="⚠️" tone={k.atRisk ? 'warn' : undefined} />
        <Kpi label={t('pm_kBudget')} value={money(k.budget)} icon="💵" />
        <Kpi label={t('pm_kLabor')} value={money(k.laborCost)} icon="⏱️" />
        <Kpi label={t('pm_kBudgetUsed')} value={`${k.budgetUsedPct}%`} icon="📊" tone={k.budgetUsedPct > 100 ? 'bad' : undefined} />
        <Kpi label={t('pm_kTaskDone')} value={`${k.taskCompletion}%`} icon="☑️" />
      </div>
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{t('pm_projectsOverview')}</h3>
        {d.projects.length === 0 ? <p className="text-xs text-text-tertiary">{t('pm_empty')}</p> : (
          <div className="space-y-3">{d.projects.map(p => (
            <button key={p.id} onClick={() => onOpen(p.id!)} className="w-full text-start">
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-secondary w-48 truncate">{p.name}</span>
                <div className="flex-1"><ProgressBar pct={p.progress ?? 0} /></div>
                <span className="text-xs text-text-tertiary w-10 text-right">{p.progress ?? 0}%</span>
                <Badge color={HEALTH_COLOR[p.health ?? 'on_track']}>{t(`pm_h_${p.health}` as 'pm_h_on_track')}</Badge>
              </div>
            </button>
          ))}</div>
        )}
      </Card>
    </div>
  )
}
function Kpi({ label, value, icon, tone }: { label: string; value: string; icon: string; tone?: 'ok' | 'warn' | 'bad' }) {
  const ring = tone === 'ok' ? 'border-success/40' : tone === 'warn' ? 'border-warning/40' : tone === 'bad' ? 'border-danger/40' : 'border-subtle'
  return <div className={`rounded-xl p-4 bg-surface-2 border ${ring}`}><div className="flex items-center justify-between mb-1"><p className="text-xs text-text-tertiary">{label}</p><span aria-hidden>{icon}</span></div><p className="text-lg font-bold text-text-primary">{value}</p></div>
}
function CostKpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'warn' | 'bad' }) {
  const ring = tone === 'ok' ? 'border-success/40' : tone === 'warn' ? 'border-warning/40' : tone === 'bad' ? 'border-danger/40' : 'border-subtle'
  return <div className={`rounded-xl p-4 bg-surface-2 border ${ring}`}><p className="text-xs text-text-tertiary mb-1">{label}</p><p className="text-base font-bold text-text-primary">{value}</p>{sub && <p className="text-2xs text-text-tertiary mt-0.5">{sub}</p>}</div>
}

function Projects({ t, toast, onOpen }: { t: T; toast: Toast; onOpen: (id: number) => void }) {
  const locale = useAdminLocale()
  const [rows, setRows] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Project>(EMPTY)
  const [saving, setSaving] = useState(false)
  const load = useCallback(async () => { setLoading(true); try { const r = await fetch('/api/admin/erp/projects'); if (r.ok) { const d = await r.json(); setRows(d.projects ?? []) } } catch { toast(t('pm_loadFail'), 'error') } finally { setLoading(false) } }, [toast, t])
  useEffect(() => { load() }, [load])
  function set<K extends keyof Project>(k: K, v: Project[K]) { setEditing(e => ({ ...e, [k]: v })) }
  async function save() {
    if (!editing.code.trim() || !editing.name.trim()) return
    setSaving(true)
    try { const r = await fetch('/api/admin/erp/projects', { method: editing.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'failed'); toast(t('pm_saved'), 'success'); setModal(false); load() }
    catch (e) { toast(e instanceof Error ? e.message : t('pm_saveFail'), 'error') } finally { setSaving(false) }
  }
  const columns: Column<Project>[] = [
    { key: 'name', labelEn: 'Name', labelFa: t('pm_cName'), render: p => <div><div className="font-medium text-text-primary">{p.name}</div><div className="text-xs text-text-tertiary">{p.code}{p.customer ? ` · ${p.customer}` : ''}</div></div> },
    { key: 'status', labelEn: 'Status', labelFa: t('pm_cStatus'), type: 'enum', options: P_STATUSES.map(x => ({ value: x, labelEn: x, labelFa: t(`pm_s_${x}` as 'pm_s_planning') })), render: p => <Badge color="slate">{t(`pm_s_${p.status}` as 'pm_s_planning')}</Badge> },
    { key: 'progress', labelEn: 'Progress', labelFa: t('pm_cProgress'), type: 'number', numeric: true, value: p => p.progress ?? 0, render: p => <div className="flex items-center gap-2 w-40"><ProgressBar pct={p.progress ?? 0} /><span className="text-xs text-text-tertiary">{p.progress ?? 0}%</span></div> },
    { key: 'health', labelEn: 'Health', labelFa: t('pm_cHealth'), type: 'enum', value: p => p.health ?? 'on_track', render: p => <Badge color={HEALTH_COLOR[p.health ?? 'on_track']}>{t(`pm_h_${p.health}` as 'pm_h_on_track')}</Badge> },
    { key: 'loggedHours', labelEn: 'Hours', labelFa: t('pm_cHours'), type: 'number', numeric: true, value: p => p.loggedHours ?? 0, render: p => <span className="text-text-secondary text-xs">{p.loggedHours ?? 0}h</span> },
  ]
  const rowActions: RowAction<Project>[] = [{ id: 'edit', labelEn: 'Edit', labelFa: t('pm_edit'), icon: '✎', onClick: p => { setEditing({ ...p }); setModal(true) } }]
  return (
    <>
      <div className="flex justify-end mb-4"><Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>{t('pm_newProject')}</Btn></div>
      <Card className="p-4">
        <DataTable tableId="pm-projects" columns={columns} rows={rows} locale={locale} loading={loading} rowKey={p => String(p.id)} onRowClick={p => onOpen(p.id!)} rowActions={rowActions} exportName="projects" emptyLabel={t('pm_noProjects')} />
      </Card>
      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? t('pm_editProject') : t('pm_newProject')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4"><Input label={t('pm_fCode')} value={editing.code} onChange={v => set('code', v)} /><Input label={t('pm_fName')} value={editing.name} onChange={v => set('name', v)} /></div>
          <div className="grid grid-cols-3 gap-4"><Input label={t('pm_fCustomer')} value={editing.customer || ''} onChange={v => set('customer', v)} /><Input label={t('pm_fManager')} value={editing.manager || ''} onChange={v => set('manager', v)} /><Select label={t('pm_fStatus')} value={editing.status} onChange={v => set('status', v)} options={P_STATUSES.map(x => ({ value: x, label: t(`pm_s_${x}` as 'pm_s_planning') }))} /></div>
          <div className="grid grid-cols-4 gap-4"><Input label={t('pm_fStart')} type="date" value={editing.startDate || ''} onChange={v => set('startDate', v)} /><Input label={t('pm_fEnd')} type="date" value={editing.endDate || ''} onChange={v => set('endDate', v)} /><Input label={t('pm_fBudget')} type="number" value={String(editing.budget)} onChange={v => set('budget', Number(v) || 0)} /><Input label={t('pm_fRate')} type="number" value={String(editing.hourlyRate)} onChange={v => set('hourlyRate', Number(v) || 0)} /></div>
          <div className="flex gap-3"><Btn onClick={save} disabled={saving}>{saving ? t('pm_saving') : t('pm_save')}</Btn><Btn variant="secondary" onClick={() => setModal(false)}>{t('pm_cancel')}</Btn></div>
        </div>
      </Modal>
    </>
  )
}

interface CostingEntry { id: number; kind: 'cost' | 'revenue'; category: string; description: string | null; amount: number; date: string }
interface CostingSummary { totalCost: number; totalRevenue: number; profit: number; marginPct: number; isLoss: boolean; budget: number; variance: number; variancePct: number; overBudget: boolean; eac: number; vac: number; forecastOverrun: boolean }
interface Costing { summary: CostingSummary; entries: CostingEntry[]; laborFromTimesheets: number; progressPct: number }
const COST_CATS = ['labor', 'equipment', 'purchase', 'travel', 'expense', 'other']
const REV_CATS = ['sales', 'service', 'milestone', 'other']

function ProjectDetail({ t, id, onBack, toast }: { t: T; id: number; onBack: () => void; toast: Toast }) {
  const pdLocale = useAdminLocale()
  const [d, setD] = useState<Detail | null>(null)
  const [view, setView] = useState<'kanban' | 'gantt' | 'milestones' | 'timesheet' | 'costing'>('kanban')
  const [costing, setCosting] = useState<Costing | null>(null)
  const load = useCallback(async () => {
    const [r, c] = await Promise.all([fetch(`/api/admin/erp/projects?id=${id}`), fetch(`/api/admin/erp/projects/costing?id=${id}`)])
    if (r.ok) setD(await r.json()); if (c.ok) setCosting(await c.json())
  }, [id])
  useEffect(() => { load() }, [load])

  const [ceForm, setCeForm] = useState({ kind: 'cost' as 'cost' | 'revenue', category: 'purchase', description: '', amount: 0, date: new Date().toISOString().slice(0, 10) })
  async function addEntry() {
    if (ceForm.amount <= 0) return
    const r = await fetch('/api/admin/erp/projects/costing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: id, ...ceForm }) })
    if (r.ok) { toast(t('pm_saved'), 'success'); setCeForm(f => ({ ...f, description: '', amount: 0 })); load() } else { const dd = await r.json().catch(() => ({})); toast(dd.error || t('pm_saveFail'), 'error') }
  }
  async function delEntry(eid: number) { const r = await fetch('/api/admin/erp/projects/costing', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: eid }) }); if (r.ok) load() }

  const [taskModal, setTaskModal] = useState(false)
  const [task, setTask] = useState<Partial<Task>>({ status: 'todo', priority: 'medium', estimateHours: 0 })
  async function saveTask() {
    if (!task.title?.trim()) return
    const r = await fetch('/api/admin/erp/projects/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'task', projectId: id, ...task }) })
    if (r.ok) { toast(t('pm_saved'), 'success'); setTaskModal(false); setTask({ status: 'todo', priority: 'medium', estimateHours: 0 }); load() } else toast(t('pm_saveFail'), 'error')
  }
  async function moveTask(taskId: number, status: TaskStatus) { const r = await fetch('/api/admin/erp/projects/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'task-move', id: taskId, status }) }); if (r.ok) load() }
  async function delItem(kind: string, itemId: number) { const r = await fetch('/api/admin/erp/projects/items', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id: itemId }) }); if (r.ok) load() }

  const [mForm, setMForm] = useState({ name: '', dueDate: '' })
  async function addMilestone() { if (!mForm.name.trim()) return; const r = await fetch('/api/admin/erp/projects/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'milestone', projectId: id, ...mForm }) }); if (r.ok) { setMForm({ name: '', dueDate: '' }); load() } }
  const [tsForm, setTsForm] = useState({ person: '', date: new Date().toISOString().slice(0, 10), hours: 0, note: '' })
  async function addTimesheet() { if (!tsForm.person.trim() || tsForm.hours <= 0) return; const r = await fetch('/api/admin/erp/projects/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'timesheet', projectId: id, ...tsForm }) }); if (r.ok) { setTsForm({ person: '', date: new Date().toISOString().slice(0, 10), hours: 0, note: '' }); load() } }

  if (!d) return <p className="text-sm text-text-tertiary">{t('pm_loading')}</p>
  const p = d.project
  const cols: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], review: [], done: [] }
  for (const tk of d.tasks) cols[tk.status].push(tk)
  const barById = new Map(d.gantt.bars.map(b => [b.id, b]))

  return (
    <>
      <button onClick={onBack} className="text-xs text-brand hover:underline mb-3">{t('pm_back')}</button>
      <PageHeader title={p.name} subtitle={`${p.code}${p.customer ? ` · ${p.customer}` : ''} · ${p.progress}% · ${d.loggedHours}h`}
        action={<Badge color={HEALTH_COLOR[p.health ?? 'on_track']}>{t(`pm_h_${p.health}` as 'pm_h_on_track')}</Badge>} />
      <div className="mb-4"><ProgressBar pct={p.progress ?? 0} /></div>

      <div className="flex gap-1 mb-5 border-b border-subtle">
        {(['kanban', 'gantt', 'milestones', 'timesheet', 'costing'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${view === v ? 'border-brand text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}>{t(`pm_view_${v}` as 'pm_view_kanban')}</button>
        ))}
      </div>

      {view === 'kanban' && (
        <>
          <div className="flex justify-end mb-3"><Btn size="sm" onClick={() => setTaskModal(true)}>{t('pm_newTask')}</Btn></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {T_STATUSES.map(st => (
              <div key={st} className="rounded-xl bg-surface-2/50 border border-subtle p-3">
                <h4 className="text-xs font-semibold text-text-secondary mb-2 flex items-center justify-between">{t(`pm_ts_${st}` as 'pm_ts_todo')}<span className="text-text-tertiary">{cols[st].length}</span></h4>
                <div className="space-y-2">
                  {cols[st].map(tk => {
                    const si = T_STATUSES.indexOf(st)
                    return (
                      <div key={tk.id} className="rounded-lg bg-background border border-subtle p-2.5">
                        <div className="flex items-start justify-between gap-2"><span className="text-xs text-text-primary font-medium">{tk.title}</span><Badge color={PRIO_COLOR[tk.priority]}>{t(`pm_p_${tk.priority}` as 'pm_p_low')}</Badge></div>
                        {tk.assignee && <p className="text-2xs text-text-tertiary mt-1">{tk.assignee} · {tk.estimateHours}h</p>}
                        <div className="flex items-center gap-1 mt-2">
                          {si > 0 && <button onClick={() => moveTask(tk.id, T_STATUSES[si - 1])} className="text-2xs text-text-tertiary hover:text-brand">←</button>}
                          {si < 3 && <button onClick={() => moveTask(tk.id, T_STATUSES[si + 1])} className="text-2xs text-text-tertiary hover:text-brand">→</button>}
                          <button onClick={() => delItem('task', tk.id)} className="text-2xs text-danger hover:underline ml-auto">✕</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {view === 'gantt' && (
        <Card className="p-5">
          <p className="text-xs text-text-tertiary mb-3">{d.gantt.rangeStart} → {d.gantt.rangeEnd}</p>
          {d.tasks.length === 0 ? <p className="text-xs text-text-tertiary">{t('pm_noTasks')}</p> : (
            <div className="space-y-2">
              {d.tasks.map(tk => {
                const bar = barById.get(tk.id)
                return (
                  <div key={tk.id} className="flex items-center gap-3">
                    <span className="text-xs text-text-secondary w-40 truncate shrink-0">{tk.title}</span>
                    <div className="relative flex-1 h-5 rounded bg-sunken">
                      {bar?.visible ? <div className="absolute top-0.5 h-4 rounded bg-brand" style={{ left: `${bar.offsetPct}%`, width: `${bar.widthPct}%` }} title={`${tk.startDate} → ${tk.dueDate}`} /> : <span className="absolute inset-0 flex items-center justify-center text-3xs text-text-disabled">{t('pm_noDates')}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {view === 'milestones' && (
        <Card className="p-5">
          <div className="space-y-2 mb-4">
            {d.milestones.length === 0 ? <p className="text-xs text-text-tertiary">{t('pm_noMilestones')}</p> : d.milestones.map(m => (
              <div key={m.id} className="flex items-center justify-between text-sm border border-subtle rounded-lg p-2.5">
                <span className="text-text-secondary">◆ {m.name} <span className="text-text-tertiary text-xs">{m.dueDate || ''}</span></span>
                <div className="flex items-center gap-2"><Badge color={m.status === 'reached' ? 'green' : m.status === 'missed' ? 'red' : 'yellow'}>{t(`pm_mst_${m.status}` as 'pm_mst_open')}</Badge><button onClick={() => delItem('milestone', m.id)} className="text-xs text-danger hover:underline">✕</button></div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 items-end rounded-lg border border-subtle p-3">
            <div className="flex-1"><Input label={t('pm_fMilestone')} value={mForm.name} onChange={v => setMForm(f => ({ ...f, name: v }))} /></div>
            <Input label={t('pm_fDue')} type="date" value={mForm.dueDate} onChange={v => setMForm(f => ({ ...f, dueDate: v }))} />
            <Btn size="sm" onClick={addMilestone}>{t('pm_add')}</Btn>
          </div>
        </Card>
      )}

      {view === 'timesheet' && (
        <Card className="p-5">
          <div className="grid grid-cols-4 gap-2 items-end rounded-lg border border-subtle p-3 mb-4">
            <Input label={t('pm_fPerson')} value={tsForm.person} onChange={v => setTsForm(f => ({ ...f, person: v }))} />
            <Input label={t('pm_fDate')} type="date" value={tsForm.date} onChange={v => setTsForm(f => ({ ...f, date: v }))} />
            <Input label={t('pm_fHours')} type="number" value={String(tsForm.hours)} onChange={v => setTsForm(f => ({ ...f, hours: Number(v) || 0 }))} />
            <Btn size="sm" onClick={addTimesheet}>{t('pm_logTime')}</Btn>
          </div>
          <DataTable
            tableId="pm-timesheets"
            columns={[
              { key: 'date', labelEn: 'Date', labelFa: t('pm_fDate'), type: 'date', render: ts => <span className="text-text-tertiary text-xs">{ts.date}</span> },
              { key: 'person', labelEn: 'Person', labelFa: t('pm_fPerson'), render: ts => <span className="text-text-secondary">{ts.person}</span> },
              { key: 'taskTitle', labelEn: 'Task', labelFa: t('pm_cTask'), render: ts => <span className="text-text-tertiary text-xs">{ts.taskTitle || '—'}</span> },
              { key: 'hours', labelEn: 'Hours', labelFa: t('pm_fHours'), type: 'number', numeric: true, render: ts => <span className="text-text-secondary text-xs">{ts.hours}h</span> },
            ] as Column<Timesheet>[]}
            rows={d.timesheets}
            locale={pdLocale}
            rowKey={ts => String(ts.id)}
            exportName="timesheets"
            emptyLabel={t('pm_noTime')}
          />
        </Card>
      )}

      {view === 'costing' && (
        costing ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <CostKpi label={t('pm_cBudget')} value={money(costing.summary.budget)} />
              <CostKpi label={t('pm_cCost')} value={money(costing.summary.totalCost)} tone={costing.summary.overBudget ? 'bad' : undefined} />
              <CostKpi label={t('pm_cRevenue')} value={money(costing.summary.totalRevenue)} />
              <CostKpi label={costing.summary.isLoss ? t('pm_cLoss') : t('pm_cProfit')} value={money(costing.summary.profit)} tone={costing.summary.isLoss ? 'bad' : 'ok'} sub={`${costing.summary.marginPct}%`} />
              <CostKpi label={t('pm_cVariance')} value={money(costing.summary.variance)} tone={costing.summary.variance < 0 ? 'bad' : 'ok'} sub={`${costing.summary.variancePct}%`} />
              <CostKpi label={t('pm_cEac')} value={money(costing.summary.eac)} tone={costing.summary.forecastOverrun ? 'warn' : undefined} />
              <CostKpi label={t('pm_cVac')} value={money(costing.summary.vac)} tone={costing.summary.vac < 0 ? 'bad' : 'ok'} />
              <CostKpi label={t('pm_cLabor')} value={money(costing.laborFromTimesheets)} sub={`${costing.progressPct}%`} />
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <Card className="p-5">
                <h4 className="text-sm font-semibold text-text-primary mb-3">{t('pm_addEntry')}</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Select label={t('pm_ceKind')} value={ceForm.kind} onChange={v => setCeForm(f => ({ ...f, kind: v as 'cost' | 'revenue', category: v === 'cost' ? 'purchase' : 'sales' }))} options={[{ value: 'cost', label: t('pm_ce_cost') }, { value: 'revenue', label: t('pm_ce_revenue') }]} />
                    <Select label={t('pm_ceCategory')} value={ceForm.category} onChange={v => setCeForm(f => ({ ...f, category: v }))} options={(ceForm.kind === 'cost' ? COST_CATS : REV_CATS).map(x => ({ value: x, label: t(`pm_cat_${x}` as 'pm_cat_labor') }))} />
                  </div>
                  <Input label={t('pm_ceDesc')} value={ceForm.description} onChange={v => setCeForm(f => ({ ...f, description: v }))} />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label={t('pm_ceAmount')} type="number" value={String(ceForm.amount)} onChange={v => setCeForm(f => ({ ...f, amount: Number(v) || 0 }))} />
                    <Input label={t('pm_fDate')} type="date" value={ceForm.date} onChange={v => setCeForm(f => ({ ...f, date: v }))} />
                  </div>
                  <Btn size="sm" onClick={addEntry}>{t('pm_add')}</Btn>
                </div>
              </Card>
              <Card className="p-5">
                <h4 className="text-sm font-semibold text-text-primary mb-3">{t('pm_entries')}</h4>
                {costing.entries.length === 0 && costing.laborFromTimesheets === 0 ? <p className="text-xs text-text-tertiary">{t('pm_noEntries')}</p> : (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    {costing.laborFromTimesheets > 0 && <div className="flex items-center justify-between text-xs border-b border-subtle/50 pb-1.5"><span className="text-text-secondary">{t('pm_cat_labor')} <span className="text-text-tertiary">({t('pm_fromTimesheets')})</span></span><span className="text-danger-text">−{money(costing.laborFromTimesheets)}</span></div>}
                    {costing.entries.map(e => (
                      <div key={e.id} className="flex items-center justify-between text-xs">
                        <span className="text-text-secondary">{t(`pm_cat_${e.category}` as 'pm_cat_labor')}{e.description ? ` · ${e.description}` : ''} <span className="text-text-tertiary">{e.date}</span></span>
                        <div className="flex items-center gap-2"><span className={e.kind === 'revenue' ? 'text-success-text' : 'text-danger-text'}>{e.kind === 'revenue' ? '+' : '−'}{money(e.amount)}</span><button onClick={() => delEntry(e.id)} className="text-danger hover:underline">✕</button></div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        ) : <p className="text-sm text-text-tertiary">{t('pm_loading')}</p>
      )}

      <Modal open={taskModal} onClose={() => setTaskModal(false)} title={t('pm_newTask')} size="lg">
        <div className="space-y-4">
          <Input label={t('pm_fTitle')} value={task.title || ''} onChange={v => setTask(s => ({ ...s, title: v }))} />
          <div className="grid grid-cols-3 gap-4">
            <Select label={t('pm_fTaskStatus')} value={task.status || 'todo'} onChange={v => setTask(s => ({ ...s, status: v as TaskStatus }))} options={T_STATUSES.map(x => ({ value: x, label: t(`pm_ts_${x}` as 'pm_ts_todo') }))} />
            <Select label={t('pm_fPriority')} value={task.priority || 'medium'} onChange={v => setTask(s => ({ ...s, priority: v }))} options={PRIORITIES.map(x => ({ value: x, label: t(`pm_p_${x}` as 'pm_p_low') }))} />
            <Input label={t('pm_fEstimate')} type="number" value={String(task.estimateHours ?? 0)} onChange={v => setTask(s => ({ ...s, estimateHours: Number(v) || 0 }))} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label={t('pm_fAssignee')} value={task.assignee || ''} onChange={v => setTask(s => ({ ...s, assignee: v }))} />
            <Input label={t('pm_fStart')} type="date" value={task.startDate || ''} onChange={v => setTask(s => ({ ...s, startDate: v }))} />
            <Input label={t('pm_fTaskDue')} type="date" value={task.dueDate || ''} onChange={v => setTask(s => ({ ...s, dueDate: v }))} />
          </div>
          <div className="flex gap-3"><Btn onClick={saveTask}>{t('pm_save')}</Btn><Btn variant="secondary" onClick={() => setTaskModal(false)}>{t('pm_cancel')}</Btn></div>
        </div>
      </Modal>
    </>
  )
}
