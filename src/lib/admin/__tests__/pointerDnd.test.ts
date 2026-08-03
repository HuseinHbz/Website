import { describe, it, expect } from 'vitest'
import { exceedsThreshold, zoneIdFrom, shouldDrop, DRAG_THRESHOLD, shouldSuppressClick } from '../pointerDnd'

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

/**
 * 26.33 BUG-206 — the drop worked, but the click the browser delivers after a
 * drag reached the card's own onClick and opened the lead drawer over the
 * board, so the move looked like it had failed.
 */
describe('shouldSuppressClick (26.33)', () => {
  it('does not suppress when no drag has happened', () => {
    expect(shouldSuppressClick(null, 1000)).toBe(false)
  })
  it('suppresses the click that immediately follows a drop', () => {
    expect(shouldSuppressClick(1000, 1010, 300)).toBe(true)
  })
  it('stops suppressing once the window has passed — a real click still works', () => {
    expect(shouldSuppressClick(1000, 1400, 300)).toBe(false)
  })
  it('treats the boundary as expired', () => {
    expect(shouldSuppressClick(1000, 1300, 300)).toBe(false)
  })
})
