import { describe, it, expect } from 'vitest'
import {
  cubicBezier, valueAt, sampleAt, composeTransform, toWaapi, validateTimeline,
  normalizeTrack, snapTo, defaultTimeline, type TimelineSpec,
} from '../timeline'

describe('timeline engine — bezier', () => {
  it('hits the endpoints and stays monotonic-ish in between', () => {
    const ease = cubicBezier(0.25, 0.1, 0.25, 1)
    expect(ease(0)).toBe(0)
    expect(ease(1)).toBe(1)
    expect(ease(0.5)).toBeGreaterThan(0)
    expect(ease(0.5)).toBeLessThan(1)
  })
  it('ease-in is below linear at the midpoint; ease-out above', () => {
    expect(cubicBezier(0.42, 0, 1, 1)(0.5)).toBeLessThan(0.5)
    expect(cubicBezier(0, 0, 0.58, 1)(0.5)).toBeGreaterThan(0.5)
  })
})

describe('timeline engine — sampling', () => {
  const track = { property: 'opacity' as const, keyframes: [{ at: 0, value: 0 }, { at: 1, value: 1 }] }
  it('interpolates linearly by default and clamps outside the range', () => {
    expect(valueAt(track, 0.5)).toBeCloseTo(0.5, 5)
    expect(valueAt(track, -1)).toBe(0)
    expect(valueAt(track, 2)).toBe(1)
  })
  it('honors per-segment easing (curve into the ending keyframe)', () => {
    const eased = { property: 'opacity' as const, keyframes: [{ at: 0, value: 0 }, { at: 1, value: 1, easing: 'ease-in' as const }] }
    expect(valueAt(eased, 0.5)).toBeLessThan(0.5)
  })
  it('normalizeTrack sorts and clamps keyframes', () => {
    const messy = normalizeTrack({ property: 'x', keyframes: [{ at: 1.5, value: 10 }, { at: -0.2, value: 0 }, { at: 0.5, value: 5 }] })
    expect(messy.keyframes.map(k => k.at)).toEqual([0, 0.5, 1])
  })
  it('sampleAt composes opacity + transform', () => {
    const spec: TimelineSpec = {
      durationMs: 1000,
      tracks: [
        { property: 'opacity', keyframes: [{ at: 0, value: 0 }, { at: 1, value: 1 }] },
        { property: 'y', keyframes: [{ at: 0, value: 20 }, { at: 1, value: 0 }] },
        { property: 'scale', keyframes: [{ at: 0, value: 0.5 }, { at: 1, value: 1 }] },
      ],
    }
    const s = sampleAt(spec, 500)
    expect(s.opacity).toBeCloseTo(0.5, 5)
    expect(s.transform).toContain('translate(0px, 10px)')
    expect(s.transform).toContain('scale(0.75)')
  })
  it('composeTransform orders translate → rotate → scale', () => {
    expect(composeTransform({ x: 1, y: 2, rotate: 45, scale: 2 })).toBe('translate(1px, 2px) rotate(45deg) scale(2)')
    expect(composeTransform({})).toBeUndefined()
  })
})

describe('timeline engine — WAAPI compiler', () => {
  it('bakes dense keyframes with offsets 0..1 and linear stepping', () => {
    const w = toWaapi(defaultTimeline(), 10)
    expect(w.keyframes).toHaveLength(11)
    expect(w.keyframes[0].offset).toBe(0)
    expect(w.keyframes[10].offset).toBe(1)
    expect(w.keyframes[0].opacity).toBe(0)
    expect(w.keyframes[10].opacity).toBe(1)
    expect(w.options.easing).toBe('linear')
    expect(w.options.fill).toBe('both')
  })
  it('maps iterations -1 to Infinity and playbackRate into duration', () => {
    const spec = { ...defaultTimeline(), iterations: -1, playbackRate: 2 }
    const w = toWaapi(spec, 4)
    expect(w.options.iterations).toBe(Infinity)
    expect(w.options.duration).toBe(500) // 1000ms at 2× speed
  })
})

describe('timeline engine — validation + editor helpers', () => {
  it('flags bad duration, empty tracks, short tracks and out-of-range keyframes', () => {
    const bad: TimelineSpec = { durationMs: 5, tracks: [{ property: 'opacity', keyframes: [{ at: 3, value: 1 }] }] }
    const issues = validateTimeline(bad)
    expect(issues.some(i => i.code === 'duration.range')).toBe(true)
    expect(issues.some(i => i.code === 'track.keyframes')).toBe(true)
    expect(issues.some(i => i.code === 'keyframe.at')).toBe(true)
    expect(validateTimeline(defaultTimeline())).toHaveLength(0)
  })
  it('snaps to the grid and clamps', () => {
    expect(snapTo(0.52)).toBeCloseTo(0.5, 5)
    expect(snapTo(0.98)).toBe(1)
    expect(snapTo(-0.2)).toBe(0)
  })
})
