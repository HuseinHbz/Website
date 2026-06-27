'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, SectionDivider, PageHeader, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

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
  const { toast, ToastContainer } = useToast()

  useEffect(() => {
    fetch('/api/admin/hero')
      .then((r) => r.json())
      .then((rows: HeroData[]) => {
        const map: Record<string, HeroData> = {}
        for (const r of rows) map[r.locale] = r
        setData(map)
      })
  }, [])

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
