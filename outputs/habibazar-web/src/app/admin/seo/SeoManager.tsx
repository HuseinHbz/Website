'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, Select, PageHeader, SectionDivider, useToast } from '@/components/admin/ui'

const PAGES = ['home', 'about', 'services', 'projects', 'blog', 'consultation']

type SeoEntry = { pageKey: string; locale: string; metaTitle: string; metaDescription: string; keywords: string; ogTitle: string; ogDescription: string; ogImage: string; schemaMarkup: string; canonicalUrl: string }
const EMPTY: SeoEntry = { pageKey: 'home', locale: 'en', metaTitle: '', metaDescription: '', keywords: '', ogTitle: '', ogDescription: '', ogImage: '', schemaMarkup: '', canonicalUrl: '' }

export function SeoManager() {
  const [page, setPage] = useState('home')
  const [locale, setLocale] = useState<'en' | 'fa'>('en')
  const [data, setData] = useState<Record<string, SeoEntry>>({})
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  useEffect(() => {
    fetch('/api/admin/seo').then((r) => r.json()).then((rows: SeoEntry[]) => {
      const map: Record<string, SeoEntry> = {}
      for (const r of rows) map[`${r.pageKey}:${r.locale}`] = r
      setData(map)
    })
  }, [])

  const key = `${page}:${locale}`
  const current = data[key] || { ...EMPTY, pageKey: page, locale }
  function set(k: keyof SeoEntry, v: string) {
    setData((d) => ({ ...d, [key]: { ...(d[key] || { ...EMPTY, pageKey: page, locale }), [k]: v } }))
  }

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/seo', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(current) })
    setSaving(false)
    toast(res.ok ? 'SEO settings saved' : 'Failed', res.ok ? 'success' : 'error')
  }

  return (
    <>
      <ToastContainer />
      <PageHeader
        title="SEO Management"
        subtitle="Configure meta tags, Open Graph, and schema markup per page"
        action={
          <div className="flex items-center gap-3">
            <Select value={page} onChange={setPage} options={PAGES.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))} />
            <div className="flex rounded-lg bg-[#0c0c14] border border-[#2a2a3e] overflow-hidden">
              {(['en', 'fa'] as const).map((l) => (
                <button key={l} onClick={() => setLocale(l)} className={`px-4 py-1.5 text-xs font-medium transition-colors ${locale === l ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Btn>
          </div>
        }
      />

      <div className="space-y-6">
        <Card className="p-6 space-y-4">
          <SectionDivider label="Meta Tags" />
          <Input label="Meta Title" value={current.metaTitle} onChange={(v) => set('metaTitle', v)} placeholder="Page Title | HBZ" />
          <div className="text-xs text-slate-600">{current.metaTitle.length}/60 characters</div>
          <Input label="Meta Description" value={current.metaDescription} onChange={(v) => set('metaDescription', v)} multiline rows={3} placeholder="Description for search engines..." />
          <div className="text-xs text-slate-600">{current.metaDescription.length}/160 characters</div>
          <Input label="Keywords (comma-separated)" value={current.keywords} onChange={(v) => set('keywords', v)} placeholder="MikroTik, Cisco, Network Security, Infrastructure" />
          <Input label="Canonical URL" value={current.canonicalUrl} onChange={(v) => set('canonicalUrl', v)} placeholder="https://habibazar.com/..." />
        </Card>

        <Card className="p-6 space-y-4">
          <SectionDivider label="Open Graph (Social Media)" />
          <Input label="OG Title" value={current.ogTitle} onChange={(v) => set('ogTitle', v)} placeholder="Same as meta title or custom" />
          <Input label="OG Description" value={current.ogDescription} onChange={(v) => set('ogDescription', v)} multiline rows={2} />
          <Input label="OG Image URL" value={current.ogImage} onChange={(v) => set('ogImage', v)} placeholder="/uploads/og/page-og.png (1200x630)" />
        </Card>

        <Card className="p-6 space-y-4">
          <SectionDivider label="Schema Markup (JSON-LD)" />
          <Input
            label="Custom JSON-LD Schema"
            value={current.schemaMarkup}
            onChange={(v) => set('schemaMarkup', v)}
            multiline
            rows={8}
            placeholder={'{\n  "@context": "https://schema.org",\n  "@type": "Person",\n  ...\n}'}
          />
          <p className="text-xs text-slate-600">Enter valid JSON-LD markup. This will be injected into the page &lt;head&gt;.</p>
        </Card>

        {/* Preview */}
        <Card className="p-6">
          <SectionDivider label="Search Preview" />
          <div className="mt-2 p-4 bg-[#0c0c14] rounded-lg">
            <p className="text-blue-400 text-base">{current.metaTitle || '(Page Title)'}</p>
            <p className="text-green-600 text-xs">{current.canonicalUrl || `https://habibazar.com/${page === 'home' ? '' : page}`}</p>
            <p className="text-slate-400 text-sm mt-1">{current.metaDescription || '(No description set)'}</p>
          </div>
        </Card>
      </div>
    </>
  )
}
