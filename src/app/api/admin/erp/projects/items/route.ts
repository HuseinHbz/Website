import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, requirePermission } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { TASK_STATUSES, TASK_PRIORITIES } from '@/lib/erp/projects'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

// Combined create/update endpoint for the sub-entities of a project: tasks,
// milestones and timesheet entries. Discriminated on `kind`.
const taskSchema = z.object({
  kind: z.literal('task'),
  id: z.number().int().positive().optional(),
  projectId: z.number().int().positive(),
  title: z.string().min(1).max(240),
  description: z.string().max(2000).optional(),
  status: z.enum(TASK_STATUSES).default('todo'),
  priority: z.enum(TASK_PRIORITIES).default('medium'),
  assignee: z.string().max(120).optional(),
  estimateHours: z.number().min(0).default(0),
  startDate: z.string().max(30).optional(),
  dueDate: z.string().max(30).optional(),
})
const taskMoveSchema = z.object({ kind: z.literal('task-move'), id: z.number().int().positive(), status: z.enum(TASK_STATUSES) })
const milestoneSchema = z.object({
  kind: z.literal('milestone'), id: z.number().int().positive().optional(), projectId: z.number().int().positive(),
  name: z.string().min(1).max(200), dueDate: z.string().max(30).optional(), status: z.enum(['open', 'reached', 'missed']).default('open'),
})
const timesheetSchema = z.object({
  kind: z.literal('timesheet'), projectId: z.number().int().positive(), taskId: z.number().int().positive().optional(),
  person: z.string().min(1).max(120), date: z.string().min(1).max(30), hours: z.number().positive(), note: z.string().max(500).optional(),
})
const body = z.discriminatedUnion('kind', [taskSchema, taskMoveSchema, milestoneSchema, timesheetSchema])

export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.project-management', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, body)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    if (d.kind === 'task') {
      if (d.id) {
        await pgQuery(
          `UPDATE pm_tasks SET title=$2, description=$3, status=$4, priority=$5, assignee=$6, estimate_hours=$7, start_date=$8, due_date=$9, updated_at=${NOW} WHERE id=$1`,
          [d.id, d.title, d.description ?? null, d.status, d.priority, d.assignee ?? null, d.estimateHours, d.startDate ?? null, d.dueDate ?? null])
        await logAction(auth.user, 'pm.task.update', 'pm_task', d.id)
        return NextResponse.json({ id: d.id })
      }
      const row = (await pgQuery(
        `INSERT INTO pm_tasks (project_id, title, description, status, priority, assignee, estimate_hours, start_date, due_date, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,${NOW}) RETURNING id`,
        [d.projectId, d.title, d.description ?? null, d.status, d.priority, d.assignee ?? null, d.estimateHours, d.startDate ?? null, d.dueDate ?? null]))[0] as { id: number }
      await logAction(auth.user, 'pm.task.create', 'pm_task', row.id)
      return NextResponse.json({ id: row.id })
    }
    if (d.kind === 'task-move') {
      await pgQuery(`UPDATE pm_tasks SET status=$2, updated_at=${NOW} WHERE id=$1`, [d.id, d.status])
      return NextResponse.json({ ok: true })
    }
    if (d.kind === 'milestone') {
      if (d.id) {
        await pgQuery(`UPDATE pm_milestones SET name=$2, due_date=$3, status=$4 WHERE id=$1`, [d.id, d.name, d.dueDate ?? null, d.status])
        return NextResponse.json({ id: d.id })
      }
      const row = (await pgQuery(`INSERT INTO pm_milestones (project_id, name, due_date, status) VALUES ($1,$2,$3,$4) RETURNING id`, [d.projectId, d.name, d.dueDate ?? null, d.status]))[0] as { id: number }
      await logAction(auth.user, 'pm.milestone.create', 'pm_milestone', row.id)
      return NextResponse.json({ id: row.id })
    }
    // timesheet
    const row = (await pgQuery(
      `INSERT INTO pm_timesheets (project_id, task_id, person, date, hours, note, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [d.projectId, d.taskId ?? null, d.person, d.date, d.hours, d.note ?? null, auth.user.id]))[0] as { id: number }
    await logAction(auth.user, 'pm.timesheet.create', 'pm_timesheet', row.id, null, { hours: d.hours })
    return NextResponse.json({ id: row.id })
  } catch (e) { return apiError(e, 'Operation failed') }
}

const delSchema = z.object({ kind: z.enum(['task', 'milestone', 'timesheet']), id: z.number().int().positive() })
const TABLE: Record<string, string> = { task: 'pm_tasks', milestone: 'pm_milestones', timesheet: 'pm_timesheets' }

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission('erp.project-management', 'write', 'delete')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, delSchema)
  if ('error' in parsed) return parsed.error
  const table = TABLE[parsed.data.kind]
  if (!table) return badRequest('bad kind')
  try {
    await pgQuery(`DELETE FROM ${table} WHERE id=$1`, [parsed.data.id])
    await logAction(auth.user, `pm.${parsed.data.kind}.delete`, table, parsed.data.id)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to delete') }
}
