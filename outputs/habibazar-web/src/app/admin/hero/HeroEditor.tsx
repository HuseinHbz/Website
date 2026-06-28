'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, SectionDivider, PageHeader, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

const VARIANTS = [
  { id: 'split',    fa: 'تقسیم‌شده',       en: 'Split',          bg: 'from-indigo-900 to-slate-900',   accent: 'bg-indigo-500' },
  { id: 'minimal',  fa: 'مینیمال بولد',     en: 'Minimal Bold',   bg: 'from-slate-900 to-slate-800',    accent: 'bg-white' },
  { id: 'glass',    fa: 'شیشه‌ای',          en: 'Glassmorphism',  bg: 'from-purple-900 to-blue-900',    accent: 'bg-purple-400' },
  { id: 'terminal', fa: 'ترمینال',          en: 'Terminal',       bg: 'from-black to-green-950',        accent: 'bg-green-400' },
  { id: 'bento',    fa: 'بنتو گرید',        en: 'Bento Grid',     bg: 'from-slate-950 to-slate-900',    accent: 'bg-cyan-400' },
  { id: 'luxury',   fa: 'لوکس سینمایی',    en: 'Dark Luxury',    bg: 'from-neutral-950 to-stone-900',  accent: 'bg-amber-400' },
  { id: 'neon',     fa: 'نئون',             en: 'Neon Circuit',   bg: 'from-slate-950 to-cyan-950',     accent: 'bg-cyan-300' },
  { id: 'magazine', fa: 'مجله‌ای',          en: 'Magazine',       bg: 'from-gray-900 to-gray-800',      accent: 'bg-rose-400' },
  { id: 'centered', fa: 'مرکزی کلاسیک',    en: 'Centered',       bg: 'from-slate-900 to-indigo-950',   accent: 'bg-indigo-400' },
  { id: 'gradient', fa: 'گرادیان مش',       en: 'Gradient Mesh',  bg: 'from-violet-950 to-purple-900',  accent: 'bg-violet-400' },
]

type HeroData = {
  locale: string
  badge: string; headline: string; headlineHighlight: string; subheadline: string
  ctaPrimary: string; ctaPrimaryHref: string; ctaSecondary: string; ctaSecondaryHref: string
  ctaTertiary: string; ctaTertiaryHref: string
  stat1Label: string; stat1Value: string; stat2Label: string; stat2Value: string
  stat3Label: string; stat3Value: string; stat4Label: string; stat4Value: string
}
const EMPTY: HeroData = {
  locale: 'en', badge: '', headline: '', headlineHighlight: '', subheadline: '',
  ctaPrimary: '', ctaPrimaryHref: '', ctaSecondary: '', ctaSecondaryHref: '',
  ctaTertiary: '', ctaTertiaryHref: '',
  stat1Label: '', stat1Value: '', stat2Label: '', stat2Value: '',
  stat3Label: '', stat3Value: '', stat4Label: '', stat4Value: '',
}

