import { describe, it, expect } from 'vitest'
import { exceedsThreshold, zoneIdFrom, shouldDrop, DRAG_THRESHOLD } from '../pointerDnd'

/** Minimal Element stand-in: only what zoneIdFrom touches. */
function el(zone: string | null, parent: unknown = null): unknown {
  return {
    getAttribute: (n: string) => (n === 'data-dnd-zone' ? zone : null),
    parentElement: parent,
  }
}

describe('26.29 BUG-112 — pointer DnD helpers', () => {
  it('a small press stays a click, not a drag', () => {
    expect(exceedsThreshold(0, 0)).toBe(false)
    expect(exceedsThreshold(2, 2)).toBe(false)
    expect(exceedsThreshold(DRAG_THRESHOLD - 0.1, 0)).toBe(false)
  })

  it('movement past the threshold becomes a drag (any direction)', () => {
    expect(exceedsThreshold(DRAG_THRESHOLD, 0)).toBe(true)
    expect(exceedsThreshold(0, -DRAG_THRESHOLD)).toBe(true)
    expect(exceedsThreshold(-10, 10)).toBe(true)
  })

  it('zoneIdFrom finds the zone on the element itself', () => {
    expect(zoneIdFrom(el('qualified') as Element)).toBe('qualified')
  })

  it('zoneIdFrom walks up through nested children (card → column)', () => {
    const column = el('won')
    const card = el(null, column)
    const label = el(null, card)
    expect(zoneIdFrom(label as Element)).toBe('won')
  })

  it('zoneIdFrom returns null outside any zone (drop on empty page)', () => {
    expect(zoneIdFrom(el(null, el(null)) as Element)).toBeNull()
    expect(zoneIdFrom(null)).toBeNull()
  })

  it('drops only fire for a real, different zone', () => {
    expect(shouldDrop('new', 'won')).toBe(true)
    expect(shouldDrop('new', 'new')).toBe(false)      // same column → no server call
    expect(shouldDrop('new', null)).toBe(false)       // released outside the board
    expect(shouldDrop(null, 'won')).toBe(true)
  })
})
