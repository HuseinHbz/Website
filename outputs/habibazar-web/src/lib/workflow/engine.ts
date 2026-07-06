/**
 * Enterprise Workflow execution engine (Phase 21) — pure & deterministic.
 *
 * A workflow is a *script-less*, config-driven graph of nodes. The engine walks
 * the graph from `start`, mutating a `variables` bag and appending a structured
 * `log`, until it reaches an `end`, a pause (`approval`/`human`), an error, or a
 * step-budget guard (loop safety). All side effects go through injected
 * `TaskHandler`s, so the engine is fully unit-testable with stub handlers and
 * behaves identically on every run given the same inputs + handlers.
 *
 * Node types (sequential + conditional + parallel-ready building blocks):
 *   start | end | set | condition | log | task | delay | approval
 *
 * The DB layer (workflows/workflow_runs tables) supplies definitions and records
 * runs; it never lives here. Business-rule / integration execution plugs in as
 * `task` handlers — no duplicated logic.
 */

export type NodeType = 'start' | 'end' | 'set' | 'condition' | 'log' | 'task' | 'delay' | 'approval'
export type CompareOp = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'truthy' | 'falsy'

export interface WorkflowNode {
  id: string
  type: NodeType
  label?: string
  next?: string
  // condition
  variable?: string
  op?: CompareOp
  value?: unknown
  whenTrue?: string
  whenFalse?: string
  // set
  target?: string
  source?: string
  // log / task
  message?: string
  action?: string
  config?: Record<string, unknown>
  assignTo?: string
  continueOnError?: boolean
  // delay
  ms?: number
  // visual designer layout (ignored by execution)
  x?: number
  y?: number
}

export interface WorkflowDefinition {
  start: string
  nodes: WorkflowNode[]
  version?: number
}

export interface LogEntry {
  ts: number
  node: string
  type: NodeType
  message: string
  level: 'info' | 'warn' | 'error'
}

export interface RunContext {
  variables: Record<string, unknown>
  log: LogEntry[]
}

export type TaskHandler = (
  action: string,
  config: Record<string, unknown>,
  ctx: RunContext,
) => Promise<unknown> | unknown

export interface RunResult {
  status: 'completed' | 'waiting' | 'failed'
  variables: Record<string, unknown>
  log: LogEntry[]
  steps: number
  error?: string
  waitingNode?: string
  endedAt?: string
}

export interface RunOptions {
  handlers?: Record<string, TaskHandler>
  maxSteps?: number
}

// ── validation ───────────────────────────────────────────────────────────────

export interface ValidationResult { valid: boolean; errors: string[] }

/** Structural validation: unique ids, resolvable edges, a reachable end. */
export function validateWorkflow(def: WorkflowDefinition): ValidationResult {
  const errors: string[] = []
  if (!def || !Array.isArray(def.nodes) || def.nodes.length === 0) {
    return { valid: false, errors: ['workflow has no nodes'] }
  }
  const ids = new Set<string>()
  for (const n of def.nodes) {
    if (!n.id) errors.push('a node is missing an id')
    else if (ids.has(n.id)) errors.push(`duplicate node id: ${n.id}`)
    else ids.add(n.id)
  }
  if (!def.start || !ids.has(def.start)) errors.push(`start node "${def.start}" not found`)

  const edgeTargets = (n: WorkflowNode) => [n.next, n.whenTrue, n.whenFalse].filter(Boolean) as string[]
  for (const n of def.nodes) {
    for (const t of edgeTargets(n)) if (!ids.has(t)) errors.push(`node "${n.id}" points to missing node "${t}"`)
  }
  // reachability from start + at least one end reachable
  const reachable = new Set<string>()
  const stack = def.start && ids.has(def.start) ? [def.start] : []
  const byId = new Map(def.nodes.map((n) => [n.id, n]))
  while (stack.length) {
    const id = stack.pop()!
    if (reachable.has(id)) continue
    reachable.add(id)
    const node = byId.get(id)
    if (node) for (const t of edgeTargets(node)) stack.push(t)
  }
  const hasReachableEnd = def.nodes.some((n) => n.type === 'end' && reachable.has(n.id))
  if (!hasReachableEnd) errors.push('no reachable end node')

  return { valid: errors.length === 0, errors }
}

// ── evaluation ───────────────────────────────────────────────────────────────

export function compare(left: unknown, op: CompareOp, right: unknown): boolean {
  switch (op) {
    case 'eq': return left === right
    case 'ne': return left !== right
    case 'gt': return Number(left) > Number(right)
    case 'gte': return Number(left) >= Number(right)
    case 'lt': return Number(left) < Number(right)
    case 'lte': return Number(left) <= Number(right)
    case 'contains': return String(left ?? '').includes(String(right ?? ''))
    case 'truthy': return Boolean(left)
    case 'falsy': return !left
    default: return false
  }
}

