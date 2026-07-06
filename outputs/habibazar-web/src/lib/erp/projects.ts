/**
 * Enterprise Project Management — domain logic (Phase 21 ERP, Module 6).
 *
 * Pure, deterministic maths for project progress, schedule health, timesheet
 * rollups and Gantt bar layout. No DB access → fully unit-tested. Shared by the
 * API, the Kanban/Gantt views and the dashboard so a number is computed once.
 */

export const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export const PROJECT_STATUSES = ['planning', 'active', 'on_hold', 'completed', 'cancelled'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export type Health = 'on_track' | 'at_risk' | 'overdue' | 'done'

function round1(n: number): number { return Math.round(n * 10) / 10 }
function clamp01(n: number): number { return Math.max(0, Math.min(1, n)) }
function dayMs(): number { return 86_400_000 }

export interface TaskLike { status: TaskStatus; estimateHours?: number | null }

/**
 * Project completion %: share of DONE tasks, weighted by estimate hours when
 * available (falls back to task count). 0..100.
 */
export function projectProgress(tasks: TaskLike[]): number {
  if (tasks.length === 0) return 0
  const useHours = tasks.some(t => (t.estimateHours ?? 0) > 0)
  if (useHours) {
    const total = tasks.reduce((s, t) => s + Math.max(0, t.estimateHours ?? 0), 0)
    if (total === 0) return 0
    const done = tasks.filter(t => t.status === 'done').reduce((s, t) => s + Math.max(0, t.estimateHours ?? 0), 0)
    return round1((done / total) * 100)
  }
  const done = tasks.filter(t => t.status === 'done').length
  return round1((done / tasks.length) * 100)
}

/** Group tasks into Kanban columns keyed by status (stable status order). */
export function kanbanColumns<T extends { status: TaskStatus }>(tasks: T[]): Record<TaskStatus, T[]> {
  const cols = { todo: [], in_progress: [], review: [], done: [] } as Record<TaskStatus, T[]>
  for (const t of tasks) (cols[t.status] ?? cols.todo).push(t)
  return cols
}

/**
 * Schedule health from progress vs elapsed time. If the project is 100% done →
 * 'done'. Past the end date and unfinished → 'overdue'. Otherwise 'at_risk' when
 * the fraction of time elapsed exceeds progress by a margin, else 'on_track'.
 */
export function projectHealth(startDate: string | null, endDate: string | null, progressPct: number, now: Date = new Date()): Health {
  if (progressPct >= 100) return 'done'
  if (!startDate || !endDate) return 'on_track'
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()
  const t = now.getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 'on_track'
  if (t > end) return 'overdue'
  const elapsed = clamp01((t - start) / (end - start)) * 100
  return elapsed - progressPct > 15 ? 'at_risk' : 'on_track'
}

export interface GanttInput { id: number; startDate: string | null; dueDate: string | null }
export interface GanttBar { id: number; offsetPct: number; widthPct: number; visible: boolean }

/**
 * Lay out task bars within a date range as %s (offset from range start, width).
 * Tasks without both dates are marked not visible. Bars are clamped to [0,100].
 */
export function ganttLayout(tasks: GanttInput[], rangeStart: string, rangeEnd: string): GanttBar[] {
  const s = new Date(rangeStart).getTime()
  const e = new Date(rangeEnd).getTime()
  const span = e - s
  return tasks.map(t => {
    if (!t.startDate || !t.dueDate || span <= 0) return { id: t.id, offsetPct: 0, widthPct: 0, visible: false }
    const ts = new Date(t.startDate).getTime()
    const te = new Date(t.dueDate).getTime() + dayMs() // inclusive of due day
    if (Number.isNaN(ts) || Number.isNaN(te)) return { id: t.id, offsetPct: 0, widthPct: 0, visible: false }
    const offset = clamp01((ts - s) / span) * 100
    const end = clamp01((te - s) / span) * 100
    return { id: t.id, offsetPct: round1(offset), widthPct: round1(Math.max(1, end - offset)), visible: true }
  })
}

export interface TimesheetLike { hours: number }
/** Sum logged hours. */
export function loggedHours(entries: TimesheetLike[]): number {
  return round1(entries.reduce((s, e) => s + Math.max(0, e.hours || 0), 0))
}

export interface ProjectKpiInput {
  total: number; active: number; completed: number
  budget: number; loggedHours: number; hourlyRate: number
  tasksDone: number; tasksTotal: number
}
export interface ProjectKpis {
  total: number; active: number; completed: number
  budget: number; laborCost: number; budgetUsedPct: number
  taskCompletion: number
}
/** Portfolio KPI rollup. Labor cost = logged hours × hourly rate. */
export function projectKpis(i: ProjectKpiInput): ProjectKpis {
  const laborCost = round1(i.loggedHours * i.hourlyRate)
  return {
    total: i.total, active: i.active, completed: i.completed,
    budget: i.budget, laborCost, budgetUsedPct: i.budget > 0 ? round1((laborCost / i.budget) * 100) : 0,
    taskCompletion: i.tasksTotal > 0 ? round1((i.tasksDone / i.tasksTotal) * 100) : 0,
  }
}
