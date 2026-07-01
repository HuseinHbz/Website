'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, SectionDivider, PageHeader, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'
import { ImageUploadCrop } from '@/components/admin/ImageUploadCrop'

type AboutData = {
  locale: string; headline: string; subheadline: string; bio: string
  photoUrl: string; resumeUrl: string
  yearsExp: string; projectsCount: string; endpointsCount: string; deploymentsCount: string
}

const EMPTY: AboutData = {
  locale: 'en', headline: '', subheadline: '', bio: '',
  photoUrl: '', resumeUrl: '',
  yearsExp: '', projectsCount: '', endpointsCount: '', deploymentsCount: '',
}

const SOCIAL_FIELDS = [
  { key: 'contact_email',    label: 'ایمیل',      placeholder: 'husein@habibazar.com' },
  { key: 'contact_phone',    label: 'تلفن',       placeholder: '+98...' },
  { key: 'social_linkedin',  label: 'LinkedIn',   placeholder: 'https://linkedin.com/in/...' },
  { key: 'social_instagram', label: 'Instagram',  placeholder: 'https://instagram.com/...' },
  { key: 'social_whatsapp',  label: 'WhatsApp',   placeholder: '+989...' },
  { key: 'social_telegram',  label: 'Telegram',   placeholder: 'https://t.me/...' },
  { key: 'social_twitter',   label: 'Twitter/X',  placeholder: 'https://x.com/...' },
] as const

type SocialKey = typeof SOCIAL_FIELDS[number]['key']
type SocialState = Record<SocialKey, string>

const SOCIAL_EMPTY: SocialState = { contact_email: '', contact_phone: '', social_linkedin: '', social_instagram: '', social_whatsapp: '', social_telegram: '', social_twitter: '' }

export function AboutEditor() {
  const t = useT()
  const [locale, setLocale] = useState<'en' | 'fa'>('en')
  const [data, setData] = useState<Record<string, AboutData>>({})
  const [social, setSocial] = useState<SocialState>(SOCIAL_EMPTY)
  const [saving, setSaving] = useState(false)
  const [savingSocial, setSavingSocial] = useState(false)
  const { toast, ToastContainer } = useToast()

  useEffect(() => {
    fetch('/api/admin/about').then((r) => r.json()).then((rows: AboutData[]) => {
      const map: Record<string, AboutData> = {}
      for (const r of rows) map[r.locale] = r
      setData(map)
    })
    fetch('/api/admin/settings').then((r) => r.json()).then((s: Record<string, string>) => {
      setSocial({
        contact_email:    s.contact_email    || '',
        contact_phone:    s.contact_phone    || '',
        social_linkedin:  s.social_linkedin  || '',
        social_instagram: s.social_instagram || '',
        social_whatsapp:  s.social_whatsapp  || '',
        social_telegram:  s.social_telegram  || '',
        social_twitter:   s.social_twitter   || '',
      })
    })
  }, [])

  const current = data[locale] || { ...EMPTY, locale }
  function set(k: keyof AboutData, v: string) {
    setData((d) => ({ ...d, [locale]: { ...(d[locale] || { ...EMPTY, locale }), [k]: v } }))
  }

  async function setPhotoUrl(url: string) {
    setData((prev) => {
      const next = { ...prev }
      for (const loc of ['en', 'fa']) {
        next[loc] = { ...(prev[loc] || { ...EMPTY, locale: loc }), photoUrl: url }
      }
      return next
    })
    // Auto-save photo to both locales immediately
    await Promise.all(['en', 'fa'].map((loc) =>
      fetch('/api/admin/about', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: loc, photoUrl: url }),
      })
    ))
    toast(url ? t('saved') : t('deleted'), 'success')
  }

  async function saveSocial() {
    setSavingSocial(true)
    const res = await fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(social) })
    setSavingSocial(false)
    toast(res.ok ? t('savedSuccessfully') : t('saveFailed'), res.ok ? 'success' : 'error')
  }

  async function save() {
    setSaving(true)
    // Save current locale; also sync photoUrl to the other locale
    const otherLoc = locale === 'en' ? 'fa' : 'en'
    const otherData = data[otherLoc] || { ...EMPTY, locale: otherLoc }
    const [res] = await Promise.all([
      fetch('/api/admin/about', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(current),
      }),
      fetch('/api/admin/about', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...otherData, photoUrl: current.photoUrl }),
      }),
    ])
    setSaving(false)
    toast(res.ok ? t('savedSuccessfully') : t('saveFailed'), res.ok ? 'success' : 'error')
  }

  return (
    <>
      <ToastContainer />
      <PageHeader
        title={t('aboutTitle')}
        subtitle={t('aboutSub')}
        action={
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg bg-background border border-border overflow-hidden">
              {(['en', 'fa'] as const).map((l) => (
                <button key={l} onClick={() => setLocale(l)} className={`px-4 py-1.5 text-xs font-medium transition-colors ${locale === l ? 'bg-brand text-white' : 'text-text-secondary hover:text-white'}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <Btn onClick={save} disabled={saving}>{saving ? t('saving') : t('saveChanges')}</Btn>
          </div>
        }
      />

      <div className="space-y-6">
        <Card className="p-6 space-y-4">
          <SectionDivider label={t('profileSection')} />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('headlineLabel')} value={current.headline || ''} onChange={(v) => set('headline', v)} placeholder="Infrastructure Architect" />
            <Input label={t('subheadlineLabel')} value={current.subheadline || ''} onChange={(v) => set('subheadline', v)} placeholder="& Network Security Consultant" />
          </div>
          <Input label={t('bioLabel')} value={current.bio || ''} onChange={(v) => set('bio', v)} multiline rows={6} placeholder="Professional biography shown in the About page under 'داستان حرفه‌ای' section..." />
          {/* Profile photo */}
          <ImageUploadCrop
            value={current.photoUrl || ''}
            onChange={setPhotoUrl}
            folder="profile"
            aspect={9 / 16}
            shape="rect"
            label="Profile Photo (9:16 portrait)"
            previewClass="w-32 h-[142px] rounded-xl"
          />
          <Input label="Resume PDF URL" value={current.resumeUrl || ''} onChange={(v) => set('resumeUrl', v)} placeholder="/resume.pdf" />
        </Card>

        <Card className="p-6 space-y-4">
          <SectionDivider label={t('keyStatsSection')} />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('yearsExp')} value={current.yearsExp || ''} onChange={(v) => set('yearsExp', v)} placeholder="10+" />
            <Input label={t('projectsCount')} value={current.projectsCount || ''} onChange={(v) => set('projectsCount', v)} placeholder="50+" />
            <Input label={t('endpointsCount')} value={current.endpointsCount || ''} onChange={(v) => set('endpointsCount', v)} placeholder="1000+" />
            <Input label={t('deploymentsCount')} value={current.deploymentsCount || ''} onChange={(v) => set('deploymentsCount', v)} placeholder="20+" />
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <SectionDivider label={t('contactSection')} />
          <div className="grid grid-cols-2 gap-4">
            {SOCIAL_FIELDS.map((f) => (
              <Input
                key={f.key}
                label={f.label}
                value={social[f.key]}
                onChange={(v) => setSocial((s) => ({ ...s, [f.key]: v }))}
                placeholder={f.placeholder}
              />
            ))}
          </div>
          <div className="pt-1">
            <Btn onClick={saveSocial} disabled={savingSocial}>{savingSocial ? t('saving') : t('save')}</Btn>
          </div>
        </Card>
      </div>
    </>
  )
}
