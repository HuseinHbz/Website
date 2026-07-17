/**
 * Visual Timeline Studio — pure keyframe engine (Phase 25.2 completion).
 *
 * A dependency-free keyframe/timeline model in the spirit of After Effects
 * (simplified for web): multiple property tracks (opacity/scale/rotate/x/y),
 * per-segment cubic-bezier easing, a scrubber sampler, and a compiler to Web
 * Animations API keyframes (the studio previews and the renderer plays with
 * `element.animate` — no animation library needed). Timeline specs persist in
 * `hero_animation_presets.config.timeline` (the column was left schema-ready in
 * Phase 25.2). Pure + fully unit-tested.
 */

export type TrackProperty = 'opacity' | 'scale' | 'rotate' | 'x' | 'y'
export const TRACK_PROPERTIES: TrackProperty[] = ['opacity', 'scale', 'rotate', 'x', 'y']

/** Named easings → cubic-bezier control points (null = linear). */
export const BEZIER_PRESETS: Record<string, [number, number, number, number] | null> = {
  linear: null,
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
  spring: [0.34, 1.56, 0.64, 1],
  elastic: [0.68, -0.55, 0.265, 1.55],
  bounce: [0.68, -0.6, 0.32, 1.6],
}

export interface TimelineKeyframe {
  /** Position on the timeline, 0..1 (fraction of duration). */
  at: number
  value: number
  /** Easing of the segment ENDING at this keyframe (curve into it). Name from
   * BEZIER_PRESETS or explicit control points. Default linear. */
  easing?: string | [number, number, number, number]
}
export interface TimelineTrack {
  property: TrackProperty
  keyframes: TimelineKeyframe[]
}
export interface TimelineSpec {
  durationMs: number
  delayMs?: number
  /** -1 = infinite. */
  iterations?: number
  direction?: 'normal' | 'reverse' | 'alternate'
  playbackRate?: number
  tracks: TimelineTrack[]
}

/** Sensible defaults per property (used when a track starts mid-timeline). */
export const PROPERTY_DEFAULTS: Record<TrackProperty, number> = { opacity: 1, scale: 1, rotate: 0, x: 0, y: 0 }
export const PROPERTY_RANGE: Record<TrackProperty, { min: number; max: number; step: number }> = {
  opacity: { min: 0, max: 1, step: 0.05 },
  scale: { min: 0, max: 5, step: 0.05 },
  rotate: { min: -720, max: 720, step: 1 },
  x: { min: -500, max: 500, step: 1 },
  y: { min: -500, max: 500, step: 1 },
}

// ── Cubic bezier solver ───────────────────────────────────────────────────────
/** CSS-style cubic-bezier: returns eased progress y for time-progress x (0..1). */
export function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number): (x: number) => number {
  const cx = 3 * p1x, bx = 3 * (p2x - p1x) - cx, ax = 1 - cx - bx
  const cy = 3 * p1y, by = 3 * (p2y - p1y) - cy, ay = 1 - cy - by
  const xAt = (t: number) => ((ax * t + bx) * t + cx) * t
  const yAt = (t: number) => ((ay * t + by) * t + cy) * t
  const dxAt = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    // Newton-Raphson, then bisection fallback.
    let t = x
    for (let i = 0; i < 8; i++) {
      const err = xAt(t) - x
      if (Math.abs(err) < 1e-6) return yAt(t)
      const d = dxAt(t)
      if (Math.abs(d) < 1e-6) break
      t -= err / d
    }
    let lo = 0, hi = 1
    t = x
    while (hi - lo > 1e-6) {
      if (xAt(t) < x) lo = t; else hi = t
      t = (lo + hi) / 2
    }
    return yAt(t)
  }
}

function resolveEasing(e: TimelineKeyframe['easing']): ((x: number) => number) {
  const pts = Array.isArray(e) ? e : (e ? BEZIER_PRESETS[e] ?? null : null)
  if (!pts) return (x) => x
  return cubicBezier(pts[0], pts[1], pts[2], pts[3])
}

// ── Normalization / validation ───────────────────────────────────────────────
const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/** Sort keyframes and clamp positions — call before storing/sampling. */
export function normalizeTrack(track: TimelineTrack): TimelineTrack {
  const keyframes = [...track.keyframes]
    .map(k => ({ ...k, at: clamp01(k.at) }))
    .sort((a, b) => a.at - b.at)
  return { ...track, keyframes }
}

