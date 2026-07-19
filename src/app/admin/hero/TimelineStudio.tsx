'use client'

/**
 * Visual Timeline Studio (Phase 25.2 completion) — an After-Effects-style
 * (simplified) keyframe editor for Animation Library presets. Multiple property
 * tracks, draggable keyframes, scrubber, WAAPI live playback, bezier inspector,
 * snap-to-grid, zoom, undo/redo, copy/paste — all dependency-free on top of the
 * pure engine in src/lib/hero/timeline.ts. Saves into the preset's config
 * (config.timeline) through the existing versioned Animation Library API.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, Btn, Select, Badge, useToast } from '@/components/admin/ui'
import {
  TRACK_PROPERTIES, PROPERTY_RANGE, BEZIER_PRESETS, defaultTimeline, validateTimeline,
  sampleAt, toWaapi, snapTo, normalizeTrack,
  type TimelineSpec, type TimelineTrack, type TrackProperty, type TimelineKeyframe,
} from '@/lib/hero/timeline'

type Toast = ReturnType<typeof useToast>['toast']
const lc = (rtl: boolean, en: string, fa: string) => (rtl ? fa : en)

interface Props {
  rtl: boolean
  presetId: number
  presetName: string
  onClose: () => void
  toast: Toast
}

interface Sel { track: number; kf: number }

export function TimelineStudio({ rtl, presetId, presetName, onClose, toast }: Props) {
  const [spec, setSpec] = useState<TimelineSpec | null>(null)
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const [sel, setSel] = useState<Sel | null>(null)
  const [scrub, setScrub] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [snap, setSnap] = useState(true)
  const [zoom, setZoom] = useState(100)          // lane width in %
  const [clip, setClip] = useState<TimelineKeyframe | null>(null)
  const [dirty, setDirty] = useState(false)
  const history = useRef<{ past: string[]; future: string[] }>({ past: [], future: [] })
  const previewRef = useRef<HTMLDivElement | null>(null)
  const animRef = useRef<Animation | null>(null)
  const drag = useRef<Sel | null>(null)

  // Load the preset's stored timeline (or a starter one).
  useEffect(() => {
    fetch(`/api/admin/heroes/animations?id=${presetId}`).then(r => r.json()).then(d => {
      const cfg = (d.preset?.config ?? {}) as Record<string, unknown>
      setConfig(cfg)
      setSpec((cfg.timeline as TimelineSpec | undefined) ?? defaultTimeline())
    }).catch(() => setSpec(defaultTimeline()))
  }, [presetId])

  const issues = useMemo(() => (spec ? validateTimeline(spec) : []), [spec])

  // Every mutation goes through patch() so undo/redo stays consistent.
  const patch = useCallback((fn: (s: TimelineSpec) => TimelineSpec) => {
    setSpec(s => {
      if (!s) return s
      history.current.past.push(JSON.stringify(s))
      if (history.current.past.length > 50) history.current.past.shift()
      history.current.future = []
      return fn(s)
    })
    setDirty(true)
  }, [])
  const undo = () => setSpec(s => {
    const prev = history.current.past.pop()
    if (!s || !prev) return s
    history.current.future.push(JSON.stringify(s))
    setDirty(true); setSel(null)
    return JSON.parse(prev) as TimelineSpec
  })
  const redo = () => setSpec(s => {
    const next = history.current.future.pop()
    if (!s || !next) return s
    history.current.past.push(JSON.stringify(s))
    setDirty(true); setSel(null)
    return JSON.parse(next) as TimelineSpec
  })

  // ── Playback (WAAPI) + scrubbing ───────────────────────────────────────────
  const stop = useCallback(() => { animRef.current?.cancel(); animRef.current = null; setPlaying(false) }, [])
  const applyScrub = useCallback((tMs: number, s: TimelineSpec) => {
    const el = previewRef.current; if (!el) return
    const sample = sampleAt(s, tMs)
    el.style.opacity = sample.opacity != null ? String(sample.opacity) : ''
    el.style.transform = sample.transform ?? ''
  }, [])
  function play() {
    const el = previewRef.current; if (!el || !spec) return
    stop()
    el.style.opacity = ''; el.style.transform = ''
    const w = toWaapi(spec)
    animRef.current = el.animate(w.keyframes, w.options)
    setPlaying(true)
    animRef.current.onfinish = () => setPlaying(false)
  }
  function onScrub(tMs: number) {
    if (!spec) return
    stop(); setScrub(tMs); applyScrub(tMs, spec)
  }
  useEffect(() => () => stop(), [stop])

  // ── Keyframe editing ─────────────────────────────────────────────────────────
  function addKeyframe(ti: number, atRaw: number) {
    if (!spec) return
    const at = snap ? snapTo(atRaw) : Math.round(atRaw * 1000) / 1000
    patch(s => {
      const tracks = s.tracks.map((t, i) => i === ti
        ? normalizeTrack({ ...t, keyframes: [...t.keyframes, { at, value: valueAtSafe(t, at) }] })
        : t)
      return { ...s, tracks }
    })
  }
  function valueAtSafe(t: TimelineTrack, at: number): number {
    try { return Math.round(sampleValue(t, at) * 100) / 100 } catch { return 0 }
  }
  function sampleValue(t: TimelineTrack, at: number): number {
    // reuse the engine's interpolation through sampleAt on a single-track spec
    const s = sampleAt({ durationMs: 1000, tracks: [t] }, at * 1000)
    if (t.property === 'opacity') return s.opacity ?? 1
    const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)|rotate\((-?[\d.]+)deg\)|scale\((-?[\d.]+)\)/g
    let x = 0, y = 0, rotate = 0, scale = 1, mm: RegExpExecArray | null
    while ((mm = m.exec(s.transform ?? ''))) {
      if (mm[1] != null) { x = Number(mm[1]); y = Number(mm[2]) }
      if (mm[3] != null) rotate = Number(mm[3])
      if (mm[4] != null) scale = Number(mm[4])
    }
    return { x, y, rotate, scale, opacity: 1 }[t.property] ?? 0
  }
  function updateKf(ti: number, ki: number, fn: (k: TimelineKeyframe) => TimelineKeyframe) {
    patch(s => ({ ...s, tracks: s.tracks.map((t, i) => i === ti ? normalizeTrack({ ...t, keyframes: t.keyframes.map((k, j) => j === ki ? fn(k) : k) }) : t) }))
  }
  function deleteKf(ti: number, ki: number) {
    setSel(null)
    patch(s => ({ ...s, tracks: s.tracks.map((t, i) => i === ti ? { ...t, keyframes: t.keyframes.filter((_, j) => j !== ki) } : t) }))
  }
  function duplicateKf(ti: number, ki: number) {
    patch(s => {
      const t = s.tracks[ti]; const k = t.keyframes[ki]
      const at = Math.min(1, k.at + 0.05)
      return { ...s, tracks: s.tracks.map((tr, i) => i === ti ? normalizeTrack({ ...tr, keyframes: [...tr.keyframes, { ...k, at }] }) : tr) }
    })
  }
  function pasteKf(ti: number) {
    if (!clip) return
    patch(s => ({ ...s, tracks: s.tracks.map((t, i) => i === ti ? normalizeTrack({ ...t, keyframes: [...t.keyframes, { ...clip }] }) : t) }))
  }

  // Pointer-drag keyframes along a lane.
  function laneDrag(e: React.PointerEvent<HTMLDivElement>, ti: number) {
    if (!drag.current || drag.current.track !== ti || !spec) return
    const rect = e.currentTarget.getBoundingClientRect()
    const raw = (e.clientX - rect.left) / rect.width
    const at = snap ? snapTo(raw) : Math.max(0, Math.min(1, Math.round(raw * 1000) / 1000))
    const ki = drag.current.kf
    setSpec(s => s ? { ...s, tracks: s.tracks.map((t, i) => i === ti ? { ...t, keyframes: t.keyframes.map((k, j) => j === ki ? { ...k, at } : k) } : t) } : s)
    setDirty(true)
  }
  function laneDragEnd(ti: number) {
    if (!drag.current) return
    drag.current = null
    setSpec(s => s ? { ...s, tracks: s.tracks.map((t, i) => i === ti ? normalizeTrack(t) : t) } : s)
  }

  // ── Tracks ───────────────────────────────────────────────────────────────────
  const usedProps = new Set(spec?.tracks.map(t => t.property))
  const freeProps = TRACK_PROPERTIES.filter(p => !usedProps.has(p))
  function addTrack(p: TrackProperty) {
    patch(s => ({ ...s, tracks: [...s.tracks, { property: p, keyframes: [{ at: 0, value: p === 'opacity' || p === 'scale' ? 1 : 0 }, { at: 1, value: p === 'opacity' || p === 'scale' ? 1 : 0 }] }] }))
  }
  function removeTrack(ti: number) { setSel(null); patch(s => ({ ...s, tracks: s.tracks.filter((_, i) => i !== ti) })) }

  async function save() {
    if (!spec) return
    const r = await fetch('/api/admin/heroes/animations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id: presetId, config: { ...config, timeline: spec } }),
    })
    if (r.ok) { toast(lc(rtl, 'Timeline saved (new version)', 'تایم‌لاین ذخیره شد (نسخهٔ جدید)'), 'success'); setDirty(false) }
    else { const d = await r.json().catch(() => ({})); toast(d.error || lc(rtl, 'Save failed', 'ذخیره ناموفق'), 'error') }
  }

  if (!spec) return <Card className="p-8 text-center text-text-tertiary">{lc(rtl, 'Loading studio…', 'بارگذاری استودیو…')}</Card>

  const duration = spec.durationMs
  const selKf: TimelineKeyframe | null = sel ? spec.tracks[sel.track]?.keyframes[sel.kf] ?? null : null
  const frameMs = Math.max(10, Math.round(duration / 60))
  const easingName = selKf ? (typeof selKf.easing === 'string' ? selKf.easing : selKf.easing ? 'custom' : 'linear') : 'linear'

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-label="Timeline Studio">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto p-5 space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-text-primary">🎬 {lc(rtl, 'Timeline Studio', 'استودیو تایم‌لاین')}</h2>
            <span className="text-xs text-text-tertiary font-mono">{presetName}</span>
            {issues.length === 0 ? <Badge color="green">{lc(rtl, 'valid', 'معتبر')}</Badge> : <Badge color="red">{issues.length} {lc(rtl, 'issues', 'مشکل')}</Badge>}
            {dirty && <Badge color="yellow">{lc(rtl, 'unsaved', 'ذخیره‌نشده')}</Badge>}
          </div>
          <div className="flex gap-2">
            <Btn size="sm" variant="secondary" onClick={save} disabled={issues.length > 0}>{lc(rtl, 'Save', 'ذخیره')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => { stop(); onClose() }}>{lc(rtl, 'Close', 'بستن')}</Btn>
          </div>
        </div>
        {issues.length > 0 && <p className="text-xs text-danger-text">{issues[0].message}</p>}

        {/* Transport + timing controls */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-1">
            <Btn size="sm" onClick={playing ? stop : play}>{playing ? '⏸' : '▶'}</Btn>
            <Btn size="sm" variant="secondary" onClick={() => onScrub(Math.max(0, scrub - frameMs))}>⏮</Btn>
            <Btn size="sm" variant="secondary" onClick={() => onScrub(Math.min(duration, scrub + frameMs))}>⏭</Btn>
            <Btn size="sm" variant="secondary" onClick={undo} disabled={history.current.past.length === 0}>↶</Btn>
            <Btn size="sm" variant="secondary" onClick={redo} disabled={history.current.future.length === 0}>↷</Btn>
          </div>
          <NumCtl rtl={rtl} label={lc(rtl, 'Duration (ms)', 'مدت')} value={duration} min={100} max={60000} step={100} onChange={v => patch(s => ({ ...s, durationMs: v }))} />
          <NumCtl rtl={rtl} label={lc(rtl, 'Delay', 'تأخیر')} value={spec.delayMs ?? 0} min={0} max={10000} step={50} onChange={v => patch(s => ({ ...s, delayMs: v }))} />
          <NumCtl rtl={rtl} label={lc(rtl, 'Repeat (-1=∞)', 'تکرار')} value={spec.iterations ?? 1} min={-1} max={99} step={1} onChange={v => patch(s => ({ ...s, iterations: v }))} />
          <NumCtl rtl={rtl} label={lc(rtl, 'Speed×', 'سرعت')} value={spec.playbackRate ?? 1} min={0.1} max={4} step={0.1} onChange={v => patch(s => ({ ...s, playbackRate: v }))} />
          <div>
            <label className="block text-xs text-text-tertiary mb-1">{lc(rtl, 'Direction', 'جهت')}</label>
            <Select label="" value={spec.direction ?? 'normal'} onChange={v => patch(s => ({ ...s, direction: v as TimelineSpec['direction'] }))} options={[{ value: 'normal', label: 'normal' }, { value: 'reverse', label: 'reverse' }, { value: 'alternate', label: 'alternate' }]} />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-text-secondary pb-2"><input type="checkbox" checked={snap} onChange={e => setSnap(e.target.checked)} />{lc(rtl, 'Snap 5%', 'چسبیدن ۵٪')}</label>
          <div className="pb-1">
            <label className="block text-xs text-text-tertiary mb-1">{lc(rtl, 'Zoom', 'بزرگ‌نمایی')}</label>
            <input type="range" min={100} max={300} value={zoom} onChange={e => setZoom(Number(e.target.value))} />
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_280px] gap-4">
          {/* Timeline lanes */}
          <div className="space-y-2 overflow-x-auto">
            {/* Ruler + scrubber */}
            <div className="relative" style={{ width: `${zoom}%` }}>
              <input type="range" min={0} max={duration} value={scrub} onChange={e => onScrub(Number(e.target.value))} className="w-full" aria-label="scrubber" />
              <div className="flex justify-between text-4xs text-text-tertiary font-mono px-1">
                {[0, 0.25, 0.5, 0.75, 1].map(f => <span key={f}>{Math.round(duration * f)}ms</span>)}
              </div>
            </div>
            {spec.tracks.map((t, ti) => (
              <div key={t.property} className="flex items-center gap-2" style={{ width: `${zoom}%` }}>
                <div className="w-16 shrink-0 flex flex-col items-start gap-0.5">
                  <span className="text-xs font-mono text-text-secondary">{t.property}</span>
                  <span className="flex gap-1">
                    <button onClick={() => pasteKf(ti)} disabled={!clip} className="text-4xs text-text-tertiary hover:text-text-primary disabled:opacity-30" title={lc(rtl, 'Paste keyframe', 'چسباندن')}>📋</button>
                    <button onClick={() => removeTrack(ti)} className="text-4xs text-text-tertiary hover:text-danger-text" title={lc(rtl, 'Remove track', 'حذف ترک')}>✕</button>
                  </span>
                </div>
                <div
                  className="relative h-9 flex-1 rounded-lg bg-surface-2 border border-subtle cursor-crosshair"
                  onDoubleClick={e => { const r = e.currentTarget.getBoundingClientRect(); addKeyframe(ti, (e.clientX - r.left) / r.width) }}
                  onPointerMove={e => laneDrag(e, ti)}
                  onPointerUp={() => laneDragEnd(ti)}
                  onPointerLeave={() => laneDragEnd(ti)}
                >
                  {/* playhead */}
                  <div className="absolute top-0 bottom-0 w-px bg-brand/70 pointer-events-none" style={{ left: `${(scrub / duration) * 100}%` }} />
                  {t.keyframes.map((k, ki) => (
                    <button
                      key={ki}
                      onPointerDown={e => { e.preventDefault(); drag.current = { track: ti, kf: ki }; setSel({ track: ti, kf: ki }) }}
                      className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rotate-45 border ${sel?.track === ti && sel?.kf === ki ? 'bg-brand border-white' : 'bg-surface border-brand/60'} hover:bg-brand/70`}
                      style={{ left: `${k.at * 100}%` }}
                      title={`${t.property} @ ${(k.at * 100).toFixed(0)}% = ${k.value}`}
                      aria-label={`keyframe ${t.property} ${k.at}`}
                    />
                  ))}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1">
              {freeProps.length > 0 && (
                <Select label="" value="" onChange={v => v && addTrack(v as TrackProperty)} options={[{ value: '', label: lc(rtl, '+ Add track…', '+ افزودن ترک…') }, ...freeProps.map(p => ({ value: p, label: p }))]} />
              )}
              <p className="text-4xs text-text-tertiary">{lc(rtl, 'Double-click a lane to add a keyframe · drag diamonds to move', 'دابل‌کلیک روی خط = کی‌فریم جدید · درگ لوزی = جابه‌جایی')}</p>
            </div>
          </div>

          {/* Preview + inspector */}
          <div className="space-y-3">
            <div className="rounded-xl border border-subtle h-40 flex items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(135deg,#0b1120,#1e293b)' }}>
              <div ref={previewRef} className="w-16 h-16 rounded-xl bg-brand shadow-lg shadow-brand/40 flex items-center justify-center text-white text-xs font-bold">HBZ</div>
            </div>
            <Card className="p-3 space-y-2">
              <h4 className="text-xs font-semibold text-text-primary">{lc(rtl, 'Keyframe inspector', 'بازرس کی‌فریم')}</h4>
              {!selKf && <p className="text-3xs text-text-tertiary">{lc(rtl, 'Select a keyframe on the timeline.', 'یک کی‌فریم انتخاب کنید.')}</p>}
              {selKf && sel && (
                <>
                  <NumCtl rtl={rtl} label={lc(rtl, 'Position %', 'موقعیت')} value={Math.round(selKf.at * 100)} min={0} max={100} step={1}
                    onChange={v => updateKf(sel.track, sel.kf, k => ({ ...k, at: v / 100 }))} />
                  <NumCtl rtl={rtl} label={lc(rtl, 'Value', 'مقدار')} value={selKf.value}
                    min={PROPERTY_RANGE[spec.tracks[sel.track].property].min}
                    max={PROPERTY_RANGE[spec.tracks[sel.track].property].max}
                    step={PROPERTY_RANGE[spec.tracks[sel.track].property].step}
                    onChange={v => updateKf(sel.track, sel.kf, k => ({ ...k, value: v }))} />
                  <div>
                    <label className="block text-xs text-text-tertiary mb-1">{lc(rtl, 'Easing (into this keyframe)', 'شتاب (به این کی‌فریم)')}</label>
                    <Select label="" value={easingName === 'custom' ? 'linear' : easingName}
                      onChange={v => updateKf(sel.track, sel.kf, k => ({ ...k, easing: v === 'linear' ? undefined : v }))}
                      options={Object.keys(BEZIER_PRESETS).map(e => ({ value: e, label: e }))} />
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Btn size="sm" variant="secondary" onClick={() => { setClip({ ...selKf }); toast(lc(rtl, 'Copied', 'کپی شد'), 'success') }}>{lc(rtl, 'Copy', 'کپی')}</Btn>
                    <Btn size="sm" variant="secondary" onClick={() => duplicateKf(sel.track, sel.kf)}>{lc(rtl, 'Duplicate', 'تکثیر')}</Btn>
                    <Btn size="sm" variant="danger" onClick={() => deleteKf(sel.track, sel.kf)}>{lc(rtl, 'Delete', 'حذف')}</Btn>
                  </div>
                </>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function NumCtl({ rtl: _rtl, label, value, min, max, step, onChange }: { rtl: boolean; label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs text-text-tertiary mb-1">{label}</label>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v))) }}
        className="w-24 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm text-text-primary" />
    </div>
  )
}
