'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, Select, PageHeader, SectionDivider, useToast, Badge, Table, TR, TD, Modal } from '@/components/admin/ui'

const PAGES = ['home', 'about', 'services', 'case-studies', 'blog', 'consultation', 'contact']
type Tab = 'meta' | 'redirects' | 'robots' | 'sitemap'

type SeoEntry = { pageKey: string; locale: string; metaTitle: string; metaDescription: string; keywords: string; ogTitle: string; ogDescription: string; ogImage: string; schemaMarkup: string; canonicalUrl: string }
const EMPTY_SEO: SeoEntry = { pageKey: 'home', locale: 'en', metaTitle: '', metaDescription: '', keywords: '', ogTitle: '', ogDescription: '', ogImage: '', schemaMarkup: '', canonicalUrl: '' }

type Redirect = { id?: number; fromPath: string; toPath: string; statusCode: number; active: boolean; hits?: number }
const EMPTY_REDIRECT: Redirect = { fromPath: '', toPath: '', statusCode: 301, active: true }

export function SeoManager() {
  const [tab, setTab] = useState<Tab>('meta')
  const [page, setPage] = useState('home')
  const [locale, setLocale] = useState<'en' | 'fa'>('en')
  const [seoData, setSeoData] = useState<Record<string, SeoEntry>>({})
  const [savingSeo, setSavingSeo] = useState(false)
  const [redirects, setRedirects] = useState<Redirect[]>([])
  const [redirectModal, setRedirectModal] = useState(false)
  const [editingRedirect, setEditingRedirect] = useState<Redirect>(EMPTY_REDIRECT)
  const [savingRedirect, setSavingRedirect] = useState(false)
  const [robotsTxt, setRobotsTxt] = useState('User-agent: *\nAllow: /\n\nSitemap: https://habibazar.com/sitemap.xml')
  const [savingRobots, setSavingRobots] = useState(false)
  const { toast, ToastContainer } = useToast()

  useEffect(() => {
    fetch('/api/admin/seo').then(r => r.json()).then((rows: SeoEntry[]) => {
      const map: Record<string, SeoEntry> = {}
      for (const r of rows) map[`${r.pageKey}:${r.locale}`] = r
      setSeoData(map)
    })
    fetch('/api/admin/redirects').then(r => r.json()).then(d => setRedirects(Array.isArray(d) ? d : [])).catch(() => {})
    fetch('/api/admin/settings').then(r => r.json()).then(d => { if (d?.robots_txt) setRobotsTxt(d.robots_txt) }).catch(() => {})
  }, [])

  const key = `${page}:${locale}`
  const current = seoData[key] || { ...EMPTY_SEO, pageKey: page, locale }
  function setSeoField(k: keyof SeoEntry, v: string) {
    setSeoData(d => ({ ...d, [key]: { ...(d[key] || { ...EMPTY_SEO, pageKey: page, locale }), [k]: v } }))
  }
  async function saveSeo() {
    setSavingSeo(true)
    const res = await fetch('/api/admin/seo', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(current) })
    setSavingSeo(false)
    toast(res.ok ? 'SEO settings saved' : 'Failed', res.ok ? 'success' : 'error')
  }

  async function saveRedirect() {
    setSavingRedirect(true)
    const res = await fetch('/api/admin/redirects', { method: editingRedirect.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingRedirect) })
    setSavingRedirect(false)
    if (res.ok) { toast('Saved'); setRedirectModal(false); fetch('/api/admin/redirects').then(r => r.json()).then(d => setRedirects(Array.isArray(d) ? d : [])) }
    else toast('Failed', 'error')
  }

  async function deleteRedirect(id: number) {
    if (!confirm('Delete redirect?')) return
    await fetch('/api/admin/redirects', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setRedirects(prev => prev.filter(r => r.id !== id))
    toast('Deleted')
  }

  async function saveRobots() {
    setSavingRobots(true)
    const all = await fetch('/api/admin/settings').then(r => r.json()).catch(() => ({}))
    const res = await fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...all, robots_txt: robotsTxt }) })
    setSavingRobots(false)
    toast(res.ok ? 'Robots.txt saved' : 'Failed', res.ok ? 'success' : 'error')
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'meta', label: '🏷 Meta & OpenGraph' },
    { id: 'redirects', label: '↪ Redirects' },
    { id: 'robots', label: '🤖 Robots.txt' },
    { id: 'sitemap', label: '🗺 Sitemap' },
  ]

  return (
    <>
      <ToastContainer />
      <PageHeader title="SEO Control Center" subtitle="Manage meta tags, Open Graph, redirects, robots.txt, and sitemap" />

      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-indigo-600 text-white' : 'bg-[#111122] text-slate-400 border border-[#2a2a3e] hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'meta' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={page} onChange={setPage} options={PAGES.map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1).replace('-', ' ') }))} />
            <div className="flex rounded-lg bg-[#0c0c14] border border-[#2a2a3e] overflow-hidden">
              {(['en', 'fa'] as const).map(l => (
                <button key={l} onClick={() => setLocale(l)} className={`px-4 py-1.5 text-xs font-medium transition-colors ${locale === l ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <Btn onClick={saveSeo} disabled={savingSeo}>{savingSeo ? 'Saving...' : 'Save'}</Btn>
          </div>
          <Card className="p-6 space-y-4">
            <SectionDivider label="Meta Tags" />
            <Input label="Meta Title" value={current.metaTitle} onChange={v => setSeoField('metaTitle', v)} placeholder="Page Title | HBZ Technology" />
            <div className="text-xs text-slate-600 -mt-2">{current.metaTitle.length}/60 {current.metaTitle.length > 60 ? '⚠ Too long' : '✓'}</div>
            <Input label="Meta Description" value={current.metaDescription} onChange={v => setSeoField('metaDescription', v)} multiline rows={3} placeholder="Description for search engines..." />
            <div className="text-xs text-slate-600 -mt-2">{current.metaDescription.length}/160 {current.metaDescription.length > 160 ? '⚠ Too long' : '✓'}</div>
            <Input label="Keywords" value={current.keywords} onChange={v => setSeoField('keywords', v)} placeholder="MikroTik, Cisco, Network Security" />
            <Input label="Canonical URL" value={current.canonicalUrl} onChange={v => setSeoField('canonicalUrl', v)} placeholder="https://habibazar.com/..." />
          </Card>
          <Card className="p-6 space-y-4">
            <SectionDivider label="Open Graph (Social Media)" />
            <Input label="OG Title" value={current.ogTitle} onChange={v => setSeoField('ogTitle', v)} />
            <Input label="OG Description" value={current.ogDescription} onChange={v => setSeoField('ogDescription', v)} multiline rows={2} />
            <Input label="OG Image URL (1200×630)" value={current.ogImage} onChange={v => setSeoField('ogImage', v)} placeholder="/uploads/og/page-og.png" />
          </Card>
          <Card className="p-6 space-y-4">
            <SectionDivider label="Schema Markup (JSON-LD)" />
            <Input label="Custom JSON-LD" value={current.schemaMarkup} onChange={v => setSeoField('schemaMarkup', v)} multiline rows={8} placeholder={'{\n  "@context": "https://schema.org",\n  "@type": "Person"\n}'} />
          </Card>
          <Card className="p-6">
            <SectionDivider label="Search Preview" />
            <div className="mt-2 p-4 bg-[#0c0c14] rounded-lg">
              <p className="text-blue-400 text-base">{current.metaTitle || '(Page Title)'}</p>
              <p className="text-green-600 text-xs">{current.canonicalUrl || `https://habibazar.com/${page === 'home' ? '' : page}`}</p>
              <p className="text-slate-400 text-sm mt-1">{current.metaDescription || '(No description set)'}</p>
            </div>
          </Card>
        </div>
      )}

      {tab === 'redirects' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Btn onClick={() => { setEditingRedirect(EMPTY_REDIRECT); setRedirectModal(true) }}>+ Add Redirect</Btn>
          </div>
          <Card>
            <Table headers={['From', 'To', 'Code', 'Hits', 'Status', 'Actions']}>
              {redirects.map(r => (
                <TR key={r.id}>
                  <TD className="font-mono text-slate-300 text-xs">{r.fromPath}</TD>
                  <TD className="font-mono text-indigo-400 text-xs">{r.toPath}</TD>
                  <TD><Badge color={r.statusCode === 301 ? 'indigo' : 'yellow'}>{r.statusCode}</Badge></TD>
                  <TD className="text-slate-500 text-xs">{r.hits ?? 0}</TD>
                  <TD><Badge color={r.active ? 'green' : 'slate'}>{r.active ? 'Active' : 'Off'}</Badge></TD>
                  <TD>
                    <div className="flex gap-2">
                      <Btn size="sm" variant="secondary" onClick={() => { setEditingRedirect(r); setRedirectModal(true) }}>Edit</Btn>
                      <Btn size="sm" variant="danger" onClick={() => deleteRedirect(r.id!)}>Del</Btn>
                    </div>
                  </TD>
                </TR>
              ))}
            </Table>
            {redirects.length === 0 && <div className="text-center py-12 text-slate-600 text-sm">No redirects configured yet</div>}
          </Card>
          <Modal open={redirectModal} onClose={() => setRedirectModal(false)} title={editingRedirect.id ? 'Edit Redirect' : 'New Redirect'} size="md">
            <div className="space-y-4">
              <Input label="From Path *" value={editingRedirect.fromPath} onChange={v => setEditingRedirect(e => ({ ...e, fromPath: v }))} placeholder="/old-page" />
              <Input label="To Path *" value={editingRedirect.toPath} onChange={v => setEditingRedirect(e => ({ ...e, toPath: v }))} placeholder="/new-page" />
              <div className="grid grid-cols-2 gap-4">
                <Select label="Status Code" value={String(editingRedirect.statusCode)} onChange={v => setEditingRedirect(e => ({ ...e, statusCode: Number(v) }))} options={[
                  { value: '301', label: '301 — Permanent' }, { value: '302', label: '302 — Temporary' },
                  { value: '307', label: '307 — Temp (method-safe)' }, { value: '308', label: '308 — Perm (method-safe)' },
                ]} />
                <Select label="Status" value={editingRedirect.active ? 'true' : 'false'} onChange={v => setEditingRedirect(e => ({ ...e, active: v === 'true' }))} options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Disabled' }]} />
              </div>
              <div className="flex gap-3">
                <Btn onClick={saveRedirect} disabled={savingRedirect}>{savingRedirect ? 'Saving...' : 'Save'}</Btn>
                <Btn variant="secondary" onClick={() => setRedirectModal(false)}>Cancel</Btn>
              </div>
            </div>
          </Modal>
        </div>
      )}

      {tab === 'robots' && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <SectionDivider label="robots.txt Configuration" />
            <Btn onClick={saveRobots} disabled={savingRobots}>{savingRobots ? 'Saving...' : 'Save robots.txt'}</Btn>
          </div>
          <p className="text-xs text-slate-500">Served at <code className="text-indigo-400">/robots.txt</code></p>
          <textarea value={robotsTxt} onChange={e => setRobotsTxt(e.target.value)} rows={16}
            className="w-full bg-[#0c0c14] border border-[#2a2a3e] rounded-lg px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-indigo-500 transition-colors" />
          <div className="flex gap-3">
            <button onClick={() => setRobotsTxt('User-agent: *\nAllow: /\n\nSitemap: https://habibazar.com/sitemap.xml')} className="text-xs text-indigo-400 hover:text-indigo-300">Reset to default</button>
            <button onClick={() => setRobotsTxt('User-agent: *\nDisallow: /')} className="text-xs text-red-400 hover:text-red-300">Block all crawlers</button>
          </div>
        </Card>
      )}

      {tab === 'sitemap' && (
        <Card className="p-6 space-y-4">
          <SectionDivider label="Sitemap Status" />
          <div className="p-3 rounded-lg flex items-center gap-3" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <span className="text-emerald-400">✓</span>
            <div>
              <p className="text-sm text-white">Dynamic sitemap is active at <code className="text-indigo-400">/sitemap.xml</code></p>
              <p className="text-xs text-slate-500">Includes all pages, case studies, and blog posts automatically</p>
            </div>
          </div>
          {[
            { url: '/', priority: '1.0', freq: 'daily' }, { url: '/case-studies', priority: '0.9', freq: 'weekly' },
            { url: '/blog', priority: '0.8', freq: 'weekly' }, { url: '/about', priority: '0.7', freq: 'monthly' },
            { url: '/consultation', priority: '0.8', freq: 'monthly' }, { url: '/contact', priority: '0.6', freq: 'monthly' },
          ].map(item => (
            <div key={item.url} className="flex items-center gap-4 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <code className="text-xs text-indigo-400 flex-1">{item.url}</code>
              <Badge color="indigo">priority: {item.priority}</Badge>
              <Badge color="slate">{item.freq}</Badge>
            </div>
          ))}
        </Card>
      )}
    </>
  )
}