export interface TimelineIssue { code: string; message: string }
export function validateTimeline(spec: TimelineSpec): TimelineIssue[] {
  const issues: TimelineIssue[] = []
  if (!(spec.durationMs >= 100 && spec.durationMs <= 60000))
    issues.push({ code: 'duration.range', message: 'Duration must be between 100ms and 60s.' })
  if (spec.tracks.length === 0)
    issues.push({ code: 'tracks.empty', message: 'Add at least one track.' })
  for (const t of spec.tracks) {
    if (!TRACK_PROPERTIES.includes(t.property))
      issues.push({ code: 'track.property', message: `Unknown property "${t.property}".` })
    if (t.keyframes.length < 2)
      issues.push({ code: 'track.keyframes', message: `Track "${t.property}" needs at least 2 keyframes.` })
    for (const k of t.keyframes) {
      if (k.at < 0 || k.at > 1)
        issues.push({ code: 'keyframe.at', message: `Keyframe position ${k.at} is outside 0..1.` })
      if (!Number.isFinite(k.value))
        issues.push({ code: 'keyframe.value', message: 'Keyframe value must be a number.' })
    }
  }
  return issues
}

// ── Sampling (scrubber + baking) ─────────────────────────────────────────────
/** Interpolated value of a track at position `at` (0..1). */
export function valueAt(track: TimelineTrack, at: number): number {
  const kfs = normalizeTrack(track).keyframes
  if (kfs.length === 0) return PROPERTY_DEFAULTS[track.property]
  if (at <= kfs[0].at) return kfs[0].value
  const last = kfs[kfs.length - 1]
  if (at >= last.at) return last.value
  for (let i = 1; i < kfs.length; i++) {
    const k0 = kfs[i - 1], k1 = kfs[i]
    if (at <= k1.at) {
      const span = k1.at - k0.at
      const local = span === 0 ? 1 : (at - k0.at) / span
      const eased = resolveEasing(k1.easing)(local)
      return k0.value + (k1.value - k0.value) * eased
    }
  }
  return last.value
}

export interface TimelineSample { opacity?: number; transform?: string }
/** Compose a CSS transform string from sampled property values. */
export function composeTransform(v: Partial<Record<TrackProperty, number>>): string | undefined {
  const parts: string[] = []
  if (v.x != null || v.y != null) parts.push(`translate(${v.x ?? 0}px, ${v.y ?? 0}px)`)
  if (v.rotate != null) parts.push(`rotate(${v.rotate}deg)`)
  if (v.scale != null) parts.push(`scale(${v.scale})`)
  return parts.length ? parts.join(' ') : undefined
}

/** Sample the whole timeline at absolute time tMs (scrubber; single iteration). */
export function sampleAt(spec: TimelineSpec, tMs: number): TimelineSample {
  const delay = spec.delayMs ?? 0
  const at = clamp01((tMs - delay) / Math.max(1, spec.durationMs))
  const values: Partial<Record<TrackProperty, number>> = {}
  for (const t of spec.tracks) values[t.property] = valueAt(t, at)
  const out: TimelineSample = {}
  if (values.opacity != null) out.opacity = values.opacity
  const transform = composeTransform(values)
  if (transform) out.transform = transform
  return out
}

// ── WAAPI compiler ────────────────────────────────────────────────────────────
export interface WaapiAnimation {
  keyframes: (Record<string, string | number> & { offset: number })[]
  options: { duration: number; delay: number; iterations: number; direction: 'normal' | 'reverse' | 'alternate'; easing: 'linear'; fill: 'both' }
}
/**
 * Compile a timeline to Web Animations API keyframes by dense sampling
 * (default 60 samples) — per-segment bezier curves are baked in faithfully, so
 * `element.animate(k.keyframes, k.options)` plays the exact authored motion.
 */
export function toWaapi(spec: TimelineSpec, samples = 60): WaapiAnimation {
  const keyframes: WaapiAnimation['keyframes'] = []
  for (let i = 0; i <= samples; i++) {
    const offset = i / samples
    const s = sampleAt({ ...spec, delayMs: 0 }, offset * spec.durationMs)
    const kf: Record<string, string | number> & { offset: number } = { offset }
    if (s.opacity != null) kf.opacity = s.opacity
    if (s.transform) kf.transform = s.transform
    keyframes.push(kf)
  }
  return {
    keyframes,
    options: {
      duration: Math.round(spec.durationMs / Math.max(0.05, spec.playbackRate ?? 1)),
      delay: spec.delayMs ?? 0,
      iterations: (spec.iterations ?? 1) === -1 ? Infinity : (spec.iterations ?? 1),
      direction: spec.direction ?? 'normal',
      easing: 'linear',
      fill: 'both',
    },
  }
}

// ── Editor helpers (snap / zoom / clipboard) ─────────────────────────────────
/** Snap a 0..1 position to a grid step (default 5%). */
export function snapTo(at: number, step = 0.05): number {
  return clamp01(Math.round(at / step) * step)
}

/** A starter timeline for a new studio session. */
export function defaultTimeline(): TimelineSpec {
  return {
    durationMs: 1000,
    delayMs: 0,
    iterations: 1,
    direction: 'normal',
    playbackRate: 1,
    tracks: [
      { property: 'opacity', keyframes: [{ at: 0, value: 0 }, { at: 1, value: 1, easing: 'ease-out' }] },
      { property: 'y', keyframes: [{ at: 0, value: 28 }, { at: 1, value: 0, easing: 'ease-out' }] },
    ],
  }
}
