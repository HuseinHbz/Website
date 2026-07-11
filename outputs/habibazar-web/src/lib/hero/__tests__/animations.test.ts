import { describe, it, expect } from 'vitest'
import { ANIMATION_PRESETS, resolveAnimation } from '@/lib/hero/animations'

describe('orbit/network animation presets (26.10)', () => {
  it('adds 20 orbit presets, each resolvable to an hx- class', () => {
    const orbit = ANIMATION_PRESETS.filter(a => a.category === 'orbit')
    expect(orbit).toHaveLength(20)
    for (const a of orbit) {
      const r = resolveAnimation({ preset: a.id }, { reduceMotion: false, lowEnd: false })
      expect(r.className).toContain(`hx-${a.id}`)
    }
    expect(ANIMATION_PRESETS.filter(a => a.id === 'orbit-spin')).toHaveLength(1)
  })
  it('the full library is 75 presets (55 + 20 orbit)', () => {
    expect(ANIMATION_PRESETS).toHaveLength(75)
  })
})
