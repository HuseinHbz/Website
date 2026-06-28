'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, SectionDivider, PageHeader, useToast } from '@/components/admin/ui'

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

export function AboutEditor() {
  const [locale, setLocale] = useState<'en' | 'fa'>('en')
  const [data, setData] = useState<Record<string, AboutData>>({})
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  useEffect(() => {
    fetch('/api/admin/about').then((r) => r.json()).then((rows: AboutData[]) => {
      const map: Record<string, AboutData> = {}
      for (const r of rows) map[r.locale] = r
      setData(map)
    })
  }, [])

  const current = data[locale] || { ...EMPTY, locale }
  function set(k: keyof AboutData, v: string) {
    setData((d) => ({ ...d, [locale]: { ...(d[locale] || { ...EMPTY, locale }), [k]: v } }))
  }

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/about', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(current),
    })
    setSaving(false)
    toast(res.ok ? 'Saved successfully' : 'Save failed', res.ok ? 'success' : 'error')
  }

  return (
    <>
      <ToastContainer />
      <PageHeader
        title="About / Bio"
        subtitle="Edit your professional biography and key metrics"
        action={
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg bg-[#0c0c14] border border-[#2a2a3e] overflow-hidden">
              {(['en', 'fa'] as const).map((l) => (
                <button key={l} onClick={() => setLocale(l)} className={`px-4 py-1.5 text-xs font-medium transition-colors ${locale === l ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Btn>
          </div>
        }
      />

      <div className="space-y-6">
        <Card className="p-6 space-y-4">
          <SectionDivider label="Profile" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Headline" value={current.headline || ''} onChange={(v) => set('headline', v)} placeholder="Infrastructure Architect" />
            <Input label="Subheadline" value={current.subheadline || ''} onChange={(v) => set('subheadline', v)} placeholder="& Network Security Consultant" />
          </div>
          <Input label="داستان حرفه‌ای / Professional Story (bio)" value={current.bio || ''} onChange={(v) => set('bio', v)} multiline rows={6} placeholder="Professional biography shown in the About page under 'داستان حرفه‌ای' section..." />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Photo URL" value={current.photoUrl || ''} onChange={(v) => set('photoUrl', v)} placeholder="/uploads/photo.jpg" />
            <Input label="Resume PDF URL" value={current.resumeUrl || ''} onChange={(v) => set('resumeUrl', v)} placeholder="/resume.pdf" />
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <SectionDivider label="Key Statistics" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Years Experience" value={current.yearsExp || ''} onChange={(v) => set('yearsExp', v)} placeholder="10+" />
            <Input label="Projects Count" value={current.projectsCount || ''} onChange={(v) => set('projectsCount', v)} placeholder="50+" />
            <Input label="Managed Endpoints" value={current.endpointsCount || ''} onChange={(v) => set('endpointsCount', v)} placeholder="1000+" />
            <Input label="Production Deployments" value={current.deploymentsCount || ''} onChange={(v) => set('deploymentsCount', v)} placeholder="20+" />
          </div>
        </Card>
      </div>
    </>
  )
}