export function HeroEditor() {
  const t = useT()
  const [locale, setLocale] = useState<'en' | 'fa'>('en')
  const [data, setData] = useState<Record<string, HeroData>>({})
  const [saving, setSaving] = useState(false)
  const [variant, setVariant] = useState('split')
  const [variantSaving, setVariantSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  useEffect(() => {
    fetch('/api/admin/hero')
      .then((r) => r.json())
      .then((rows: HeroData[]) => {
        const map: Record<string, HeroData> = {}
        for (const r of rows) map[r.locale] = r
        setData(map)
      })
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((s: Record<string, string>) => { if (s.hero_variant) setVariant(s.hero_variant) })
  }, [])

  async function saveVariant(id: string) {
    setVariant(id)
    setVariantSaving(true)
    await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hero_variant: id }),
    })
    setVariantSaving(false)
    toast('طرح هیرو ذخیره شد', 'success')
  }

  const current = data[locale] || { ...EMPTY, locale }
  function set(k: keyof HeroData, v: string) {
    setData((d) => ({ ...d, [locale]: { ...(d[locale] || { ...EMPTY, locale }), [k]: v } }))
  }

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/hero', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(current),
    })
    setSaving(false)
    toast(res.ok ? t('saved') : t('failed'), res.ok ? 'success' : 'error')
  }

  return (
    <>
      <ToastContainer />
      <PageHeader
        title={t('heroBadgeSec')}
        subtitle="Hero Section"
        action={
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg bg-[#0c0c14] border border-[#2a2a3e] overflow-hidden">
              {(['en', 'fa'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLocale(l)}
                  className={`px-4 py-1.5 text-xs font-medium transition-colors ${locale === l ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <Btn onClick={save} disabled={saving}>
              {saving ? t('saving') : t('heroSaveChanges')}
            </Btn>
          </div>
        }
      />

      <div className="space-y-6">
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <SectionDivider label="انتخاب طرح هیرو / Hero Layout" />
            {variantSaving && <span className="text-xs text-slate-400">در حال ذخیره...</span>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {VARIANTS.map((v) => (
              <button
                key={v.id}
                onClick={() => saveVariant(v.id)}
                className={`relative rounded-xl overflow-hidden border-2 transition-all duration-200 text-left ${
                  variant === v.id
                    ? 'border-indigo-500 ring-2 ring-indigo-500/40 scale-[1.02]'
                    : 'border-[#2a2a3e] hover:border-slate-500'
                }`}
              >
                <div className={`bg-gradient-to-br ${v.bg} h-20 p-2 flex flex-col justify-between`}>
                  <div className="flex gap-1">
                    <div className={`w-2 h-2 rounded-full ${v.accent} opacity-90`} />
                    <div className="w-6 h-1 bg-white/20 rounded mt-0.5" />
                  </div>
                  <div className="space-y-1">
                    <div className="w-10 h-1 bg-white/60 rounded" />
                    <div className="w-7 h-0.5 bg-white/30 rounded" />
                  </div>
                  {variant === v.id && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="bg-[#0c0c14] px-2 py-1.5">
                  <p className="text-[10px] font-medium text-slate-300 truncate">{v.fa}</p>
                  <p className="text-[9px] text-slate-500 truncate">{v.en}</p>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <SectionDivider label={t('heroBadgeSec')} />
          <Input label={t('heroBadge')} value={current.badge || ''} onChange={(v) => set('badge', v)} placeholder="Available for Enterprise Projects" />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('heroHeadline')} value={current.headline || ''} onChange={(v) => set('headline', v)} placeholder="Infrastructure" />
            <Input label={t('heroHighlight')} value={current.headlineHighlight || ''} onChange={(v) => set('headlineHighlight', v)} placeholder="Architect" />
          </div>
          <Input label={t('heroSub')} value={current.subheadline || ''} onChange={(v) => set('subheadline', v)} multiline rows={3} placeholder="Designing, securing and automating..." />
        </Card>

        <Card className="p-6 space-y-4">
          <SectionDivider label={t('heroCta')} />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('primaryCta')} value={current.ctaPrimary || ''} onChange={(v) => set('ctaPrimary', v)} placeholder="View Projects" />
            <Input label={t('primaryCtaUrl')} value={current.ctaPrimaryHref || ''} onChange={(v) => set('ctaPrimaryHref', v)} placeholder="/projects" />
            <Input label={t('secondaryCta')} value={current.ctaSecondary || ''} onChange={(v) => set('ctaSecondary', v)} placeholder="Book Consultation" />
            <Input label={t('secondaryCtaUrl')} value={current.ctaSecondaryHref || ''} onChange={(v) => set('ctaSecondaryHref', v)} placeholder="/consultation" />
            <Input label={t('tertiaryCta')} value={current.ctaTertiary || ''} onChange={(v) => set('ctaTertiary', v)} placeholder="Download Resume" />
            <Input label={t('tertiaryCtaUrl')} value={current.ctaTertiaryHref || ''} onChange={(v) => set('ctaTertiaryHref', v)} placeholder="/resume.pdf" />
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <SectionDivider label={t('heroStats')} />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="grid grid-cols-2 gap-2">
                <Input label={`${t('statValue')} ${n}`} value={(current as never)[`stat${n}Value`] || ''} onChange={(v) => set(`stat${n}Value` as keyof HeroData, v)} placeholder="10+" />
                <Input label={`${t('statLabel')} ${n}`} value={(current as never)[`stat${n}Label`] || ''} onChange={(v) => set(`stat${n}Label` as keyof HeroData, v)} placeholder="Years Experience" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
