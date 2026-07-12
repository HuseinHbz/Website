'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useT } from '@/lib/admin/locale'
import { autoLayout, graphEdges } from '@/lib/workflow/layout'
import type { WorkflowDefinition, WorkflowNode, NodeType } from '@/lib/workflow/engine'

const NODE_TYPES: NodeType[] = ['start', 'end', 'set', 'condition', 'log', 'task', 'delay', 'approval', 'parallel', 'notification', 'ai_decision']
const NODE_COLOR: Record<NodeType, string> = {
  start: '#16a34a', end: '#64748b', set: '#0ea5e9', condition: '#f59e0b',
  log: '#6366f1', task: '#8b5cf6', delay: '#0891b2', approval: '#ef4444',
  parallel: '#db2777', notification: '#0d9488', ai_decision: '#7c3aed',
}
const NODE_ICON: Record<NodeType, string> = {
  start: '▶', end: '⏹', set: '=', condition: '◆', log: '📝', task: '⚙', delay: '⏱', approval: '✋',
  parallel: '⇄', notification: '🔔', ai_decision: '🤖',
}
const W = 150, H = 54

/** Self-contained visual workflow editor. Parses/serializes the definition JSON
 * the engine executes; node x/y are persisted for the canvas but ignored by
 * execution. Falls back to a JSON view for invalid input / advanced editing. */
