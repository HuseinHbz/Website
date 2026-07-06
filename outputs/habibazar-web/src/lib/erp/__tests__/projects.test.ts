import { describe, it, expect } from 'vitest'
import { projectProgress, kanbanColumns, projectHealth, ganttLayout, loggedHours, projectKpis, type TaskStatus } from '../projects'

describe('project progress', () => {
  it('weights by estimate hours when available', () => {
    // done 10h of (10 + 30) = 25%
    const p = projectProgress([
      { status: 'done', estimateHours: 10 },
      { status: 'in_progress', estimateHours: 30 },
    ])
    expect(p).toBe(25)
  })
  it('falls back to task count when no estimates', () => {
    expect(projectProgress([{ status: 'done' }, { status: 'todo' }, { status: 'done' }, { status: 'review' }])).toBe(50)
  })
  it('is 0 for an empty project', () => {
    expect(projectProgress([])).toBe(0)
  })
})

describe('kanban columns', () => {
  it('groups tasks by status', () => {
    const cols = kanbanColumns([
      { id: 1, status: 'todo' as TaskStatus }, { id: 2, status: 'done' as TaskStatus }, { id: 3, status: 'todo' as TaskStatus },
    ])
    expect(cols.todo).toHaveLength(2)
    expect(cols.done).toHaveLength(1)
    expect(cols.in_progress).toHaveLength(0)
  })
})

describe('project health', () => {
  const start = '2026-01-01', end = '2026-12-31'
  it('is done at 100%', () => {
    expect(projectHealth(start, end, 100)).toBe('done')
  })
  it('is overdue past the end date and unfinished', () => {
    expect(projectHealth(start, end, 40, new Date('2027-02-01'))).toBe('overdue')
  })
  it('is at risk when time elapsed far exceeds progress', () => {
    // ~75% through the year, only 20% done
    expect(projectHealth(start, end, 20, new Date('2026-10-01'))).toBe('at_risk')
  })
  it('is on track when progress keeps pace', () => {
    expect(projectHealth(start, end, 55, new Date('2026-07-01'))).toBe('on_track')
  })
})

describe('gantt layout', () => {
  it('positions bars as % of the range and clamps', () => {
    const bars = ganttLayout([
      { id: 1, startDate: '2026-01-01', dueDate: '2026-01-10' },
      { id: 2, startDate: null, dueDate: '2026-01-05' },
    ], '2026-01-01', '2026-01-31')
    expect(bars[0].visible).toBe(true)
    expect(bars[0].offsetPct).toBe(0)
    expect(bars[0].widthPct).toBeGreaterThan(0)
    expect(bars[1].visible).toBe(false)
  })
})

describe('timesheet & KPIs', () => {
  it('sums logged hours', () => {
    expect(loggedHours([{ hours: 3 }, { hours: 4.5 }, { hours: -1 }])).toBe(7.5)
  })
  it('rolls up portfolio KPIs with labor cost', () => {
    const k = projectKpis({ total: 5, active: 3, completed: 1, budget: 10000, loggedHours: 100, hourlyRate: 50, tasksDone: 8, tasksTotal: 20 })
    expect(k.laborCost).toBe(5000)
    expect(k.budgetUsedPct).toBe(50)
    expect(k.taskCompletion).toBe(40)
  })
})
