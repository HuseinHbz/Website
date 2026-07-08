'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Btn, Input, Select, Badge, useToast } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'
import { HERO_TEMPLATES, getTemplate } from '@/lib/hero/templates'
import { validateHero } from '@/lib/hero/rules'
import type { HeroConfig, HeroContentL, HeroCta, HeroStat, HeroStatus, Locale } from '@/lib/hero/types'

type Toast = ReturnType<typeof useToast>['toast']
const lc = (rtl: boolean, en: string, fa: string) => (rtl ? fa : en)

interface HeroDetail {
  id: number; slug: string; name: string; template: string; status: HeroStatus
  category: string | null; tags: string[]; targetPath: string | null; version: number
  config: HeroConfig
}
interface VersionRow { id: number; version: number; status: string; note: string | null; created_at: string }

type Device = 'desktop' | 'laptop' | 'tablet' | 'mobile' | 'ultrawide'
const DEVICE_W: Record<Device, number> = { ultrawide: 1600, desktop: 1280, laptop: 1024, tablet: 768, mobile: 375 }

export function HeroBuilder({ id, onBack, toast }: { id: number; onBack: () => void; toast: Toast }) {
  const rtl = useAdminLocale() === 'fa'
  const [hero, setHero] = useState<HeroDetail | null>(null)
  const [versions, setVersions] = useState<VersionRow[]>([])
  const [config, setConfig] = useState<HeroConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [editLocale, setEditLocale] = useState<Locale>('en')
  const [device, setDevice] = useState<Device>('desktop')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/heroes?id=${id}`)
      const d = await r.json()
      if (d.hero) { setHero(d.hero); setConfig(d.hero.config); setVersions(d.versions ?? []); setDirty(false) }
    } finally { setLoading(false) }
  }, [id])
  useEffect(() => { load() }, [load])

  const validation = useMemo(() => (config ? validateHero(config) : null), [config])

  function patchConfig(fn: (c: HeroConfig) => HeroConfig) { setConfig(c => (c ? fn(c) : c)); setDirty(true) }
  function patchContent(loc: Locale, fn: (c: HeroContentL) => HeroContentL) {
    patchConfig(c => ({ ...c, content: { ...c.content, [loc]: fn(c.content[loc]) } }))
  }
  function patchStyle(fn: (s: HeroConfig['style']) => HeroConfig['style']) {
    patchConfig(c => ({ ...c, style: fn(c.style) }))
  }

  async function save() {
    if (!config) return
    setSaving(true)
    try {
      const r = await fetch('/api/admin/heroes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', id, config, targetPath: hero?.targetPath ?? null }) })
      const d = await r.json().catch(() => ({}))
      if (r.ok) { toast(lc(rtl, 'Saved', 'ذخیره شد'), 'success'); setDirty(false); load() }
      else toast(d.error || lc(rtl, 'Save failed', 'ذخیره ناموفق'), 'error')
    } finally { setSaving(false) }
  }

  async function lifecycle(action: string, extra: Record<string, unknown> = {}) {
    if (dirty && action !== 'rollback') { await save() }
    const r = await fetch('/api/admin/heroes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id, ...extra }) })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { toast(lc(rtl, 'Done', 'انجام شد'), 'success'); load() }
    else toast(d.error || lc(rtl, 'Failed', 'ناموفق'), 'error')
  }

  async function setTarget(v: string) {
    setHero(h => (h ? { ...h, targetPath: v || null } : h)); setDirty(true)
  }

  if (loading || !config || !hero) {
    return <Card className="p-8 text-center text-text-tertiary">{lc(rtl, 'Loading builder…', 'بارگذاری…')}</Card>
  }

  const tmpl = getTemplate(config.template)
  const cur = config.content[editLocale]
  const canPub = validation?.ok ?? false

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle pb-3">
        <div className="flex items-center gap-3">
          <Btn variant="ghost" size="sm" onClick={onBack}>{rtl ? '→' : '←'} {lc(rtl, 'Back', 'بازگشت')}</Btn>
          <div>
            <h2 className="text-lg font-bold text-text-primary">{hero.name}</h2>
            <p className="text-xs text-text-tertiary font-mono">{hero.slug} · {config.template} · v{hero.version}</p>
          </div>
          <Badge color={hero.status === 'published' ? 'green' : hero.status === 'draft' ? 'slate' : 'blue'}>{hero.status}</Badge>
          {dirty && <Badge color="yellow">{lc(rtl, 'unsaved', 'ذخیره‌نشده')}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Btn size="sm" variant="secondary" onClick={save} disabled={saving || !dirty}>{saving ? lc(rtl, 'Saving…', 'در حال ذخیره…') : lc(rtl, 'Save', 'ذخیره')}</Btn>
          {hero.status === 'draft' && <Btn size="sm" onClick={() => lifecycle('submit')}>{lc(rtl, 'Submit', 'ارسال')}</Btn>}
          {hero.status === 'review' && <Btn size="sm" onClick={() => lifecycle('approve')}>{lc(rtl, 'Approve', 'تأیید')}</Btn>}
          {hero.status !== 'published' && <Btn size="sm" onClick={() => lifecycle('publish')} disabled={!canPub}>{lc(rtl, 'Publish', 'انتشار')}</Btn>}
          {hero.status === 'published' && <Btn size="sm" variant="secondary" onClick={() => lifecycle('unpublish')}>{lc(rtl, 'Unpublish', 'لغو انتشار')}</Btn>}
        </div>
      </div>

      {!canPub && (
        <div className="rounded-lg border border-danger/40 bg-danger-muted/30 px-3 py-2 text-xs text-danger-text">
          {lc(rtl, 'Publishing is blocked until all validation errors are resolved.', 'انتشار تا رفع خطاهای اعتبارسنجی مسدود است.')}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,380px)_1fr] gap-4">
        {/* ── Editor column ── */}
        <div className="space-y-4">
          {/* Template + target */}
          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">{lc(rtl, 'Placement', 'قرارگیری')}</h3>
            <Select label={lc(rtl, 'Template', 'قالب')} value={config.template} onChange={v => patchConfig(c => ({ ...c, template: v }))} options={HERO_TEMPLATES.map(t => ({ value: t.id, label: rtl ? t.nameFa : t.nameEn }))} />
            <Input label={lc(rtl, 'Target path (e.g. / )', 'مسیر مقصد')} value={hero.targetPath ?? ''} onChange={setTarget} placeholder="/" />
          </Card>

          {/* Language content */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">{lc(rtl, 'Content', 'محتوا')}</h3>
              <div className="flex gap-1">
                {(['en', 'fa'] as Locale[]).map(l => (
                  <button key={l} onClick={() => setEditLocale(l)} className={`px-3 py-1 rounded text-xs font-medium ${editLocale === l ? 'bg-brand text-white' : 'bg-white/5 text-text-secondary'}`}>{l.toUpperCase()}</button>
                ))}
              </div>
            </div>
            <p className="text-xs text-text-tertiary">{lc(rtl, 'Each language is edited independently.', 'هر زبان مستقل ویرایش می‌شود.')}</p>
            <Input label={lc(rtl, 'Badge', 'نشان')} value={cur.badge ?? ''} onChange={v => patchContent(editLocale, c => ({ ...c, badge: v }))} />
            <Input label={lc(rtl, 'Headline', 'عنوان')} value={cur.headline ?? ''} onChange={v => patchContent(editLocale, c => ({ ...c, headline: v }))} />
            <Input label={lc(rtl, 'Headline highlight', 'برجسته عنوان')} value={cur.headlineHighlight ?? ''} onChange={v => patchContent(editLocale, c => ({ ...c, headlineHighlight: v }))} />
            <Input label={lc(rtl, 'Subheadline', 'زیرعنوان')} value={cur.subheadline ?? ''} onChange={v => patchContent(editLocale, c => ({ ...c, subheadline: v }))} multiline rows={3} />
            <Input label={lc(rtl, 'Media URL (image/video)', 'آدرس رسانه')} value={cur.mediaUrl ?? ''} onChange={v => patchContent(editLocale, c => ({ ...c, mediaUrl: v }))} />
            <Input label={lc(rtl, 'Media alt text', 'متن جایگزین رسانه')} value={cur.mediaAlt ?? ''} onChange={v => patchContent(editLocale, c => ({ ...c, mediaAlt: v }))} />
          </Card>

          {/* CTAs */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">{lc(rtl, 'Call-to-action buttons', 'دکمه‌های اقدام')}</h3>
              <Btn size="sm" variant="secondary" onClick={() => patchContent(editLocale, c => ({ ...c, ctas: [...(c.ctas ?? []), { label: '', href: '', variant: 'primary' }] }))}>+ {lc(rtl, 'Add', 'افزودن')}</Btn>
            </div>
            {(cur.ctas ?? []).map((cta, i) => (
              <CtaRow key={i} cta={cta} rtl={rtl}
                onChange={next => patchContent(editLocale, c => ({ ...c, ctas: (c.ctas ?? []).map((x, j) => (j === i ? next : x)) }))}
                onRemove={() => patchContent(editLocale, c => ({ ...c, ctas: (c.ctas ?? []).filter((_, j) => j !== i) }))} />
            ))}
            {(cur.ctas ?? []).length === 0 && <p className="text-xs text-text-tertiary">{lc(rtl, 'No buttons.', 'دکمه‌ای نیست.')}</p>}
          </Card>

          {/* Stats */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">{lc(rtl, 'Statistics', 'آمار')}</h3>
              <Btn size="sm" variant="secondary" onClick={() => patchContent(editLocale, c => ({ ...c, stats: [...(c.stats ?? []), { label: '', value: '' }] }))}>+ {lc(rtl, 'Add', 'افزودن')}</Btn>
            </div>
            {(cur.stats ?? []).map((st, i) => (
              <div key={i} className="flex gap-2 items-end">
                <Input label={lc(rtl, 'Value', 'مقدار')} value={st.value} onChange={v => patchContent(editLocale, c => ({ ...c, stats: (c.stats ?? []).map((x, j) => (j === i ? { ...x, value: v } : x)) }))} />
                <Input label={lc(rtl, 'Label', 'برچسب')} value={st.label} onChange={v => patchContent(editLocale, c => ({ ...c, stats: (c.stats ?? []).map((x, j) => (j === i ? { ...x, label: v } : x)) }))} />
                <Btn size="sm" variant="ghost" onClick={() => patchContent(editLocale, c => ({ ...c, stats: (c.stats ?? []).filter((_, j) => j !== i) }))}>✕</Btn>
              </div>
            ))}
          </Card>

          {/* Style system */}
          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">{lc(rtl, 'Style', 'سبک')}</h3>
            <div className="grid grid-cols-2 gap-3">
              <NumField label={lc(rtl, 'Title size (px)', 'اندازه عنوان')} value={config.style.titleSize} onChange={v => patchStyle(s => ({ ...s, titleSize: v }))} />
              <NumField label={lc(rtl, 'Subtitle size', 'اندازه زیرعنوان')} value={config.style.subtitleSize} onChange={v => patchStyle(s => ({ ...s, subtitleSize: v }))} />
              <NumField label={lc(rtl, 'Font weight', 'ضخامت')} value={config.style.fontWeight} onChange={v => patchStyle(s => ({ ...s, fontWeight: v }))} />
              <NumField label={lc(rtl, 'Min height (vh)', 'حداقل ارتفاع')} value={config.style.minHeightVh} onChange={v => patchStyle(s => ({ ...s, minHeightVh: v }))} />
              <NumField label={lc(rtl, 'Button radius', 'گردی دکمه')} value={config.style.buttonRadius} onChange={v => patchStyle(s => ({ ...s, buttonRadius: v }))} />
              <NumField label={lc(rtl, 'Overlay (0-1)', 'پوشش')} value={config.style.overlay} step={0.1} onChange={v => patchStyle(s => ({ ...s, overlay: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-tertiary mb-1">{lc(rtl, 'Text color', 'رنگ متن')}</label>
                <input type="color" value={config.style.textColor ?? '#ffffff'} onChange={e => patchStyle(s => ({ ...s, textColor: e.target.value }))} className="h-9 w-full rounded bg-transparent" />
              </div>
              <Select label={lc(rtl, 'Background', 'پس‌زمینه')} value={config.style.background?.kind ?? 'gradient'} onChange={v => patchStyle(s => ({ ...s, background: { ...(s.background ?? {}), kind: v as HeroConfig['style']['background'] extends undefined ? never : NonNullable<HeroConfig['style']['background']>['kind'] } }))} options={(tmpl?.backgrounds ?? ['gradient']).map(b => ({ value: b, label: b }))} />
            </div>
            {config.style.background?.kind === 'solid' && (
              <div>
                <label className="block text-xs text-text-tertiary mb-1">{lc(rtl, 'Background color', 'رنگ پس‌زمینه')}</label>
                <input type="color" value={config.style.background?.color ?? '#0a0a0a'} onChange={e => patchStyle(s => ({ ...s, background: { ...(s.background ?? { kind: 'solid' }), kind: 'solid', color: e.target.value } }))} className="h-9 w-full rounded bg-transparent" />
              </div>
            )}
            {(config.style.background?.kind === 'image' || config.style.background?.kind === 'video') && (
              <Input label={lc(rtl, 'Background URL', 'آدرس پس‌زمینه')} value={config.style.background?.value ?? ''} onChange={v => patchStyle(s => ({ ...s, background: { ...(s.background ?? { kind: 'image' }), kind: s.background?.kind ?? 'image', value: v } }))} />
            )}
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={!!config.reduceMotion} onChange={e => patchConfig(c => ({ ...c, reduceMotion: e.target.checked }))} />
              {lc(rtl, 'Reduce motion (accessibility)', 'کاهش حرکت')}
            </label>
          </Card>
        </div>

        {/* ── Preview + validation + versions column ── */}
        <div className="space-y-4">
          {/* Preview controls */}
          <Card className="p-3">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="flex gap-1">
                {(Object.keys(DEVICE_W) as Device[]).map(dv => (
                  <button key={dv} onClick={() => setDevice(dv)} className={`px-2.5 py-1 rounded text-xs ${device === dv ? 'bg-brand text-white' : 'bg-white/5 text-text-secondary'}`}>{dv}</button>
                ))}
              </div>
              <div className="flex gap-1 ms-auto">
                <button onClick={() => setTheme('dark')} className={`px-2.5 py-1 rounded text-xs ${theme === 'dark' ? 'bg-brand text-white' : 'bg-white/5 text-text-secondary'}`}>Dark</button>
                <button onClick={() => setTheme('light')} className={`px-2.5 py-1 rounded text-xs ${theme === 'light' ? 'bg-brand text-white' : 'bg-white/5 text-text-secondary'}`}>Light</button>
              </div>
            </div>
            <div className="overflow-auto bg-black/20 rounded-lg p-3 flex justify-center">
              <div style={{ width: Math.min(DEVICE_W[device], 1400) }} className="shrink-0 transition-all">
                <HeroPreview config={config} locale={editLocale} theme={theme} />
              </div>
            </div>
          </Card>

          {/* Validation panel */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-text-primary">{lc(rtl, 'Validation', 'اعتبارسنجی')}</h3>
              {validation && (validation.ok
                ? <Badge color="green">{lc(rtl, 'Ready to publish', 'آماده انتشار')}</Badge>
                : <Badge color="red">{validation.errors.length} {lc(rtl, 'errors', 'خطا')}</Badge>)}
            </div>
            {validation && validation.issues.length === 0 && <p className="text-xs text-success-text">{lc(rtl, 'No issues. All checks passed.', 'بدون مشکل.')}</p>}
            <ul className="space-y-1.5">
              {validation?.issues.map((iss, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className={iss.severity === 'error' ? 'text-danger-text' : 'text-warning-text'}>{iss.severity === 'error' ? '✕' : '⚠'}</span>
                  <span className="text-text-secondary">{iss.locale ? `[${iss.locale}] ` : ''}{iss.message}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Version history */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-2">{lc(rtl, 'Version history', 'تاریخچه نسخه‌ها')}</h3>
            {versions.length === 0 && <p className="text-xs text-text-tertiary">{lc(rtl, 'No saved versions yet.', 'نسخه‌ای ذخیره نشده.')}</p>}
            <ul className="space-y-1.5">
              {versions.map(v => (
                <li key={v.id} className="flex items-center justify-between text-xs border border-subtle rounded px-2.5 py-1.5">
                  <span className="text-text-secondary">v{v.version} · {v.note ?? '—'} <span className="text-text-tertiary">{v.created_at}</span></span>
                  <Btn size="sm" variant="ghost" onClick={() => lifecycle('rollback', { version: v.version })}>{lc(rtl, 'Rollback', 'بازگردانی')}</Btn>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}

function CtaRow({ cta, rtl, onChange, onRemove }: { cta: HeroCta; rtl: boolean; onChange: (c: HeroCta) => void; onRemove: () => void }) {
  return (
    <div className="border border-subtle rounded-lg p-2.5 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Input label={lc(rtl, 'Label', 'برچسب')} value={cta.label} onChange={v => onChange({ ...cta, label: v })} />
        <Input label={lc(rtl, 'Link', 'پیوند')} value={cta.href} onChange={v => onChange({ ...cta, href: v })} />
      </div>
      <div className="flex items-end gap-2">
        <Select label={lc(rtl, 'Style', 'سبک')} value={cta.variant ?? 'primary'} onChange={v => onChange({ ...cta, variant: v as HeroCta['variant'] })} options={[{ value: 'primary', label: 'Primary' }, { value: 'secondary', label: 'Secondary' }, { value: 'ghost', label: 'Ghost' }]} />
        <Btn size="sm" variant="ghost" onClick={onRemove}>✕</Btn>
      </div>
    </div>
  )
}

function NumField({ label, value, onChange, step = 1 }: { label: string; value?: number; onChange: (v: number | undefined) => void; step?: number }) {
  return (
    <div>
      <label className="block text-xs text-text-tertiary mb-1">{label}</label>
      <input type="number" step={step} value={value ?? ''} onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary" />
    </div>
  )
}

/** Config-driven live preview. Deliberately dependency-free (no framer-motion in
 * the admin) so it renders instantly and matches the published layout shape. */
function HeroPreview({ config, locale, theme }: { config: HeroConfig; locale: Locale; theme: 'dark' | 'light' }) {
  const c = config.content[locale]
  const s = config.style
  const rtl = locale === 'fa'
  const bg = s.background?.kind
  const bgStyle: React.CSSProperties =
    bg === 'solid' ? { background: s.background?.color ?? '#0a0a0a' }
      : bg === 'image' && s.background?.value ? { backgroundImage: `url(${s.background.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
        : { background: theme === 'dark' ? 'linear-gradient(135deg,#0b1120,#1e293b)' : 'linear-gradient(135deg,#f8fafc,#e2e8f0)' }
  const fg = s.textColor ?? (theme === 'dark' ? '#ffffff' : '#0f172a')
  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{ ...bgStyle, minHeight: `${Math.min(s.minHeightVh ?? 100, 70) * 4}px`, color: fg }} className="relative rounded-lg overflow-hidden flex items-center">
      {bg === 'video' && s.background?.value && (
        <video src={s.background.value} autoPlay={!config.reduceMotion} muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />
      )}
      {s.overlay ? <div className="absolute inset-0 bg-black" style={{ opacity: s.overlay }} /> : null}
      <div className="relative z-10 px-8 py-12 w-full" style={{ maxWidth: s.containerWidth ? `${s.containerWidth}px` : undefined }}>
        {c.badge && <span className="inline-block mb-4 px-3 py-1 rounded-full text-xs font-medium border border-current/30 opacity-90">{c.badge}</span>}
        <h1 style={{ fontSize: `${Math.min(s.titleSize ?? 56, 72)}px`, fontWeight: s.fontWeight ?? 800, lineHeight: s.lineHeight ?? 1.1, letterSpacing: s.letterSpacing ? `${s.letterSpacing}px` : undefined }} className="font-black tracking-tight">
          {c.headline || <span className="opacity-40">{rtl ? 'عنوان اصلی' : 'Your headline'}</span>}
          {c.headlineHighlight && <span className="text-brand"> {c.headlineHighlight}</span>}
        </h1>
        {c.subheadline && <p style={{ fontSize: `${s.subtitleSize ?? 20}px` }} className="mt-4 opacity-80 max-w-2xl">{c.subheadline}</p>}
        {(c.ctas ?? []).length > 0 && (
          <div className="mt-6 flex flex-wrap gap-3">
            {(c.ctas ?? []).map((cta, i) => (
              <span key={i} style={{ borderRadius: `${s.buttonRadius ?? 12}px` }}
                className={`px-5 py-2.5 text-sm font-semibold ${cta.variant === 'primary' ? 'bg-brand text-white' : cta.variant === 'secondary' ? 'border border-current' : 'underline'}`}>
                {cta.label || (rtl ? 'دکمه' : 'Button')}
              </span>
            ))}
          </div>
        )}
        {(c.stats ?? []).length > 0 && (
          <div className="mt-8 flex flex-wrap gap-8">
            {(c.stats ?? []).map((st, i) => (
              <div key={i}><div className="text-2xl font-bold">{st.value}</div><div className="text-xs opacity-70">{st.label}</div></div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