export function WorkflowCanvas({ value, onChange }: { value: string; onChange: (json: string) => void }) {
  const t = useT()
  const [view, setView] = useState<'canvas' | 'json'>('canvas')
  const [selected, setSelected] = useState<string | null>(null)
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const areaRef = useRef<HTMLDivElement>(null)

  const parsed = useMemo<{ def: WorkflowDefinition | null; error: string | null }>(() => {
    try {
      const d = JSON.parse(value) as WorkflowDefinition
      if (!d || !Array.isArray(d.nodes)) return { def: null, error: 'nodes[] missing' }
      return { def: d, error: null }
    } catch (e) { return { def: null, error: e instanceof Error ? e.message : 'invalid JSON' } }
  }, [value])

  const def = parsed.def
  const positions = useMemo(() => def ? new Map(autoLayout(def).map(p => [p.id, p])) : new Map(), [def])
  const edges = useMemo(() => def ? graphEdges(def) : [], [def])

  const commit = useCallback((next: WorkflowDefinition) => onChange(JSON.stringify(next, null, 2)), [onChange])

  function updateNode(id: string, patch: Partial<WorkflowNode>) {
    if (!def) return
    commit({ ...def, nodes: def.nodes.map(n => n.id === id ? { ...n, ...patch } : n) })
  }
  function addNode(type: NodeType) {
    if (!def) return
    let i = 1; let id = `${type}${i}`
    const ids = new Set(def.nodes.map(n => n.id))
    while (ids.has(id)) { i++; id = `${type}${i}` }
    const node: WorkflowNode = { id, type, x: 60 + (def.nodes.length % 5) * 170, y: 220 }
    commit({ ...def, nodes: [...def.nodes, node] })
    setSelected(id)
  }
  function delNode(id: string) {
    if (!def) return
    commit({ ...def, nodes: def.nodes.filter(n => n.id !== id).map(n => cleanRefs(n, id)) })
    setSelected(null)
  }

  // Pointer drag to reposition a node.
  function onPointerDown(e: React.PointerEvent, id: string) {
    const p = positions.get(id); if (!p) return
    const rect = areaRef.current?.getBoundingClientRect()
    dragRef.current = { id, dx: e.clientX - (rect?.left ?? 0) - p.x, dy: e.clientY - (rect?.top ?? 0) - p.y }
    setSelected(id)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current; if (!d || !def) return
    const rect = areaRef.current?.getBoundingClientRect()
    const x = Math.max(0, e.clientX - (rect?.left ?? 0) - d.dx)
    const y = Math.max(0, e.clientY - (rect?.top ?? 0) - d.dy)
    updateNode(d.id, { x: Math.round(x), y: Math.round(y) })
  }
  function onPointerUp() { dragRef.current = null }

  const sel = def?.nodes.find(n => n.id === selected) ?? null
  const nodeIds = def?.nodes.map(n => n.id) ?? []
  const canvasH = Math.max(340, ...[...positions.values()].map(p => p.y + H + 40))

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex gap-1">
          {(['canvas', 'json'] as const).map(v => (
            <button key={v} type="button" onClick={() => setView(v)} className={`px-3 py-1 rounded-md text-xs font-medium ${view === v ? 'bg-brand text-white' : 'bg-surface-2 text-text-secondary border border-border'}`}>{t(`wf_view_${v}` as 'wf_view_canvas')}</button>
          ))}
        </div>
        {parsed.error && <span className="text-xs text-danger">{t('wf_jsonInvalid')}: {parsed.error}</span>}
      </div>

      {view === 'json' || !def ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={16} spellCheck={false} className="w-full font-mono text-xs bg-background border border-border rounded-lg p-3 text-text-primary" />
      ) : (
        <div className="grid lg:grid-cols-[1fr_260px] gap-3">
          <div>
            {/* Palette */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {NODE_TYPES.map(nt => (
                <button key={nt} type="button" onClick={() => addNode(nt)} className="px-2 py-1 rounded-md text-2xs font-medium border border-border bg-surface-2 hover:border-brand/50" style={{ color: NODE_COLOR[nt] }}>+ {t(`wf_n_${nt}` as 'wf_n_start')}</button>
              ))}
            </div>
            {/* Canvas */}
            <div ref={areaRef} onPointerMove={onPointerMove} onPointerUp={onPointerUp} className="relative overflow-auto rounded-lg border border-border bg-background" style={{ height: 380 }}>
              <div style={{ position: 'relative', width: '100%', height: canvasH, minWidth: 700 }}>
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ height: canvasH }}>
                  <defs><marker id="wf-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#64748b" /></marker></defs>
                  {edges.map((ed, i) => {
                    const a = positions.get(ed.from), b = positions.get(ed.to); if (!a || !b) return null
                    const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2
                    const mx = (x1 + x2) / 2
                    return (
                      <g key={i}>
                        <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke="#64748b" strokeWidth={1.5} markerEnd="url(#wf-arrow)" />
                        {ed.label && <text x={mx} y={(y1 + y2) / 2 - 4} fontSize="10" fill={ed.label === 'true' ? '#16a34a' : '#ef4444'} textAnchor="middle">{ed.label}</text>}
                      </g>
                    )
                  })}
                </svg>
                {def.nodes.map(n => {
                  const p = positions.get(n.id)!; const isSel = n.id === selected
                  return (
                    <div key={n.id} onPointerDown={e => onPointerDown(e, n.id)}
                      className={`absolute rounded-lg border-2 px-2 py-1.5 cursor-move select-none bg-surface-2 ${isSel ? 'ring-2 ring-brand' : ''}`}
                      style={{ left: p.x, top: p.y, width: W, borderColor: NODE_COLOR[n.type] }}>
                      <div className="flex items-center gap-1.5"><span aria-hidden style={{ color: NODE_COLOR[n.type] }}>{NODE_ICON[n.type]}</span><span className="text-2xs font-semibold text-text-primary truncate">{n.id}</span></div>
                      <div className="text-3xs text-text-tertiary truncate">{n.label || t(`wf_n_${n.type}` as 'wf_n_start')}</div>
                    </div>
                  )
                })}
              </div>
            </div>
            <p className="text-2xs text-text-tertiary mt-1">{t('wf_canvasHint')}</p>
          </div>

          {/* Property panel */}
          <div className="rounded-lg border border-border bg-surface-2 p-3">
            {!sel ? <p className="text-xs text-text-tertiary">{t('wf_selectNode')}</p> : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between"><span className="text-xs font-semibold text-text-primary">{t(`wf_n_${sel.type}` as 'wf_n_start')}</span><button type="button" onClick={() => delNode(sel.id)} className="text-2xs text-danger hover:underline">{t('wf_delNode')}</button></div>
                <Field label={t('wf_pId')} value={sel.id} onChange={v => { if (v && !nodeIds.includes(v)) { const old = sel.id; commit({ ...def, start: def.start === old ? v : def.start, nodes: def.nodes.map(n => ({ ...renameRefs(n, old, v), id: n.id === old ? v : n.id })) }); setSelected(v) } }} />
                <Field label={t('wf_pLabel')} value={sel.label ?? ''} onChange={v => updateNode(sel.id, { label: v })} />
                {sel.type === 'condition' ? (
                  <>
                    <Field label={t('wf_pVariable')} value={sel.variable ?? ''} onChange={v => updateNode(sel.id, { variable: v })} />
                    <Field label={t('wf_pValue')} value={String(sel.value ?? '')} onChange={v => updateNode(sel.id, { value: isNaN(Number(v)) ? v : Number(v) })} />
                    <Conn label={t('wf_pWhenTrue')} ids={nodeIds} value={sel.whenTrue} onChange={v => updateNode(sel.id, { whenTrue: v })} t={t} />
                    <Conn label={t('wf_pWhenFalse')} ids={nodeIds} value={sel.whenFalse} onChange={v => updateNode(sel.id, { whenFalse: v })} t={t} />
                  </>
                ) : sel.type === 'end' ? null : (
                  <>
                    {sel.type === 'log' && <Field label={t('wf_pMessage')} value={sel.message ?? ''} onChange={v => updateNode(sel.id, { message: v })} />}
                    {sel.type === 'task' && <Field label={t('wf_pAction')} value={sel.action ?? ''} onChange={v => updateNode(sel.id, { action: v })} />}
                    {sel.type === 'delay' && <Field label={t('wf_pMs')} value={String(sel.ms ?? 0)} onChange={v => updateNode(sel.id, { ms: Number(v) || 0 })} />}
                    <Conn label={t('wf_pNext')} ids={nodeIds} value={sel.next} onChange={v => updateNode(sel.id, { next: v })} t={t} />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

type T = ReturnType<typeof useT>
function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <div><label className="text-2xs text-text-tertiary">{label}</label><input value={value} onChange={e => onChange(e.target.value)} className="form-input w-full !py-1.5 text-xs" /></div>
}
function Conn({ label, ids, value, onChange, t }: { label: string; ids: string[]; value?: string; onChange: (v: string) => void; t: T }) {
  return <div><label className="text-2xs text-text-tertiary">{label}</label>
    <select value={value ?? ''} onChange={e => onChange(e.target.value)} className="form-input w-full !py-1.5 text-xs">
      <option value="">{t('wf_none')}</option>
      {ids.map(id => <option key={id} value={id}>{id}</option>)}
    </select></div>
}
function cleanRefs(n: WorkflowNode, removed: string): WorkflowNode {
  const c = { ...n }
  if (c.next === removed) delete c.next
  if (c.whenTrue === removed) delete c.whenTrue
  if (c.whenFalse === removed) delete c.whenFalse
  return c
}
function renameRefs(n: WorkflowNode, from: string, to: string): WorkflowNode {
  const c = { ...n }
  if (c.next === from) c.next = to
  if (c.whenTrue === from) c.whenTrue = to
  if (c.whenFalse === from) c.whenFalse = to
  return c
}
