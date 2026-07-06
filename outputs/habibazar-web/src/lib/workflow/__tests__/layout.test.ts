import { describe, it, expect } from 'vitest'
import { graphEdges, autoLayout } from '../layout'
import { starterWorkflow, type WorkflowDefinition } from '../engine'

describe('graphEdges', () => {
  it('extracts next edges and both condition branches', () => {
    const edges = graphEdges(starterWorkflow())
    // start→check, check→approve(true), check→auto(false), approve→notify, auto→notify, notify→end
    expect(edges).toContainEqual({ from: 'start', to: 'check' })
    expect(edges).toContainEqual({ from: 'check', to: 'approve', label: 'true' })
    expect(edges).toContainEqual({ from: 'check', to: 'auto', label: 'false' })
    expect(edges.filter(e => e.to === 'notify')).toHaveLength(2)
  })
  it('drops edges pointing at unknown nodes', () => {
    const def: WorkflowDefinition = { version: 1, start: 'a', nodes: [{ id: 'a', type: 'start', next: 'ghost' }] }
    expect(graphEdges(def)).toEqual([])
  })
})

describe('autoLayout', () => {
  it('ranks nodes by BFS distance from start (column = rank)', () => {
    const pos = autoLayout(starterWorkflow(), 200, 100)
    const by = Object.fromEntries(pos.map(p => [p.id, p]))
    expect(by.start.x).toBe(40)            // rank 0
    expect(by.check.x).toBe(240)           // rank 1
    expect(by.approve.x).toBe(440)         // rank 2
    expect(by.end.x).toBeGreaterThan(by.notify.x) // end is deepest
  })
  it('keeps explicit positions', () => {
    const def: WorkflowDefinition = { version: 1, start: 'a', nodes: [{ id: 'a', type: 'start', next: 'b', x: 500, y: 300 }, { id: 'b', type: 'end' }] }
    const pos = autoLayout(def)
    expect(pos.find(p => p.id === 'a')).toMatchObject({ x: 500, y: 300 })
  })
  it('positions every node exactly once', () => {
    const pos = autoLayout(starterWorkflow())
    expect(pos).toHaveLength(6)
    expect(new Set(pos.map(p => p.id)).size).toBe(6)
  })
})
