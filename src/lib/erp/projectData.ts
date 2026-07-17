/**
 * Project Management server data layer — loads projects enriched with progress,
 * schedule health and logged hours, plus the per-project detail hub (tasks for
 * Kanban/Gantt, milestones, timesheets) and the portfolio dashboard. Computation
 * via the pure engine (lib/erp/projects.ts) — one source of truth.
 */
import { pgQuery } from '@/lib/db'
import {
  projectProgress, projectHealth, loggedHours, projectKpis, ganttLayout,
  type TaskStatus, type Health,
} from './projects'

export interface ProjectRow {
  id: number; code: string; name: string; customer: string | null; manager: string | null
  status: string; startDate: string | null; endDate: string | null; budget: number; hourlyRate: number
}
export interface EnrichedProject extends ProjectRow {
  progress: number; health: Health; taskCount: number; doneCount: number; loggedHours: number; laborCost: number
}

/** Load all projects with progress / health / logged-hours. */
export async function loadProjects(): Promise<EnrichedProject[]> {
  const projects = (await pgQuery(
    `SELECT id, code, name, customer, manager, status, start_date AS "startDate", end_date AS "endDate",
            budget::float AS budget, hourly_rate::float AS "hourlyRate"
     FROM pm_projects ORDER BY updated_at DESC`, [])) as unknown as ProjectRow[]
  const tasks = (await pgQuery(`SELECT project_id AS "pid", status, estimate_hours::float AS "estimateHours" FROM pm_tasks`, [])) as { pid: number; status: TaskStatus; estimateHours: number }[]
  const hours = (await pgQuery(`SELECT project_id AS "pid", COALESCE(SUM(hours),0)::float AS h FROM pm_timesheets GROUP BY project_id`, [])) as { pid: number; h: number }[]
  const tByP = new Map<number, { status: TaskStatus; estimateHours: number }[]>()
  for (const t of tasks) { const l = tByP.get(t.pid) ?? []; l.push(t); tByP.set(t.pid, l) }
  const hByP = new Map(hours.map(h => [h.pid, h.h]))

  return projects.map(p => {
    const pt = tByP.get(p.id) ?? []
    const progress = projectProgress(pt)
    const lh = hByP.get(p.id) ?? 0
    return {
      ...p,
      progress,
      health: projectHealth(p.startDate, p.endDate, progress),
      taskCount: pt.length,
      doneCount: pt.filter(t => t.status === 'done').length,
      loggedHours: lh,
      laborCost: Math.round(lh * p.hourlyRate * 10) / 10,
    }
  })
}

/** Full detail hub for one project: tasks (+ gantt bars), milestones, timesheets. */
export async function loadProjectDetail(id: number) {
  const project = (await pgQuery(
    `SELECT id, code, name, customer, manager, status, start_date AS "startDate", end_date AS "endDate",
            budget::float AS budget, hourly_rate::float AS "hourlyRate", notes
     FROM pm_projects WHERE id=$1`, [id]))[0] as unknown as (ProjectRow & { notes: string | null }) | undefined
  if (!project) return null
  const tasks = (await pgQuery(
    `SELECT id, title, description, status, priority, assignee, estimate_hours::float AS "estimateHours",
            start_date AS "startDate", due_date AS "dueDate", sort_order AS "sortOrder"
     FROM pm_tasks WHERE project_id=$1 ORDER BY sort_order, id`, [id])) as {
    id: number; title: string; status: TaskStatus; startDate: string | null; dueDate: string | null; estimateHours: number
  }[]
  const milestones = await pgQuery(`SELECT id, name, due_date AS "dueDate", status FROM pm_milestones WHERE project_id=$1 ORDER BY due_date NULLS LAST`, [id])
  const timesheets = await pgQuery(
    `SELECT t.id, t.person, t.date, t.hours::float AS hours, t.note, k.title AS "taskTitle"
     FROM pm_timesheets t LEFT JOIN pm_tasks k ON k.id=t.task_id WHERE t.project_id=$1 ORDER BY t.date DESC LIMIT 100`, [id])

  // Gantt range spans the project or the tasks' extent.
  const dates = tasks.flatMap(t => [t.startDate, t.dueDate]).filter(Boolean) as string[]
  const rangeStart = project.startDate || dates.sort()[0] || new Date().toISOString().slice(0, 10)
  const rangeEnd = project.endDate || dates.sort().slice(-1)[0] || rangeStart
  const gantt = ganttLayout(tasks.map(t => ({ id: t.id, startDate: t.startDate, dueDate: t.dueDate })), rangeStart, rangeEnd)

  const progress = projectProgress(tasks)
  return {
    project: { ...project, progress, health: projectHealth(project.startDate, project.endDate, progress) },
    tasks, milestones, timesheets,
    gantt: { bars: gantt, rangeStart, rangeEnd },
    loggedHours: loggedHours(timesheets as { hours: number }[]),
  }
}

export async function projectOverview() {
  const projects = await loadProjects()
  const totals = (await pgQuery(
    `SELECT
       (SELECT COALESCE(SUM(budget),0)::float FROM pm_projects) AS budget,
       (SELECT COALESCE(SUM(hours),0)::float FROM pm_timesheets) AS "loggedHours",
       (SELECT COUNT(*)::int FROM pm_tasks) AS "tasksTotal",
       (SELECT COUNT(*)::int FROM pm_tasks WHERE status='done') AS "tasksDone"`, []))[0] as { budget: number; loggedHours: number; tasksTotal: number; tasksDone: number }
  // Portfolio labor cost uses each project's own rate.
  const laborCost = projects.reduce((s, p) => s + p.laborCost, 0)
  const kpis = {
    ...projectKpis({
      total: projects.length,
      active: projects.filter(p => p.status === 'active').length,
      completed: projects.filter(p => p.status === 'completed').length,
      budget: totals.budget, loggedHours: totals.loggedHours, hourlyRate: 0,
      tasksDone: totals.tasksDone, tasksTotal: totals.tasksTotal,
    }),
    laborCost: Math.round(laborCost * 10) / 10,
    budgetUsedPct: totals.budget > 0 ? Math.round((laborCost / totals.budget) * 1000) / 10 : 0,
    atRisk: projects.filter(p => p.health === 'at_risk' || p.health === 'overdue').length,
  }
  const attention = projects.filter(p => p.health === 'at_risk' || p.health === 'overdue').slice(0, 10)
  return { kpis, projects: projects.slice(0, 12), attention }
}
