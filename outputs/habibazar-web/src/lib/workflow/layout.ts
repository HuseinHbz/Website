/**
 * Visual Workflow Designer — pure layout & edge helpers (Phase 21.6).
 *
 * Turns a workflow definition into the geometry the canvas renders: the set of
 * directed edges (with a label per branch) and auto-assigned x/y positions for
 * any node that lacks them. No DOM, no side effects → unit-tested. The engine
 * ignores x/y, so a laid-out graph still executes identically.
 */
import type { WorkflowDefinition, WorkflowNode } from './engine'

export interface Edge { from: string; to: string; label?: string }

/** All directed edges of a workflow (next / condition branches). */
export function graphEdges(def: WorkflowDefinition): Edge[] {
  const ids = new Set(def.nodes.map(n => n.id))
  const edges: Edge[] = []
  for (const n of def.nodes) {
    if (n.type === 'condition') {
      if (n.whenTrue && ids.has(n.whenTrue)) edges.push({ from: n.id, to: n.whenTrue, label: 'true' })
      if (n.whenFalse && ids.has(n.whenFalse)) edges.push({ from: n.id, to: n.whenFalse, label: 'false' })
    } else if (n.next && ids.has(n.next)) {
      edges.push({ from: n.id, to: n.next })
    }
  }
  return edges
}

export interface Positioned { id: string; x: number; y: number }

/**
 * Assign x/y to every node. Nodes that already carry x/y keep them; the rest are
 * placed by breadth-first rank from `start` (rank → column, order-in-rank → row).
 * Deterministic. `colW`/`rowH` are the grid spacing.
 */
export function autoLayout(def: WorkflowDefinition, colW = 200, rowH = 110): Positioned[] {
  const byId = new Map(def.nodes.map(n => [n.id, n]))
  const rank = new Map<string, number>()
  const queue: string[] = []
  const startId = def.start && byId.has(def.start) ? def.start : def.nodes[0]?.id
  if (startId) { rank.set(startId, 0); queue.push(startId) }

  while (queue.length) {
    const id = queue.shift()!
    const r = rank.get(id)!
    for (const e of outgoing(byId.get(id))) {
      if (!byId.has(e)) continue
      if (!rank.has(e)) { rank.set(e, r + 1); queue.push(e) }
    }
  }

  // Any unreachable nodes get placed after the deepest rank.
  const maxRank = Math.max(0, ...[...rank.values()])
  let orphanRank = maxRank + 1
  for (const n of def.nodes) if (!rank.has(n.id)) rank.set(n.id, orphanRank++)

  // Row index = order among nodes sharing a rank.
  const rowOf = new Map<string, number>()
  const perRank = new Map<number, number>()
  for (const n of def.nodes) {
    const r = rank.get(n.id)!
    const row = perRank.get(r) ?? 0
    rowOf.set(n.id, row)
    perRank.set(r, row + 1)
  }

  return def.nodes.map((n: WorkflowNode) => ({
    id: n.id,
    x: typeof n.x === 'number' ? n.x : 40 + rank.get(n.id)! * colW,
    y: typeof n.y === 'number' ? n.y : 40 + rowOf.get(n.id)! * rowH,
  }))
}

function outgoing(n: WorkflowNode | undefined): string[] {
  if (!n) return []
  if (n.type === 'condition') return [n.whenTrue, n.whenFalse].filter(Boolean) as string[]
  return n.next ? [n.next] : []
}
