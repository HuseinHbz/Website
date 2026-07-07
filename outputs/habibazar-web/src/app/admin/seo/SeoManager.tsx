'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, Select, PageHeader, SectionDivider, useToast, Badge, Modal } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

const PAGES = ['home', 'about', 'services', 'case-studies', 'blog', 'consultation', 'contact']
type Tab = 'meta' | 'redirects' | 'robots' | 'sitemap'

type SeoEntry = { pageKey: string; locale: string; metaTitle: string; metaDescription: string; keywords: string; ogTitle: string; ogDescription: string; ogImage: string; schemaMarkup: string; canonicalUrl: string }
const EMPTY_SEO: SeoEntry = { pageKey: 'home', locale: 'en', metaTitle: '', metaDescription: '', keywords: '', ogTitle: '', ogDescription: '', ogImage: '', schemaMarkup: '', canonicalUrl: '' }

type Redirect = { id?: number; fromPath: string; toPath: string; statusCode: number; active: boolean; hits?: number }
const EMPTY_REDIRECT: Redirect = { fromPath: '', toPath: '', statusCode: 301, active: true }

export function SeoManager() {
  const t = useT()
  const seoLocale = useAdminLocale()
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
    toast(res.ok ? t('saved') : t('failed'), res.ok ? 'success' : 'error')
  }

  async function saveRedirect() {
    setSavingRedirect(true)
    const res = await fetch('/api/admin/redirects', { method: editingRedirect.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingRedirect) })
    setSavingRedirect(false)
    if (res.ok) { toast(t('saved')); setRedirectModal(false); fetch('/api/admin/redirects').then(r => r.json()).then(d => setRedirects(Array.isArray(d) ? d : [])) }
    else toast(t('failed'), 'error')
  }

  async function deleteRedirect(id: number) {
    if (!confirm(t('confirmDel'))) return
    await fetch('/api/admin/redirects', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setRedirects(prev => prev.filter(r => r.id !== id))
    toast(t('deleted'))
  }

  async function saveRobots() {
    setSavingRobots(true)
    const all = await fetch('/api/admin/settings').then(r => r.json()).catch(() => ({}))
    const res = await fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...all, robots_txt: robotsTxt }) })
    setSavingRobots(false)
    toast(res.ok ? t('saved') : t('failed'), res.ok ? 'success' : 'error')
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
      <PageHeader title={t('seoControlTitle')} subtitle={t('seoControlSub')} />

      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(tabItem => (
          <button key={tabItem.id} onClick={() => setTab(tabItem.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === tabItem.id ? 'bg-brand text-white' : 'bg-surface text-text-secondary border border-border hover:text-white'}`}>
            {tabItem.label}
          </button>
        ))}
      </div>

      {tab === 'meta' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={page} onChange={setPage} options={PAGES.map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1).replace('-', ' ') }))} />
            <div className="flex rounded-lg bg-background border border-border overflow-hidden">
              {(['en', 'fa'] as const).map(l => (
                <button key={l} onClick={() => setLocale(l)} className={`px-4 py-1.5 text-xs font-medium transition-colors ${locale === l ? 'bg-brand text-white' : 'text-text-secondary hover:text-white'}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <Btn onClick={saveSeo} disabled={savingSeo}>{savingSeo ? t('saving') : t('save')}</Btn>
          </div>
          <Card className="p-6 space-y-4">
            <SectionDivider label="Meta Tags" />
            <Input label="Meta Title" value={current.metaTitle} onChange={v => setSeoField('metaTitle', v)} placeholder="Page Title | HBZ Technology" />
            <div className="text-xs text-text-disabled -mt-2">{current.metaTitle.length}/60 {current.metaTitle.length > 60 ? '⚠ Too long' : '✓'}</div>
            <Input label="Meta Description" value={current.metaDescription} onChange={v => setSeoField('metaDescription', v)} multiline rows={3} placeholder="Description for search engines..." />
            <div className="text-xs text-text-disabled -mt-2">{current.metaDescription.length}/160 {current.metaDescription.length > 160 ? '⚠ Too long' : '✓'}</div>
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
            <div className="mt-2 p-4 bg-background rounded-lg">
              <p className="text-blue-400 text-base">{current.metaTitle || '(Page Title)'}</p>
              <p className="text-green-600 text-xs">{current.canonicalUrl || `https://habibazar.com/${page === 'home' ? '' : page}`}</p>
              <p className="text-text-secondary text-sm mt-1">{current.metaDescription || '(No description set)'}</p>
            </div>
          </Card>
        </div>
      )}

      {tab === 'redirects' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Btn onClick={() => { setEditingRedirect(EMPTY_REDIRECT); setRedirectModal(true) }}>{t('addRedirect')}</Btn>
          </div>
          <Card>
            <DataTable
              tableId="seo-redirects"
              columns={[
                { key: 'fromPath', labelEn: 'From', labelFa: t('fromPath'), render: r => <span className="font-mono text-text-primary text-xs">{r.fromPath}</span> },
                { key: 'toPath', labelEn: 'To', labelFa: t('toPath'), render: r => <span className="font-mono text-brand text-xs">{r.toPath}</span> },
                { key: 'statusCode', labelEn: 'Code', labelFa: t('statusCode2'), type: 'enum', options: [301, 302].map(x => ({ value: String(x), labelEn: String(x), labelFa: String(x) })), render: r => <Badge color={r.statusCode === 301 ? 'indigo' : 'yellow'}>{r.statusCode}</Badge> },
                { key: 'hits', labelEn: 'Hits', labelFa: t('hits'), type: 'number', numeric: true, value: r => r.hits ?? 0, render: r => <span className="text-text-tertiary text-xs">{r.hits ?? 0}</span> },
                { key: 'active', labelEn: 'Status', labelFa: t('status'), type: 'boolean', value: r => r.active, render: r => <Badge color={r.active ? 'green' : 'slate'}>{r.active ? t('active') : t('off')}</Badge> },
              ] as Column<Redirect>[]}
              rows={redirects}
              locale={seoLocale}
              rowKey={r => String(r.id)}
              rowActions={[
                { id: 'edit', labelEn: 'Edit', labelFa: t('edit'), icon: '✎', onClick: r => { setEditingRedirect(r); setRedirectModal(true) } },
                { id: 'del', labelEn: 'Delete', labelFa: t('del'), icon: '🗑', danger: true, onClick: r => deleteRedirect(r.id!) },
              ] as RowAction<Redirect>[]}
              exportName="seo-redirects"
              emptyLabel="No redirects configured yet"
            />
          </Card>
          <Modal open={redirectModal} onClose={() => setRedirectModal(false)} title={editingRedirect.id ? t('editRedirect') : t('addRedirect')} size="md">
            <div className="space-y-4">
              <Input label={t('fromPath')} value={editingRedirect.fromPath} onChange={v => setEditingRedirect(e => ({ ...e, fromPath: v }))} placeholder="/old-page" />
              <Input label={t('toPath')} value={editingRedirect.toPath} onChange={v => setEditingRedirect(e => ({ ...e, toPath: v }))} placeholder="/new-page" />
              <div className="grid grid-cols-2 gap-4">
                <Select label={t('statusCode')} value={String(editingRedirect.statusCode)} onChange={v => setEditingRedirect(e => ({ ...e, statusCode: Number(v) }))} options={[
                  { value: '301', label: '301 — Permanent' }, { value: '302', label: '302 — Temporary' },
                  { value: '307', label: '307 — Temp (method-safe)' }, { value: '308', label: '308 — Perm (method-safe)' },
                ]} />
                <Select label="Status" value={editingRedirect.active ? 'true' : 'false'} onChange={v => setEditingRedirect(e => ({ ...e, active: v === 'true' }))} options={[{ value: 'true', label: t('active') }, { value: 'false', label: t('disabled') }]} />
              </div>
              <div className="flex gap-3">
                <Btn onClick={saveRedirect} disabled={savingRedirect}>{savingRedirect ? t('saving') : t('save')}</Btn>
                <Btn variant="secondary" onClick={() => setRedirectModal(false)}>{t('cancel')}</Btn>
              </div>
            </div>
          </Modal>
        </div>
      )}

      {tab === 'robots' && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <SectionDivider label="robots.txt Configuration" />
            <Btn onClick={saveRobots} disabled={savingRobots}>{savingRobots ? t('saving') : t('saveRobots')}</Btn>
          </div>
          <p className="text-xs text-text-tertiary">Served at <code className="text-brand">/robots.txt</code></p>
          <textarea value={robotsTxt} onChange={e => setRobotsTxt(e.target.value)} rows={16}
            className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-brand transition-colors" />
          <div className="flex gap-3">
            <button onClick={() => setRobotsTxt('User-agent: *\nAllow: /\n\nSitemap: https://habibazar.com/sitemap.xml')} className="text-xs text-brand hover:text-brand">Reset to default</button>
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
              <p className="text-sm text-white">Dynamic sitemap is active at <code className="text-brand">/sitemap.xml</code></p>
              <p className="text-xs text-text-tertiary">Includes all pages, case studies, and blog posts automatically</p>
            </div>
          </div>
          {[
            { url: '/', priority: '1.0', freq: 'daily' }, { url: '/case-studies', priority: '0.9', freq: 'weekly' },
            { url: '/blog', priority: '0.8', freq: 'weekly' }, { url: '/about', priority: '0.7', freq: 'monthly' },
            { url: '/consultation', priority: '0.8', freq: 'monthly' }, { url: '/contact', priority: '0.6', freq: 'monthly' },
          ].map(item => (
            <div key={item.url} className="flex items-center gap-4 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <code className="text-xs text-brand flex-1">{item.url}</code>
              <Badge color="indigo">priority: {item.priority}</Badge>
              <Badge color="slate">{item.freq}</Badge>
            </div>
          ))}
        </Card>
      )}
    </>
  )
}
