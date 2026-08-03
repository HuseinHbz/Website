'use client'

/**
 * 26.29 BUG-112 — pointer-based drag & drop for admin boards.
 *
 * Why not HTML5 DnD: it needs `dataTransfer.setData()` in `dragstart` or the
 * browser never starts the drag (the exact defect in the CRM kanban), and it is
 * simply unavailable on touch devices — which is why the 26.25b stage-selector
 * fallback had to exist. Pointer events work identically on mouse, pen and
 * touch, so one implementation covers everything with no new dependency.
 *
 * The geometry/decision helpers are pure so they can be unit-tested; the hook is
 * a thin wrapper that wires them to the DOM.
 */
import { useCallback, useRef, useState } from 'react'

/** Movement (px) before a press becomes a drag — below this it stays a click. */
export const DRAG_THRESHOLD = 6

/** True when the pointer has moved far enough to be a drag, not a click. */
export function exceedsThreshold(dx: number, dy: number, threshold = DRAG_THRESHOLD): boolean {
  return Math.hypot(dx, dy) >= threshold
}

/**
 * Walk up from an element to the nearest drop zone and return its id.
 * A zone declares itself with `data-dnd-zone="<id>"`.
 */
export function zoneIdFrom(el: Element | null): string | null {
  let cur: Element | null = el
  while (cur) {
    const id = cur.getAttribute?.('data-dnd-zone')
    if (id != null) return id
    cur = cur.parentElement
  }
  return null
}

/**
 * 26.33 BUG-206 — after a successful drop the browser still delivers a `click`
 * to the element the press started on. The kanban card's onClick opened the
 * lead drawer, so every drop instantly covered the board and the move looked
 * like it had not happened. `finish()` clears the drag state synchronously, so
 * by the time the click arrives there is nothing left to test against — the
 * consumer cannot defend itself, which is why the guard belongs in the hook.
 *
 * Pure so the window is testable without timers.
 */
export const CLICK_SUPPRESS_MS = 300

export function shouldSuppressClick(draggedAt: number | null, now: number, windowMs = CLICK_SUPPRESS_MS): boolean {
  return draggedAt !== null && now - draggedAt < windowMs
}

/** Should the drop fire? Only for a real zone that differs from the origin. */
export function shouldDrop(fromZone: string | null, toZone: string | null): boolean {
  return !!toZone && toZone !== fromZone
}

export interface PointerDndResult<Id extends string | number> {
  /** Item currently being dragged (null when idle). */
  dragId: Id | null
  /** Zone currently under the pointer (for highlighting). */
  overZone: string | null
  /** Spread onto a draggable item. `zone` is the item's current zone. */
  dragHandlers: (id: Id, zone: string) => {
    onPointerDown: (e: React.PointerEvent) => void
    onClickCapture: (e: React.MouseEvent) => void
    style: React.CSSProperties
  }
  /** Spread onto a drop zone container. */
  zoneProps: (zone: string) => { 'data-dnd-zone': string; className?: string }
}

/**
 * Pointer drag & drop for a kanban-style board.
 * `onDrop(id, toZone)` fires once, only when the pointer is released over a
 * different zone. A press that never exceeds the threshold is left alone so the
 * item's own onClick still works.
 */
export function usePointerDnd<Id extends string | number>(
  onDrop: (id: Id, toZone: string) => void,
): PointerDndResult<Id> {
  const [dragId, setDragId] = useState<Id | null>(null)
  const [overZone, setOverZone] = useState<string | null>(null)
  const state = useRef<{ id: Id; from: string; x: number; y: number; active: boolean } | null>(null)
  const draggedAt = useRef<number | null>(null)

  const finish = useCallback((clientX: number, clientY: number) => {
    const s = state.current
    state.current = null
    setDragId(null)
    setOverZone(null)
    if (!s?.active) return
    draggedAt.current = Date.now()
    const target = document.elementFromPoint(clientX, clientY)
    const to = zoneIdFrom(target)
    if (shouldDrop(s.from, to)) onDrop(s.id, to!)
  }, [onDrop])

  const dragHandlers = useCallback((id: Id, zone: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      // ignore secondary buttons and interactive children (select, button, link)
      if (e.button !== 0) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'SELECT' || tag === 'OPTION' || tag === 'BUTTON' || tag === 'A' || tag === 'INPUT') return
      state.current = { id, from: zone, x: e.clientX, y: e.clientY, active: false }

      const onMove = (ev: PointerEvent) => {
        const s = state.current
        if (!s) return
        if (!s.active && exceedsThreshold(ev.clientX - s.x, ev.clientY - s.y)) {
          s.active = true
          setDragId(s.id)
        }
        if (s.active) {
          ev.preventDefault()
          setOverZone(zoneIdFrom(document.elementFromPoint(ev.clientX, ev.clientY)))
        }
      }
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onCancel)
        finish(ev.clientX, ev.clientY)
      }
      const onCancel = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onCancel)
        state.current = null
        setDragId(null)
        setOverZone(null)
      }
      window.addEventListener('pointermove', onMove, { passive: false })
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onCancel)
    },
    onClickCapture: (e: React.MouseEvent) => {
      // swallow the click the browser fires after a drag, before it reaches the
      // card's own onClick (which would open a drawer over the board)
      if (shouldSuppressClick(draggedAt.current, Date.now())) {
        e.preventDefault()
        e.stopPropagation()
        draggedAt.current = null
      }
    },
    style: {
      touchAction: 'none' as const,
      opacity: dragId === id ? 0.5 : 1,
      cursor: dragId === id ? 'grabbing' : 'grab',
    },
  }), [dragId, finish])

  const zoneProps = useCallback((zone: string) => ({ 'data-dnd-zone': zone }), [])

  return { dragId, overZone, dragHandlers, zoneProps }
}