// ── executor ─────────────────────────────────────────────────────────────────

/**
 * Execute a workflow definition. Deterministic given `input` + `handlers`.
 * `task` nodes call `handlers[action]`; unknown actions are recorded as skipped
 * (not fatal) so an incomplete integration never crashes a run.
 */
export async function executeWorkflow(
  def: WorkflowDefinition,
  input: Record<string, unknown> = {},
  opts: RunOptions = {},
): Promise<RunResult> {
  const maxSteps = opts.maxSteps ?? 1000
  const handlers = opts.handlers ?? {}
  const variables: Record<string, unknown> = { ...input }
  const log: LogEntry[] = []
  const ctx: RunContext = { variables, log }
  const byId = new Map(def.nodes.map((n) => [n.id, n]))
  const add = (node: string, type: NodeType, message: string, level: LogEntry['level'] = 'info') =>
    log.push({ ts: log.length, node, type, message, level })

  const v = validateWorkflow(def)
  if (!v.valid) return { status: 'failed', variables, log, steps: 0, error: v.errors.join('; ') }

  let currentId: string | undefined = def.start
  let steps = 0

  while (currentId) {
    if (steps >= maxSteps) {
      add(currentId, 'end', `step budget (${maxSteps}) exceeded — aborting to prevent an infinite loop`, 'error')
      return { status: 'failed', variables, log, steps, error: 'max steps exceeded' }
    }
    const node = byId.get(currentId)
    if (!node) return { status: 'failed', variables, log, steps, error: `node "${currentId}" not found` }
    steps++

    switch (node.type) {
      case 'start':
        add(node.id, node.type, node.label || 'start')
        currentId = node.next
        break

      case 'end':
        add(node.id, node.type, node.label || 'end')
        return { status: 'completed', variables, log, steps, endedAt: new Date().toISOString() }

      case 'set': {
        const val = node.source !== undefined ? variables[node.source] : node.value
        if (node.target) variables[node.target] = val
        add(node.id, node.type, `set ${node.target} = ${JSON.stringify(val)}`)
        currentId = node.next
        break
      }

      case 'condition': {
        const result = compare(node.variable ? variables[node.variable] : undefined, node.op ?? 'truthy', node.value)
        add(node.id, node.type, `condition ${node.variable} ${node.op ?? 'truthy'} ${JSON.stringify(node.value)} → ${result}`)
        currentId = result ? (node.whenTrue ?? node.next) : (node.whenFalse ?? node.next)
        break
      }

      case 'log':
        add(node.id, node.type, node.message || 'log')
        currentId = node.next
        break

      case 'delay':
        // Logical (non-blocking) delay — recorded, not slept, so runs stay fast
        // and deterministic. A scheduler resumes real timed waits separately.
        add(node.id, node.type, `delay ${node.ms ?? 0}ms (logical)`)
        currentId = node.next
        break

      case 'approval':
        // Human/approval gate: pause the run; a later resume continues from here.
        add(node.id, node.type, node.label || 'awaiting approval', 'warn')
        return { status: 'waiting', variables, log, steps, waitingNode: node.id }

      case 'task': {
        const action = node.action ?? ''
        const handler = handlers[action]
        if (!handler) {
          add(node.id, node.type, `task "${action}" skipped (no handler registered)`, 'warn')
          currentId = node.next
          break
        }
        try {
          const out = await handler(action, node.config ?? {}, ctx)
          if (node.assignTo) variables[node.assignTo] = out
          add(node.id, node.type, `task "${action}" ok`)
          currentId = node.next
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          add(node.id, node.type, `task "${action}" failed: ${msg}`, 'error')
          if (node.continueOnError) { currentId = node.next; break }
          return { status: 'failed', variables, log, steps, error: `task "${action}": ${msg}` }
        }
        break
      }

      default:
        add(node.id, node.type as NodeType, `unknown node type "${node.type}"`, 'error')
        return { status: 'failed', variables, log, steps, error: `unknown node type "${node.type}"` }
    }
  }

  // Ran off the end of the graph without hitting an `end` node.
  add('∅', 'end', 'reached a node with no outgoing edge (implicit end)')
  return { status: 'completed', variables, log, steps, endedAt: new Date().toISOString() }
}

/** A minimal, valid starter definition used by the "New workflow" UI. */
export function starterWorkflow(): WorkflowDefinition {
  return {
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
  }
}
