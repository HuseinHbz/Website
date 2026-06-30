'use client'

import { useState, useEffect, useRef } from 'react'
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
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
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

  async function uploadPhoto(file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('folder', 'profile')
    fd.append('alt', 'Husein Habibazar profile photo')
    const res = await fetch('/api/admin/media', { method: 'POST', body: fd })
    setUploading(false)
    if (res.ok) {
      const d = await res.json()
      const photoUrl: string = d.url?.startsWith('/') ? d.url : `/${d.url}`
      // update photoUrl for both locales so the photo is shared
      setData((prev) => {
        const next = { ...prev }
        for (const loc of ['en', 'fa']) {
          next[loc] = { ...(prev[loc] || { ...EMPTY, locale: loc }), photoUrl }
        }
        return next
      })
      toast('Photo uploaded successfully', 'success')
    } else {
      toast('Upload failed', 'error')
    }
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
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) uploadPhoto(e.target.files[0]) }}
      />
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
          {/* Profile photo */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-400">Profile Photo</p>
            <div className="flex items-start gap-4">
              {/* Preview */}
              <div className="flex-shrink-0">
                {uploading ? (
                  <div className="w-20 h-20 rounded-full flex items-center justify-center border-2 border-indigo-500/40 bg-indigo-500/10 animate-pulse">
                    <span className="text-indigo-400 text-xs">...</span>
                  </div>
                ) : current.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={current.photoUrl.startsWith('/') ? current.photoUrl : `/${current.photoUrl}`}
                    alt="Profile"
                    className="w-20 h-20 rounded-full object-cover border-2 border-indigo-500/40 shadow-lg"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full flex items-center justify-center font-black text-xl text-white border-2 border-slate-700"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)' }}>
                    HBZ
                  </div>
                )}
              </div>
              {/* Upload + URL */}
              <div className="flex-1 space-y-2">
                <Btn variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? '⏳ Uploading...' : '↑ Upload Photo'}
                </Btn>
                <Input
                  label="Or paste URL"
                  value={current.photoUrl || ''}
                  onChange={(v) => set('photoUrl', v)}
                  placeholder="/uploads/profile/photo.jpg"
                />
                {current.photoUrl && (
                  <button
                    onClick={() => set('photoUrl', '')}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    ✕ Remove photo
                  </button>
                )}
              </div>
            </div>
          </div>
          <Input label="Resume PDF URL" value={current.resumeUrl || ''} onChange={(v) => set('resumeUrl', v)} placeholder="/resume.pdf" />
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
