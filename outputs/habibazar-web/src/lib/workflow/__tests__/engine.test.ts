import { describe, it, expect, vi } from 'vitest'
import {
  executeWorkflow,
  validateWorkflow,
  compare,
  starterWorkflow,
  type WorkflowDefinition,
} from '../engine'

describe('compare', () => {
  it('handles every operator', () => {
    expect(compare(5, 'gte', 5)).toBe(true)
    expect(compare(4, 'gte', 5)).toBe(false)
    expect(compare('abc', 'contains', 'b')).toBe(true)
    expect(compare(0, 'falsy', null)).toBe(true)
    expect(compare('x', 'truthy', null)).toBe(true)
    expect(compare(1, 'ne', 2)).toBe(true)
  })
})

describe('validateWorkflow', () => {
  it('accepts the starter workflow', () => {
    expect(validateWorkflow(starterWorkflow()).valid).toBe(true)
  })
  it('flags a missing start, dangling edge, duplicate id and no end', () => {
    const bad: WorkflowDefinition = {
      start: 'nope',
      nodes: [
        { id: 'a', type: 'start', next: 'ghost' },
        { id: 'a', type: 'log', next: 'a' },
      ],
    }
    const r = validateWorkflow(bad)
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.includes('start'))).toBe(true)
    expect(r.errors.some((e) => e.includes('duplicate'))).toBe(true)
    expect(r.errors.some((e) => e.includes('missing node'))).toBe(true)
    expect(r.errors.some((e) => e.includes('reachable end'))).toBe(true)
  })
})

describe('executeWorkflow', () => {
  it('runs a sequential set → condition(true) → end path', async () => {
    const def: WorkflowDefinition = {
      start: 's',
      nodes: [
        { id: 's', type: 'start', next: 'set' },
        { id: 'set', type: 'set', target: 'amount', value: 1500, next: 'cond' },
        { id: 'cond', type: 'condition', variable: 'amount', op: 'gte', value: 1000, whenTrue: 'e', whenFalse: 'e2' },
        { id: 'e', type: 'end' },
        { id: 'e2', type: 'end' },
      ],
    }
    const r = await executeWorkflow(def)
    expect(r.status).toBe('completed')
    expect(r.variables.amount).toBe(1500)
    // the true branch (node "e") was taken, not "e2"
    expect(r.log.some((l) => l.node === 'cond' && l.message.includes('true'))).toBe(true)
  })

  it('pauses at an approval node with status waiting', async () => {
    const r = await executeWorkflow(starterWorkflow(), { amount: 5000 })
    expect(r.status).toBe('waiting')
    expect(r.waitingNode).toBe('approve')
  })

  it('takes the auto branch and calls the notify handler when under threshold', async () => {
    const notify = vi.fn(() => 'sent')
    const r = await executeWorkflow(starterWorkflow(), { amount: 10 }, { handlers: { notify } })
    expect(r.status).toBe('completed')
    expect(notify).toHaveBeenCalledOnce()
  })

  it('records unknown task actions as skipped (non-fatal)', async () => {
    const def: WorkflowDefinition = {
      start: 's',
      nodes: [
        { id: 's', type: 'start', next: 't' },
        { id: 't', type: 'task', action: 'sendCarrierPigeon', next: 'e' },
        { id: 'e', type: 'end' },
      ],
    }
    const r = await executeWorkflow(def)
    expect(r.status).toBe('completed')
    expect(r.log.some((l) => l.message.includes('skipped'))).toBe(true)
  })

  it('fails on a throwing task unless continueOnError is set', async () => {
    const boom = () => { throw new Error('nope') }
    const def = (cont: boolean): WorkflowDefinition => ({
      start: 's',
      nodes: [
        { id: 's', type: 'start', next: 't' },
        { id: 't', type: 'task', action: 'boom', continueOnError: cont, next: 'e' },
        { id: 'e', type: 'end' },
      ],
    })
    expect((await executeWorkflow(def(false), {}, { handlers: { boom } })).status).toBe('failed')
    expect((await executeWorkflow(def(true), {}, { handlers: { boom } })).status).toBe('completed')
  })

  it('guards against infinite loops via the step budget', async () => {
    // `e` is reachable (whenFalse) so validation passes, but the condition is
    // always true → the run loops forever until the step budget stops it.
    const loop: WorkflowDefinition = {
      start: 's',
      nodes: [
        { id: 's', type: 'start', next: 'c' },
        { id: 'c', type: 'condition', variable: 'x', op: 'truthy', whenTrue: 'c', whenFalse: 'e' },
        { id: 'e', type: 'end' },
      ],
    }
    const r = await executeWorkflow(loop, { x: 1 }, { maxSteps: 50 })
    expect(r.status).toBe('failed')
    expect(r.error).toContain('max steps')
    expect(r.steps).toBeLessThanOrEqual(51)
  })

  it('is deterministic: same input + handlers ⇒ identical variables', async () => {
    const a = await executeWorkflow(starterWorkflow(), { amount: 10 }, { handlers: { notify: () => 'x' } })
    const b = await executeWorkflow(starterWorkflow(), { amount: 10 }, { handlers: { notify: () => 'x' } })
    expect(a.variables).toEqual(b.variables)
    expect(a.status).toBe(b.status)
  })
})
