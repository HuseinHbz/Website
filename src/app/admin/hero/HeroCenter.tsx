'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'
import { HERO_TEMPLATES } from '@/lib/hero/templates'
import { validateHero } from '@/lib/hero/rules'
import type { HeroConfig, HeroRecord, HeroStatus, HeroCta, Locale } from '@/lib/hero/types'
import { HERO_BG_VIDEOS } from '@/lib/heroBgVideos'
import { HERO_ORBIT_STYLES, DEFAULT_ORBIT_STYLE } from '@/lib/heroOrbitStyles'
import { HERO_LAYOUTS, DEFAULT_HERO_LAYOUT } from '@/lib/heroLayouts'
import { OrbitalNetwork } from '@/components/sections/OrbitalNetwork'
import { HeroLayoutPreview } from '@/components/sections/HeroLayoutPreview'
import { HeroBuilder } from './HeroBuilder'
import { TimelineStudio } from './TimelineStudio'
import { HeroMediaUploadModal } from '@/components/admin/HeroMediaUploadModal'

type Tab = 'dashboard' | 'heroes' | 'content' | 'layout' | 'background' | 'library' | 'experiments' | 'analytics'
interface MediaRow { id: number; url: string; originalName: string; mimeType: string }
const lc = (rtl: boolean, en: string, fa: string) => (rtl ? fa : en)
const STATUS_COLOR: Record<HeroStatus, string> = { draft: 'slate', review: 'yellow', approved: 'blue', published: 'green', archived: 'red' }

export function HeroCenter() {
  const rtl = useAdminLocale() === 'fa'
  const locale = useAdminLocale()
  const { toast, ToastContainer } = useToast()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [editingId, setEditingId] = useState<number | null>(null)

  if (editingId != null) {
    return <><ToastContainer /><HeroBuilder id={editingId} onBack={() => setEditingId(null)} toast={toast} /></>
  }

  const TABS: { id: Tab; en: string; fa: string }[] = [
    { id: 'dashboard', en: 'Dashboard', fa: 'داشبورد' },
    { id: 'heroes', en: 'Heroes', fa: 'هیروها' },
    { id: 'content', en: 'Content', fa: 'محتوا' },
    { id: 'layout', en: 'Layout', fa: 'چیدمان' },
    { id: 'background', en: 'Video Background', fa: 'پس‌زمینه ویدیویی' },
    { id: 'library', en: 'Animation Library', fa: 'کتابخانه انیمیشن' },
    { id: 'experiments', en: 'A/B Testing', fa: 'آزمون A/B' },
    { id: 'analytics', en: 'Analytics', fa: 'تحلیل‌ها' },
  ]

  return (
    <>
      <ToastContainer />
      <PageHeader title={lc(rtl, 'Hero Experience Platform', 'پلتفرم تجربه هیرو')} subtitle={lc(rtl, 'Enterprise landing experiences — templates, builder, A/B, analytics', 'تجربه‌های صفحه اصلی سازمانی')} />
      <div className="flex gap-1 mb-6 border-b border-subtle flex-wrap">
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === tb.id ? 'border-brand text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}>{lc(rtl, tb.en, tb.fa)}</button>
        ))}
      </div>
      {tab === 'dashboard' && <Dashboard rtl={rtl} onOpen={setEditingId} />}
      {tab === 'heroes' && <Heroes rtl={rtl} locale={locale} toast={toast} onOpen={setEditingId} />}
      {tab === 'content' && <ContentEditor rtl={rtl} toast={toast} />}
      {tab === 'layout' && <LayoutPicker rtl={rtl} toast={toast} />}
      {tab === 'background' && <VideoBackground rtl={rtl} toast={toast} />}
      {tab === 'library' && <AnimationLibrary rtl={rtl} locale={locale} toast={toast} />}
      {tab === 'experiments' && <Experiments rtl={rtl} locale={locale} toast={toast} />}
      {tab === 'analytics' && <Analytics rtl={rtl} locale={locale} />}
    </>
  )
}

type Toast = ReturnType<typeof useToast>['toast']

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: 'ok' | 'warn' }) {
  const ring = tone === 'ok' ? 'border-success/40' : tone === 'warn' ? 'border-warning/40' : 'border-subtle'
  return <div className={`rounded-xl p-4 bg-surface-2 border ${ring}`}><p className="text-xs text-text-tertiary mb-1">{label}</p><p className="text-2xl font-bold text-text-primary">{value}</p></div>
}

function Dashboard({ rtl, onOpen }: { rtl: boolean; onOpen: (id: number) => void }) {
  const [heroes, setHeroes] = useState<(HeroRecord & { valid: boolean })[]>([])
  const [a, setA] = useState<{ totals?: { views: number; ctr: number; conversionRate: number }; topHeroName?: string | null } | null>(null)
  const [exps, setExps] = useState<{ status: string }[]>([])
  useEffect(() => {
    fetch('/api/admin/heroes').then(r => r.json()).then(d => setHeroes(d.heroes ?? [])).catch(() => {})
    fetch('/api/admin/heroes/analytics').then(r => r.json()).then(setA).catch(() => {})
    fetch('/api/admin/heroes/experiments').then(r => r.json()).then(d => setExps(d.experiments ?? [])).catch(() => {})
  }, [])
  const published = heroes.filter(h => h.status === 'published').length
  const running = exps.filter(e => e.status === 'running').length
  const drafts = heroes.filter(h => h.status !== 'published' && h.status !== 'archived').length
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label={lc(rtl, 'Total heroes', 'کل هیروها')} value={heroes.length} />
        <Kpi label={lc(rtl, 'Published', 'منتشرشده')} value={published} tone="ok" />
        <Kpi label={lc(rtl, 'In progress', 'در جریان')} value={drafts} tone="warn" />
        <Kpi label={lc(rtl, 'Running experiments', 'آزمون فعال')} value={running} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label={lc(rtl, 'Views (30d)', 'بازدید (۳۰ روز)')} value={a?.totals?.views ?? 0} />
        <Kpi label={lc(rtl, 'CTR', 'نرخ کلیک')} value={`${a?.totals?.ctr ?? 0}%`} />
        <Kpi label={lc(rtl, 'Conversion', 'تبدیل')} value={`${a?.totals?.conversionRate ?? 0}%`} />
        <Kpi label={lc(rtl, 'Top hero', 'برترین')} value={a?.topHeroName ?? '—'} />
      </div>
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{lc(rtl, 'Recent heroes', 'هیروهای اخیر')}</h3>
        <div className="space-y-2">
          {heroes.slice(0, 6).map(h => (
            <button key={h.id} onClick={() => onOpen(h.id)} className="w-full flex items-center justify-between text-sm border border-subtle rounded-lg px-3 py-2 hover:border-border-strong text-start">
              <span className="text-text-primary">{h.name} <span className="text-xs text-text-tertiary">· {h.template}</span></span>
              <span className="flex items-center gap-2"><Badge color={STATUS_COLOR[h.status]}>{h.status}</Badge>{!h.valid && <Badge color="red">{lc(rtl, 'invalid', 'نامعتبر')}</Badge>}</span>
            </button>
          ))}
          {heroes.length === 0 && <p className="text-sm text-text-tertiary">{lc(rtl, 'No heroes yet — create one from a template.', 'هنوز هیرویی نیست.')}</p>}
        </div>
      </Card>
    </div>
  )
}

function Heroes({ rtl, locale, toast, onOpen }: { rtl: boolean; locale: 'fa' | 'en'; toast: Toast; onOpen: (id: number) => void }) {
  const [rows, setRows] = useState<(HeroRecord & { valid: boolean })[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await fetch('/api/admin/heroes'); const d = await r.json(); setRows(d.heroes ?? []) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function op(action: string, id: number, extra: Record<string, unknown> = {}) {
    const r = await fetch('/api/admin/heroes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id, ...extra }) })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { toast(lc(rtl, 'Done', 'انجام شد'), 'success'); load() } else toast(d.error || lc(rtl, 'Failed', 'ناموفق'), 'error')
  }

  const columns: Column<HeroRecord & { valid: boolean }>[] = [
    { key: 'name', labelEn: 'Name', labelFa: 'نام', render: h => <div><div className="font-medium text-text-primary">{h.name}</div><div className="text-xs text-text-tertiary font-mono">{h.slug}</div></div> },
    { key: 'template', labelEn: 'Template', labelFa: 'قالب', type: 'enum', options: HERO_TEMPLATES.map(t => ({ value: t.id, labelEn: t.nameEn, labelFa: t.nameFa })), render: h => <span className="text-text-secondary text-xs">{h.template}</span> },
    { key: 'targetPath', labelEn: 'Target', labelFa: 'مقصد', render: h => <span className="font-mono text-xs text-text-tertiary">{h.targetPath || '—'}</span> },
    { key: 'status', labelEn: 'Status', labelFa: 'وضعیت', type: 'enum', options: (['draft', 'review', 'approved', 'published', 'archived'] as HeroStatus[]).map(s => ({ value: s, labelEn: s, labelFa: s })), render: h => <span className="flex items-center gap-1"><Badge color={STATUS_COLOR[h.status]}>{h.status}</Badge>{!h.valid && <Badge color="red">!</Badge>}</span> },
    { key: 'version', labelEn: 'Ver', labelFa: 'نسخه', type: 'number', numeric: true, render: h => <span className="text-text-tertiary text-xs">v{h.version}</span> },
  ]
  const rowActions: RowAction<HeroRecord & { valid: boolean }>[] = [
    { id: 'edit', labelEn: 'Open Builder', labelFa: 'بازکردن سازنده', icon: '✎', onClick: h => onOpen(h.id) },
    { id: 'submit', labelEn: 'Submit for review', labelFa: 'ارسال بازبینی', icon: '➤', hidden: h => h.status !== 'draft', onClick: h => op('submit', h.id) },
    { id: 'approve', labelEn: 'Approve', labelFa: 'تأیید', icon: '✓', hidden: h => h.status !== 'review', onClick: h => op('approve', h.id) },
    { id: 'publish', labelEn: 'Publish', labelFa: 'انتشار', icon: '🚀', hidden: h => h.status === 'published', onClick: h => op('publish', h.id) },
    { id: 'unpublish', labelEn: 'Unpublish', labelFa: 'لغو انتشار', icon: '⏸', hidden: h => h.status !== 'published', onClick: h => op('unpublish', h.id) },
    { id: 'duplicate', labelEn: 'Duplicate', labelFa: 'کپی', icon: '⧉', onClick: h => op('duplicate', h.id) },
    { id: 'archive', labelEn: 'Archive', labelFa: 'بایگانی', icon: '📦', hidden: h => h.status === 'archived', onClick: h => op('archive', h.id) },
  ]
  const bulkActions = [
    { id: 'publish', labelEn: 'Publish', labelFa: 'انتشار', run: async (ids: string[]) => { await bulk('publish', ids); load() } },
    { id: 'archive', labelEn: 'Archive', labelFa: 'بایگانی', run: async (ids: string[]) => { await bulk('archive', ids); load() } },
    { id: 'delete', labelEn: 'Delete', labelFa: 'حذف', danger: true, requires: 'delete', confirmEn: 'Delete selected heroes?', confirmFa: 'هیروهای انتخابی حذف شوند؟', run: async (ids: string[]) => { await bulk('delete', ids); load() } },
  ]
  async function bulk(opName: string, ids: string[]) {
    await fetch('/api/admin/heroes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'bulk', op: opName, ids: ids.map(Number) }) })
    toast(lc(rtl, 'Done', 'انجام شد'), 'success')
  }

  return (
    <Card className="p-4">
      <DataTable tableId="heroes" columns={columns} rows={rows} locale={locale} loading={loading} rowKey={h => String(h.id)} onRowClick={h => onOpen(h.id)} rowActions={rowActions} bulkActions={bulkActions} selectable exportName="heroes" onRefresh={load}
        quickCreate={{ labelEn: 'New Hero', labelFa: 'هیروی جدید', onClick: () => setCreating(true) }}
        emptyLabel={lc(rtl, 'No heroes — create one from a template.', 'هیرویی نیست — یکی از یک قالب بسازید.')} />
      <NewHeroModal open={creating} rtl={rtl} onClose={() => setCreating(false)} onCreated={id => { setCreating(false); load(); onOpen(id) }} />
    </Card>
  )
}

/**
 * The "New Hero" flow — the entire builder/A-B/analytics platform (Phase 23)
 * had a full create API (`POST /api/admin/heroes {action:'create',…}`,
 * template validation, slug dedup) and a builder that only ever EDITS an
 * existing numeric id — but nothing in the UI ever called create. There was
 * no button, no modal, nothing: an operator opening the Heroes tab for the
 * first time had no way whatsoever to make a hero, on a platform built
 * entirely around making heroes. Reuses the create API exactly as designed;
 * on success jumps straight into the builder for the new hero (the natural
 * next step after naming it), same as clicking "Open Builder" on a row.
 */
function NewHeroModal({ open, rtl, onClose, onCreated }: { open: boolean; rtl: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const [name, setName] = useState('')
  const [template, setTemplate] = useState(HERO_TEMPLATES[0]?.id ?? '')
  const [targetPath, setTargetPath] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (open) { setName(''); setTemplate(HERO_TEMPLATES[0]?.id ?? ''); setTargetPath(''); setError('') } }, [open])

  async function submit() {
    if (name.trim().length < 2) { setError(lc(rtl, 'Name must be at least 2 characters', 'نام باید حداقل ۲ کاراکتر باشد')); return }
    setCreating(true)
    setError('')
    try {
      const r = await fetch('/api/admin/heroes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', name: name.trim(), template, targetPath: targetPath.trim() || undefined }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d.id) onCreated(d.id)
      else setError(d.error || lc(rtl, 'Failed to create', 'ایجاد ناموفق بود'))
    } finally { setCreating(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={lc(rtl, 'New Hero', 'هیروی جدید')} size="md">
      <div className="space-y-4">
        <Input label={lc(rtl, 'Name *', 'نام *')} value={name} onChange={setName} placeholder={lc(rtl, 'e.g. Homepage — Enterprise', 'مثلاً صفحه اصلی — سازمانی')} />
        <Select label={lc(rtl, 'Template', 'قالب')} value={template} onChange={setTemplate}
          options={HERO_TEMPLATES.map(t => ({ value: t.id, label: `${rtl ? t.nameFa : t.nameEn}${t.premium ? ' ★' : ''}` }))} />
        <Input label={lc(rtl, 'Target path (optional)', 'مسیر مقصد (اختیاری)')} value={targetPath} onChange={setTargetPath} placeholder="/" />
        {error && <p className="text-xs text-danger-text bg-danger-muted rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-3">
          <Btn onClick={submit} disabled={creating}>{creating ? lc(rtl, 'Creating…', 'در حال ساخت…') : lc(rtl, 'Create & Open Builder', 'ساخت و بازکردن سازنده')}</Btn>
          <Btn variant="secondary" onClick={onClose}>{lc(rtl, 'Cancel', 'لغو')}</Btn>
        </div>
      </div>
    </Modal>
  )
}

/**
 * Content tab — every hero string used by the LEGACY Hero.tsx (the one that
 * actually renders on the live homepage today, since no Phase-23 hero is
 * published — see HeroCenter's Heroes tab / CLAUDE.md), including the name
 * line and the "HBZ" wordmark itself, is DB-backed (hero_content table via
 * the pre-existing GET/PUT /api/admin/hero route) and editable here, per
 * language. Previously this API had no admin UI at all — the fields only
 * ever had their hardcoded fallback values. An empty field always falls
 * back to the built-in default in Hero.tsx (`h?.field || D.field`), so
 * clearing a field here is safe — it never renders blank on the site.
 */
type HeroContentForm = {
  name: string; wordmark: string
  badge: string; headline: string; headlineHighlight: string; subheadline: string
  ctaPrimary: string; ctaPrimaryHref: string
  ctaSecondary: string; ctaSecondaryHref: string
  ctaTertiary: string; ctaTertiaryHref: string
  stat1Label: string; stat1Value: string
  stat2Label: string; stat2Value: string
  stat3Label: string; stat3Value: string
  stat4Label: string; stat4Value: string
}
const EMPTY_HERO_CONTENT: HeroContentForm = {
  name: '', wordmark: '',
  badge: '', headline: '', headlineHighlight: '', subheadline: '',
  ctaPrimary: '', ctaPrimaryHref: '', ctaSecondary: '', ctaSecondaryHref: '', ctaTertiary: '', ctaTertiaryHref: '',
  stat1Label: '', stat1Value: '', stat2Label: '', stat2Value: '', stat3Label: '', stat3Value: '', stat4Label: '', stat4Value: '',
}

function ContentEditor({ rtl, toast }: { rtl: boolean; toast: Toast }) {
  const [lang, setLang] = useState<'fa' | 'en'>(rtl ? 'fa' : 'en')
  const [form, setForm] = useState<HeroContentForm>(EMPTY_HERO_CONTENT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (locale: 'fa' | 'en') => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/hero')
      const rows = await r.json().catch(() => [])
      const row = Array.isArray(rows) ? rows.find((x: { locale: string }) => x.locale === locale) : null
      setForm({
        name: row?.name || '', wordmark: row?.wordmark || '',
        badge: row?.badge || '', headline: row?.headline || '', headlineHighlight: row?.headlineHighlight || '', subheadline: row?.subheadline || '',
        ctaPrimary: row?.ctaPrimary || '', ctaPrimaryHref: row?.ctaPrimaryHref || '',
        ctaSecondary: row?.ctaSecondary || '', ctaSecondaryHref: row?.ctaSecondaryHref || '',
        ctaTertiary: row?.ctaTertiary || '', ctaTertiaryHref: row?.ctaTertiaryHref || '',
        stat1Label: row?.stat1Label || '', stat1Value: row?.stat1Value || '',
        stat2Label: row?.stat2Label || '', stat2Value: row?.stat2Value || '',
        stat3Label: row?.stat3Label || '', stat3Value: row?.stat3Value || '',
        stat4Label: row?.stat4Label || '', stat4Value: row?.stat4Value || '',
      })
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load(lang) }, [lang, load])

  async function save() {
    setSaving(true)
    try {
      const r = await fetch('/api/admin/hero', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale: lang, ...form }) })
      if (r.ok) toast(lc(rtl, 'Hero content saved', 'محتوای هیرو ذخیره شد'), 'success')
      else { const d = await r.json().catch(() => ({})); toast(d.error || lc(rtl, 'Failed', 'ناموفق'), 'error') }
    } finally { setSaving(false) }
  }

  function set<K extends keyof HeroContentForm>(key: K, v: string) {
    setForm(f => ({ ...f, [key]: v }))
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <p className="text-sm text-text-secondary">
          {lc(rtl,
            'Every text string on the live homepage hero — including the name line and the "HBZ" wordmark itself — is stored here, per language, and edited from this tab. An empty field falls back to the built-in default automatically.',
            'همه متن‌های بخش هیروی زندهٔ صفحه اصلی — از جمله خط نام و خود کلمهٔ «HBZ» — اینجا و به تفکیک زبان ذخیره می‌شوند. فیلد خالی به‌صورت خودکار به مقدار پیش‌فرض برمی‌گردد.'
          )}
        </p>
        <div className="flex gap-1 shrink-0 rounded-lg border border-subtle p-0.5">
          {(['fa', 'en'] as const).map(l => (
            <button key={l} type="button" onClick={() => setLang(l)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${lang === l ? 'bg-brand text-white' : 'text-text-tertiary hover:text-text-primary'}`}>
              {l === 'fa' ? 'فارسی' : 'English'}
            </button>
          ))}
        </div>
      </Card>

      {loading ? (
        <p className="text-xs text-text-tertiary">{lc(rtl, 'Loading…', 'در حال بارگذاری…')}</p>
      ) : (
        <>
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">{lc(rtl, 'Wordmark & name', 'نام و لوگوتایپ')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label={lc(rtl, 'Wordmark ("HBZ")', 'لوگوتایپ («HBZ»)')} value={form.wordmark} onChange={v => set('wordmark', v)} placeholder="HBZ" />
              <Input label={lc(rtl, 'Name line', 'خط نام')} value={form.name} onChange={v => set('name', v)} placeholder={lang === 'fa' ? 'حسین حبیب‌آذر' : 'Husein Habibazar'} />
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">{lc(rtl, 'Headline', 'تیتر')}</h3>
            <Input label={lc(rtl, 'Badge', 'نشان')} value={form.badge} onChange={v => set('badge', v)} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label={lc(rtl, 'Headline', 'تیتر اصلی')} value={form.headline} onChange={v => set('headline', v)} />
              <Input label={lc(rtl, 'Headline highlight', 'زیرتیتر برجسته')} value={form.headlineHighlight} onChange={v => set('headlineHighlight', v)} />
            </div>
            <Input label={lc(rtl, 'Subheadline', 'زیرتیتر')} value={form.subheadline} onChange={v => set('subheadline', v)} multiline rows={3} />
          </Card>

          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">{lc(rtl, 'Call-to-actions', 'دکمه‌های اقدام')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label={lc(rtl, 'Primary label', 'برچسب اصلی')} value={form.ctaPrimary} onChange={v => set('ctaPrimary', v)} />
              <Input label={lc(rtl, 'Secondary label', 'برچسب دوم')} value={form.ctaSecondary} onChange={v => set('ctaSecondary', v)} />
              <Input label={lc(rtl, 'Tertiary label', 'برچسب سوم')} value={form.ctaTertiary} onChange={v => set('ctaTertiary', v)} />
              <Input label={lc(rtl, 'Primary link', 'لینک اصلی')} value={form.ctaPrimaryHref} onChange={v => set('ctaPrimaryHref', v)} />
              <Input label={lc(rtl, 'Secondary link', 'لینک دوم')} value={form.ctaSecondaryHref} onChange={v => set('ctaSecondaryHref', v)} />
              <Input label={lc(rtl, 'Tertiary link', 'لینک سوم')} value={form.ctaTertiaryHref} onChange={v => set('ctaTertiaryHref', v)} />
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">{lc(rtl, 'Stats row', 'ردیف آمار')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {([1, 2, 3, 4] as const).map(n => (
                <div key={n} className="space-y-2 p-3 rounded-lg border border-subtle">
                  <Input label={lc(rtl, `Stat ${n} value`, `مقدار ${n}`)} value={form[`stat${n}Value` as const]} onChange={v => set(`stat${n}Value` as const, v)} />
                  <Input label={lc(rtl, `Stat ${n} label`, `برچسب ${n}`)} value={form[`stat${n}Label` as const]} onChange={v => set(`stat${n}Label` as const, v)} />
                </div>
              ))}
            </div>
          </Card>

          <div className="flex justify-end">
            <Btn onClick={save} disabled={saving}>{saving ? lc(rtl, 'Saving…', 'در حال ذخیره…') : lc(rtl, 'Save', 'ذخیره')}</Btn>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Templates tab — repurposed per the maintainer's instruction: the old
 * 50-template "start a new hero draft" gallery was unused in production (no
 * Phase-23 hero has ever been published — the live homepage always falls
 * back to the legacy Hero.tsx component) and is gone from this tab. It now
 * hosts the **orbit network animation** picker instead — the third piece of
 * the reference-clip breakdown (text / orbit animation / background video),
 * live-previewed exactly like the Video Background tab (no static
 * rectangles — a real animated, non-rectangular orb preview per pick).
 */
/**
 * چیدمان (Layout) tab — merges what used to be two separate tabs
 * ("Templates" = the orbit-network animation picker, "Layout" = the 20
 * Hero.tsx layout compositions) into one, per the maintainer's instruction.
 * Both write the same generic settings GET/PUT endpoint every other Hero
 * admin control uses. Each layout card is a REAL live-rendered preview
 * (HeroLayoutPreview — the actual Hero component, scaled down, not a
 * screenshot or a static icon), and can be hidden from the picker (soft
 * "delete" — the code stays, it's just no longer offered) or restored
 * ("add" back) via `hero_layout_hidden`, since these are code-defined
 * compositions, not uploadable files — there is nothing to literally
 * delete/re-upload the way a background video can be.
 */
function LayoutPicker({ rtl, toast }: { rtl: boolean; toast: Toast }) {
  const [current, setCurrent] = useState<string>('')
  const [orbitCurrent, setOrbitCurrent] = useState<string>('')
  const [hidden, setHidden] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [customOrbits, setCustomOrbits] = useState<MediaRow[]>([])
  const [orbitModalOpen, setOrbitModalOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, m] = await Promise.all([
        fetch('/api/admin/settings').then(r => r.json()).catch(() => ({})),
        fetch('/api/admin/media?folder=hero-orbit').then(r => r.json()).catch(() => []),
      ])
      setCurrent(s.hero_variant || DEFAULT_HERO_LAYOUT)
      setOrbitCurrent(s.hero_orbit_style || DEFAULT_ORBIT_STYLE)
      try { setHidden(JSON.parse(s.hero_layout_hidden || '[]')) } catch { setHidden([]) }
      setCustomOrbits(Array.isArray(m) ? m : [])
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function removeOrbit(row: MediaRow) {
    if (!window.confirm(lc(rtl, `Delete "${row.originalName}"?`, `«${row.originalName}» حذف شود؟`))) return
    const r = await fetch('/api/admin/media', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id }) })
    if (r.ok) {
      if (orbitCurrent === `custom:${row.url}`) await selectOrbit(DEFAULT_ORBIT_STYLE)
      toast(lc(rtl, 'Deleted', 'حذف شد'), 'success')
      load()
    } else toast(lc(rtl, 'Failed', 'ناموفق'), 'error')
  }

  async function select(id: string) {
    setSaving(id)
    try {
      const r = await fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hero_variant: id }) })
      if (r.ok) { setCurrent(id); toast(lc(rtl, 'Hero layout set', 'چیدمان هیرو تنظیم شد'), 'success') }
      else toast(lc(rtl, 'Failed', 'ناموفق'), 'error')
    } finally { setSaving(null) }
  }

  async function selectOrbit(id: string) {
    setSaving(`orbit:${id}`)
    try {
      const r = await fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hero_orbit_style: id }) })
      if (r.ok) { setOrbitCurrent(id); toast(lc(rtl, 'Orbit animation set', 'انیمیشن مداری تنظیم شد'), 'success') }
      else toast(lc(rtl, 'Failed', 'ناموفق'), 'error')
    } finally { setSaving(null) }
  }

  async function setHiddenList(next: string[]) {
    setHidden(next)
    await fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hero_layout_hidden: JSON.stringify(next) }) })
  }
  async function hideLayout(id: string) {
    if (id === current) { toast(lc(rtl, "Can't hide the active layout — pick another first", 'چیدمان فعال را نمی‌توان حذف کرد — اول یکی دیگر را انتخاب کنید'), 'error'); return }
    await setHiddenList([...hidden, id])
    toast(lc(rtl, 'Hidden from the picker', 'از لیست پنهان شد'), 'success')
  }
  async function restoreLayout(id: string) {
    await setHiddenList(hidden.filter(h => h !== id))
    toast(lc(rtl, 'Restored', 'بازگردانده شد'), 'success')
  }

  const visible = HERO_LAYOUTS.filter(l => !hidden.includes(l.id))
  const hiddenLayouts = HERO_LAYOUTS.filter(l => hidden.includes(l.id))

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <p className="text-sm text-text-secondary">
          {lc(rtl,
            'Pick which of the built-in layout compositions the live homepage hero uses. Content (text, CTAs) stays exactly the same — only the arrangement changes. Sizes/fonts scale up through 4K displays. Each card below is a real live preview of that layout, not a static icon.',
            'یکی از چیدمان‌های آماده را برای بخش هیروی زندهٔ صفحه اصلی انتخاب کنید. محتوا (متن، دکمه‌ها) دقیقاً همان می‌ماند — فقط چینش عوض می‌شود. اندازه و فونت‌ها تا مانیتورهای 4K نسبت به ابعاد صفحه تنظیم می‌شوند. هر کارت پایین یک پیش‌نمایش زندهٔ واقعی از همان چیدمان است، نه یک آیکون ثابت.'
          )}
        </p>
      </Card>

      {/* Network animation — folded in here from the old separate "Templates" tab.
          Alongside the built-in SVG/CSS orbit, an operator can now upload their
          own looping clip (MP4/WebM/MOV/MKV) to use instead — same upload
          mechanics as the Video Background tab (generic /api/admin/media,
          `custom:<url>` selection convention), just scoped to the round orbit
          slot instead of the full-bleed background layer. */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-tertiary">{lc(rtl, 'Network animation', 'انیمیشن شبکه‌ای')}</p>
          <button type="button" onClick={() => setOrbitModalOpen(true)}
            className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            style={{ background: 'var(--color-brand)', color: '#fff' }}>
            {`⇧ ${lc(rtl, 'Upload network animation', 'آپلود انیمیشن شبکه‌ای')}`}
          </button>
          <HeroMediaUploadModal open={orbitModalOpen} onClose={() => setOrbitModalOpen(false)} rtl={rtl}
            folder="hero-orbit" defaultCategory="hero-animation-video"
            accept="video/mp4,video/webm,image/svg+xml,application/json,.mp4,.webm,.svg,.json"
            onUploaded={async () => { toast(lc(rtl, 'Network animation uploaded', 'انیمیشن شبکه‌ای آپلود شد'), 'success'); await load() }} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {HERO_ORBIT_STYLES.map(s => (
            <button type="button" key={s.id} onClick={() => !saving && selectOrbit(s.id)}
              className={`orb-preview-tile flex flex-col items-center gap-2 rounded-2xl p-3 border-2 transition-colors ${orbitCurrent === s.id ? 'border-brand' : 'border-transparent hover:border-subtle'}`}>
              <div className="orb-preview-frame relative w-full aspect-square rounded-full overflow-hidden bg-surface-2 border border-subtle">
                <OrbitalNetwork compact />
              </div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold text-text-primary">{rtl ? s.nameFa : s.nameEn}</h4>
                {orbitCurrent === s.id && <Badge color="green">{lc(rtl, 'Active', 'فعال')}</Badge>}
                {saving === `orbit:${s.id}` && <Badge color="slate">…</Badge>}
              </div>
          </button>
        ))}
        {customOrbits.map(row => {
          const id = `custom:${row.url}`
          return (
            <div key={row.id} className={`orb-preview-tile flex flex-col items-center gap-2 rounded-2xl p-3 border-2 transition-colors ${orbitCurrent === id ? 'border-brand' : 'border-transparent'}`}>
              <button type="button" onClick={() => !saving && selectOrbit(id)} className="w-full">
                <div className="orb-preview-frame relative w-full aspect-square rounded-full overflow-hidden bg-surface-2 border border-subtle">
                  <video src={row.url} className="w-full h-full object-cover" muted loop playsInline preload="auto"
                    onLoadedMetadata={e => { try { e.currentTarget.currentTime = 0.1 } catch {} }}
                    onMouseEnter={e => e.currentTarget.play().catch(() => {})}
                    onMouseLeave={e => e.currentTarget.pause()} />
                </div>
              </button>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold text-text-primary truncate max-w-[8rem]" title={row.originalName}>{row.originalName}</h4>
                {orbitCurrent === id && <Badge color="green">{lc(rtl, 'Active', 'فعال')}</Badge>}
                {saving === `orbit:${id}` && <Badge color="slate">…</Badge>}
              </div>
              <button type="button" onClick={() => removeOrbit(row)}
                className="text-3xs text-red-400 hover:text-red-300 transition-colors">
                🗑 {lc(rtl, 'Delete', 'حذف')}
              </button>
            </div>
          )
        })}
        </div>
      </div>

      {/* Layout compositions — real live previews, select + hide/restore */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-2">{lc(rtl, 'Layouts', 'چیدمان‌ها')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 4k:grid-cols-4 gap-5">
          {visible.map(l => (
            <div key={l.id} className={`rounded-2xl border-2 overflow-hidden transition-colors ${current === l.id ? 'border-brand' : 'border-transparent hover:border-subtle'}`}>
              {/* A real <button> can't legally wrap the live preview — it renders
                  the actual Hero component, including real <button> CTAs, and a
                  button-inside-button is invalid HTML that browsers silently
                  restructure (breaking the click handler + a hydration warning).
                  role="button" on a div is the standard fix for "clickable, but
                  contains other interactive elements". */}
              <div role="button" tabIndex={0} onClick={() => !saving && select(l.id)}
                onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !saving) { e.preventDefault(); select(l.id) } }}
                className="block w-full cursor-pointer">
                <div className="h-40 sm:h-44 bg-surface-2 border-b border-subtle">
                  <HeroLayoutPreview variant={l.id} />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 p-3">
                <button type="button" onClick={() => !saving && select(l.id)} className="text-start flex-1">
                  <h4 className="text-sm font-semibold text-text-primary">{rtl ? l.nameFa : l.nameEn}</h4>
                  <div className="flex items-center gap-1.5 mt-1">
                    {current === l.id && <Badge color="green">{lc(rtl, 'Active', 'فعال')}</Badge>}
                    {saving === l.id && <Badge color="slate">…</Badge>}
                  </div>
                </button>
                <button type="button" onClick={() => hideLayout(l.id)} title={lc(rtl, 'Hide', 'حذف')}
                  className="text-3xs text-red-400 hover:text-red-300 transition-colors shrink-0">
                  🗑 {lc(rtl, 'Hide', 'حذف')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {hiddenLayouts.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-2">{lc(rtl, 'Hidden', 'پنهان‌شده')}</p>
          <div className="flex flex-wrap gap-2">
            {hiddenLayouts.map(l => (
              <button type="button" key={l.id} onClick={() => restoreLayout(l.id)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-white/5 text-text-secondary hover:text-text-primary transition-colors">
                + {lc(rtl, 'Restore', 'بازگرداندن')}: {rtl ? l.nameFa : l.nameEn}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && <p className="text-xs text-text-tertiary">{lc(rtl, 'Loading…', 'در حال بارگذاری…')}</p>}
    </div>
  )
}

/**
 * Video Background tab — lets an operator pick one of the 19 pre-rendered
 * loop videos as the homepage hero's background layer, without touching the
 * hero's text/CTA/tabs/content (the legacy Hero.tsx component, currently
 * live since no Phase-23 hero is published, is unchanged apart from an
 * optional video layer painted behind its existing grid/glow background —
 * see src/lib/heroBgVideos.ts + HeroVideoBg in Hero.tsx).
 * Persisted as the `hero_bg_video` site_settings key via the existing
 * generic `/api/admin/settings` GET/PUT endpoint (no new API surface).
 */
function VideoBackground({ rtl, toast }: { rtl: boolean; toast: Toast }) {
  const [current, setCurrent] = useState<string>('')
  const [custom, setCustom] = useState<MediaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, m] = await Promise.all([
        fetch('/api/admin/settings').then(r => r.json()).catch(() => ({})),
        fetch('/api/admin/media?folder=hero-videos').then(r => r.json()).catch(() => []),
      ])
      setCurrent(s.hero_bg_video || '')
      setCustom(Array.isArray(m) ? m : [])
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function select(id: string) {
    setSaving(id)
    try {
      const r = await fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hero_bg_video: id }) })
      if (r.ok) { setCurrent(id); toast(id ? lc(rtl, 'Hero background video set', 'ویدیوی پس‌زمینه هیرو تنظیم شد') : lc(rtl, 'Hero background video cleared', 'ویدیوی پس‌زمینه حذف شد'), 'success') }
      else toast(lc(rtl, 'Failed', 'ناموفق'), 'error')
    } finally { setSaving(null) }
  }

  async function removeCustom(row: MediaRow) {
    if (!window.confirm(lc(rtl, `Delete "${row.originalName}"?`, `«${row.originalName}» حذف شود؟`))) return
    const r = await fetch('/api/admin/media', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id }) })
    if (r.ok) {
      // If the deleted video was the active one, fall back to none.
      if (current === `custom:${row.url}`) await select('')
      toast(lc(rtl, 'Deleted', 'حذف شد'), 'success')
      load()
    } else toast(lc(rtl, 'Failed', 'ناموفق'), 'error')
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <p className="text-sm text-text-secondary">
          {lc(rtl,
            'Choose a looping background video for the live homepage hero. Content, CTAs, stats and tabs are untouched — only the background layer changes. Respects reduced-motion for accessibility. Upload your own (MP4/WebM/MOV/MKV) below, or pick one of the 19 built-in loops.',
            'یک ویدیوی حلقه‌ای برای پس‌زمینه بخش هیروی زنده صفحه اصلی انتخاب کنید. متن، دکمه‌ها، آمار و تب‌ها تغییر نمی‌کنند — فقط لایه پس‌زمینه عوض می‌شود. برای دسترس‌پذیری، حالت کاهش حرکت رعایت می‌شود. ویدیوی خودتان را (MP4/WebM/MOV/MKV) پایین آپلود کنید، یا یکی از ۱۹ ویدیوی آماده را انتخاب کنید.'
          )}
        </p>
        <button type="button" onClick={() => setUploadModalOpen(true)}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors"
          style={{ background: 'var(--color-brand)', color: '#fff' }}>
          {`⇧ ${lc(rtl, 'Upload video', 'آپلود ویدیو')}`}
        </button>
        <HeroMediaUploadModal open={uploadModalOpen} onClose={() => setUploadModalOpen(false)} rtl={rtl}
          folder="hero-videos" defaultCategory="hero-background-video"
          accept="video/mp4,video/webm,.mp4,.webm"
          onUploaded={async () => { toast(lc(rtl, 'Video uploaded', 'ویدیو آپلود شد'), 'success'); await load() }} />
      </Card>

      {custom.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-2">{lc(rtl, 'Your uploads', 'آپلودهای شما')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {custom.map(row => {
              const id = `custom:${row.url}`
              return (
                <div key={row.id} className={`orb-preview-tile flex flex-col items-center gap-2 rounded-2xl p-3 border-2 transition-colors ${current === id ? 'border-brand' : 'border-transparent'}`}>
                  <button type="button" onClick={() => !saving && select(id)} className="w-full">
                    <div className="orb-preview-frame relative w-full aspect-square rounded-full overflow-hidden bg-surface-2 border border-subtle">
                      <video src={row.url} className="w-full h-full object-cover" muted loop playsInline preload="auto"
                        onLoadedMetadata={e => { try { e.currentTarget.currentTime = 0.1 } catch {} }}
                        onMouseEnter={e => e.currentTarget.play().catch(() => {})}
                        onMouseLeave={e => e.currentTarget.pause()} />
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-semibold text-text-primary truncate max-w-[8rem]" title={row.originalName}>{row.originalName}</h4>
                    {current === id && <Badge color="green">{lc(rtl, 'Active', 'فعال')}</Badge>}
                    {saving === id && <Badge color="slate">…</Badge>}
                  </div>
                  <button type="button" onClick={() => removeCustom(row)}
                    className="text-3xs text-red-400 hover:text-red-300 transition-colors">
                    🗑 {lc(rtl, 'Delete', 'حذف')}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div>
        {custom.length > 0 && <p className="text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-2">{lc(rtl, 'Built-in', 'آماده')}</p>}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          <button type="button" onClick={() => !saving && select('')}
            className={`orb-preview-tile flex flex-col items-center gap-2 rounded-2xl p-3 border-2 transition-colors ${!current ? 'border-brand' : 'border-transparent hover:border-subtle'}`}>
            <div className="orb-preview-frame relative w-full aspect-square rounded-full overflow-hidden bg-surface-2 border border-subtle flex items-center justify-center text-2xl text-text-tertiary">✕</div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold text-text-primary">{lc(rtl, 'None (default)', 'هیچکدام (پیش‌فرض)')}</h4>
              {!current && <Badge color="green">{lc(rtl, 'Active', 'فعال')}</Badge>}
            </div>
          </button>
          {HERO_BG_VIDEOS.map(v => (
            <button type="button" key={v.id} onClick={() => !saving && select(v.id)}
              className={`orb-preview-tile flex flex-col items-center gap-2 rounded-2xl p-3 border-2 transition-colors ${current === v.id ? 'border-brand' : 'border-transparent hover:border-subtle'}`}>
              <div className="orb-preview-frame relative w-full aspect-square rounded-full overflow-hidden bg-surface-2 border border-subtle">
                <video src={`/videos/hero-bg/${v.file}`} className="w-full h-full object-cover" muted loop playsInline preload="auto"
                  onLoadedMetadata={e => { try { e.currentTarget.currentTime = 0.1 } catch {} }}
                  onMouseEnter={e => e.currentTarget.play().catch(() => {})}
                  onMouseLeave={e => e.currentTarget.pause()} />
              </div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold text-text-primary">{rtl ? v.labelFa : v.labelEn}</h4>
                {current === v.id && <Badge color="green">{lc(rtl, 'Active', 'فعال')}</Badge>}
                {saving === v.id && <Badge color="slate">…</Badge>}
              </div>
            </button>
          ))}
        </div>
      </div>
      {loading && <p className="text-xs text-text-tertiary">{lc(rtl, 'Loading…', 'در حال بارگذاری…')}</p>}
    </div>
  )
}

interface ExpVariant { id: string; heroId: number; weight: number }
interface ExpRow { id: number; key: string; name: string; targetPath: string | null; status: string; winner: string | null; variants: ExpVariant[]; result: { variants: { variantId: string; views: number; ctr: number; conversionRate: number }[]; winner: string | null } }

function Experiments({ rtl, locale, toast }: { rtl: boolean; locale: 'fa' | 'en'; toast: Toast }) {
  const [rows, setRows] = useState<ExpRow[]>([])
  const [heroes, setHeroes] = useState<HeroRecord[]>([])
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ key: '', name: '', targetPath: '/', a: 0, b: 0 })
  const load = useCallback(async () => {
    const [e, h] = await Promise.all([fetch('/api/admin/heroes/experiments').then(r => r.json()), fetch('/api/admin/heroes').then(r => r.json())])
    setRows(e.experiments ?? []); setHeroes(h.heroes ?? [])
  }, [])
  useEffect(() => { load() }, [load])
  async function op(action: string, id: number, extra: Record<string, unknown> = {}) {
    const r = await fetch('/api/admin/heroes/experiments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id, ...extra }) })
    if (r.ok) { toast(lc(rtl, 'Done', 'انجام شد'), 'success'); load() } else { const d = await r.json().catch(() => ({})); toast(d.error || 'Failed', 'error') }
  }
  async function create() {
    if (!form.key || !form.a || !form.b) { toast(lc(rtl, 'Pick two heroes + key', 'دو هیرو و کلید'), 'error'); return }
    const r = await fetch('/api/admin/heroes/experiments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', key: form.key, name: form.name || form.key, targetPath: form.targetPath, variants: [{ id: 'A', heroId: form.a, weight: 50 }, { id: 'B', heroId: form.b, weight: 50 }] }) })
    if (r.ok) { toast(lc(rtl, 'Created', 'ساخته شد'), 'success'); setCreating(false); setForm({ key: '', name: '', targetPath: '/', a: 0, b: 0 }); load() } else { const d = await r.json().catch(() => ({})); toast(d.error || 'Failed', 'error') }
  }
  const heroOpts = [{ value: '0', label: '—' }, ...heroes.map(h => ({ value: String(h.id), label: h.name }))]
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Btn onClick={() => setCreating(c => !c)}>{lc(rtl, 'New experiment', 'آزمون جدید')}</Btn></div>
      {creating && (
        <Card className="p-5 grid md:grid-cols-5 gap-3 items-end">
          <Input label={lc(rtl, 'Key', 'کلید')} value={form.key} onChange={v => setForm(f => ({ ...f, key: v }))} placeholder="home-q3" />
          <Input label={lc(rtl, 'Target path', 'مسیر')} value={form.targetPath} onChange={v => setForm(f => ({ ...f, targetPath: v }))} />
          <Select label={lc(rtl, 'Variant A', 'نسخه A')} value={String(form.a)} onChange={v => setForm(f => ({ ...f, a: Number(v) }))} options={heroOpts} />
          <Select label={lc(rtl, 'Variant B', 'نسخه B')} value={String(form.b)} onChange={v => setForm(f => ({ ...f, b: Number(v) }))} options={heroOpts} />
          <Btn onClick={create}>{lc(rtl, 'Create', 'ساخت')}</Btn>
        </Card>
      )}
      <Card className="p-4">
        <DataTable
          tableId="hero-experiments"
          columns={[
            { key: 'name', labelEn: 'Experiment', labelFa: 'آزمون', render: (e: ExpRow) => <div><div className="font-medium text-text-primary">{e.name}</div><div className="text-xs text-text-tertiary font-mono">{e.key} · {e.targetPath || '—'}</div></div> },
            { key: 'status', labelEn: 'Status', labelFa: 'وضعیت', type: 'enum', render: (e: ExpRow) => <Badge color={e.status === 'running' ? 'green' : e.status === 'completed' ? 'blue' : 'slate'}>{e.status}</Badge> },
            { key: 'result', labelEn: 'Results', labelFa: 'نتایج', sortable: false, render: (e: ExpRow) => <span className="text-xs text-text-secondary">{e.result.variants.map(v => `${v.variantId}: ${v.conversionRate}%`).join(' · ') || '—'}</span> },
            { key: 'winner', labelEn: 'Winner', labelFa: 'برنده', render: (e: ExpRow) => e.result.winner ? <Badge color="green">{e.result.winner}</Badge> : <span className="text-text-tertiary text-xs">—</span> },
          ] as Column<ExpRow>[]}
          rows={rows}
          locale={locale}
          rowKey={(e: ExpRow) => String(e.id)}
          rowActions={[
            { id: 'start', labelEn: 'Start', labelFa: 'شروع', icon: '▶', hidden: (e: ExpRow) => e.status === 'running', onClick: (e: ExpRow) => op('start', e.id) },
            { id: 'stop', labelEn: 'Stop', labelFa: 'توقف', icon: '⏹', hidden: (e: ExpRow) => e.status !== 'running', onClick: (e: ExpRow) => op('stop', e.id) },
            { id: 'promote', labelEn: 'Promote winner', labelFa: 'ترفیع برنده', icon: '🏆', hidden: (e: ExpRow) => !e.result.winner, onClick: (e: ExpRow) => op('promote', e.id, { winner: e.result.winner }) },
            { id: 'delete', labelEn: 'Delete', labelFa: 'حذف', icon: '🗑', danger: true, onClick: (e: ExpRow) => op('delete', e.id) },
          ] as RowAction<ExpRow>[]}
          exportName="hero-experiments"
          emptyLabel={lc(rtl, 'No experiments yet.', 'هنوز آزمونی نیست.')}
        />
      </Card>
    </div>
  )
}

interface HeroKpiRow { heroId: number; name: string; views: number; ctr: number; conversionRate: number; avgScrollDepth: number; avgViewTime: number }
function Analytics({ rtl, locale }: { rtl: boolean; locale: 'fa' | 'en' }) {
  const [d, setD] = useState<{ perHero: HeroKpiRow[]; topHeroName?: string | null; worstHeroName?: string | null } | null>(null)
  useEffect(() => { fetch('/api/admin/heroes/analytics').then(r => r.json()).then(setD).catch(() => {}) }, [])
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Kpi label={lc(rtl, 'Top performer', 'برترین')} value={d?.topHeroName ?? '—'} tone="ok" />
        <Kpi label={lc(rtl, 'Needs attention', 'نیازمند توجه')} value={d?.worstHeroName ?? '—'} tone="warn" />
      </div>
      <Card className="p-4">
        <DataTable
          tableId="hero-analytics"
          columns={[
            { key: 'name', labelEn: 'Hero', labelFa: 'هیرو', render: (h: HeroKpiRow) => <span className="text-text-primary">{h.name}</span> },
            { key: 'views', labelEn: 'Views', labelFa: 'بازدید', type: 'number', numeric: true },
            { key: 'ctr', labelEn: 'CTR', labelFa: 'کلیک', type: 'number', numeric: true, render: (h: HeroKpiRow) => <span>{h.ctr}%</span> },
            { key: 'conversionRate', labelEn: 'Conv.', labelFa: 'تبدیل', type: 'number', numeric: true, render: (h: HeroKpiRow) => <span>{h.conversionRate}%</span> },
            { key: 'avgScrollDepth', labelEn: 'Scroll', labelFa: 'اسکرول', type: 'number', numeric: true, render: (h: HeroKpiRow) => <span>{h.avgScrollDepth}%</span> },
            { key: 'avgViewTime', labelEn: 'Avg time', labelFa: 'زمان', type: 'number', numeric: true, render: (h: HeroKpiRow) => <span>{h.avgViewTime}s</span> },
          ] as Column<HeroKpiRow>[]}
          rows={d?.perHero ?? []}
          locale={locale}
          rowKey={(h: HeroKpiRow) => String(h.heroId)}
          exportName="hero-analytics"
          emptyLabel={lc(rtl, 'No analytics data yet.', 'داده‌ای نیست.')}
        />
      </Card>
    </div>
  )
}

interface AnimPreset { id: number; key: string; nameEn: string; nameFa: string; category: string; enabled: boolean; archived: boolean; favorite: boolean; usageCount: number; version: number }

function AnimationLibrary({ rtl, locale, toast }: { rtl: boolean; locale: 'fa' | 'en'; toast: Toast }) {
  const [rows, setRows] = useState<AnimPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<{ total: number; enabled: number; archived: number; mostUsed: { key: string; usageCount: number }[] } | null>(null)
  const [studioFor, setStudioFor] = useState<AnimPreset | null>(null)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [l, a] = await Promise.all([fetch('/api/admin/heroes/animations').then(r => r.json()), fetch('/api/admin/heroes/animations?view=analytics').then(r => r.json())])
      setRows(l.presets ?? []); setStats(a)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function op(action: string, extra: Record<string, unknown>) {
    const r = await fetch('/api/admin/heroes/animations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { toast(lc(rtl, 'Done', 'انجام شد'), 'success'); load() } else toast(d.error || lc(rtl, 'Failed', 'ناموفق'), 'error')
  }
  async function create() {
    const key = window.prompt(lc(rtl, 'Preset key (a-z0-9-)', 'کلید پریست')); if (!key) return
    const name = window.prompt(lc(rtl, 'Name', 'نام')) || key
    await op('create', { key, nameEn: name, nameFa: name, category: 'entrance', basePreset: 'fade-up', config: {} })
  }
  async function exportPkg() {
    const pkg = await fetch('/api/admin/heroes/animations?view=export').then(r => r.json())
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'hero-animation-package.json'; a.click(); URL.revokeObjectURL(url)
    toast(lc(rtl, 'Exported (signed package)', 'خروجی گرفته شد'), 'success')
  }
  async function importPkg(file: File) {
    try { const pkg = JSON.parse(await file.text()); const r = await fetch('/api/admin/heroes/animations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'import', pkg }) }); const d = await r.json().catch(() => ({}))
      if (r.ok) { toast(lc(rtl, `Imported ${d.created} presets`, `${d.created} پریست وارد شد`), 'success'); load() }
      else toast((d.reasons?.[0] || d.error) || lc(rtl, 'Import failed', 'ورود ناموفق'), 'error')
    } catch { toast(lc(rtl, 'Invalid package file', 'فایل نامعتبر'), 'error') }
  }

  const columns: Column<AnimPreset>[] = [
    { key: 'nameEn', labelEn: 'Name', labelFa: 'نام', render: p => <div><div className="font-medium text-text-primary">{rtl ? p.nameFa : p.nameEn} {p.favorite && '★'}</div><div className="text-3xs text-text-tertiary font-mono">{p.key}</div></div> },
    { key: 'category', labelEn: 'Category', labelFa: 'دسته', type: 'enum' },
    { key: 'usageCount', labelEn: 'Used', labelFa: 'استفاده', type: 'number', numeric: true },
    { key: 'version', labelEn: 'Ver', labelFa: 'نسخه', type: 'number', numeric: true, render: p => <span className="text-text-tertiary text-xs">v{p.version}</span> },
    { key: 'enabled', labelEn: 'State', labelFa: 'وضعیت', type: 'boolean', render: p => <Badge color={p.archived ? 'red' : p.enabled ? 'green' : 'slate'}>{p.archived ? 'archived' : p.enabled ? 'enabled' : 'disabled'}</Badge> },
  ]
  const rowActions: RowAction<AnimPreset>[] = [
    { id: 'studio', labelEn: 'Timeline Studio', labelFa: 'استودیو تایم‌لاین', icon: '🎬', onClick: p => setStudioFor(p) },
    { id: 'fav', labelEn: 'Toggle favorite', labelFa: 'علاقه‌مندی', icon: '★', onClick: p => op('toggle', { id: p.id, field: 'favorite', value: !p.favorite }) },
    { id: 'toggle', labelEn: 'Enable/Disable', labelFa: 'فعال/غیرفعال', icon: '⏻', onClick: p => op('toggle', { id: p.id, field: 'enabled', value: !p.enabled }) },
    { id: 'archive', labelEn: 'Archive/Restore', labelFa: 'بایگانی', icon: '📦', onClick: p => op('toggle', { id: p.id, field: 'archived', value: !p.archived }) },
  ]
  const bulkActions = [
    { id: 'enable', labelEn: 'Enable', labelFa: 'فعال', run: async (ids: string[]) => op('bulk', { op: 'enable', ids: ids.map(Number) }) },
    { id: 'disable', labelEn: 'Disable', labelFa: 'غیرفعال', run: async (ids: string[]) => op('bulk', { op: 'disable', ids: ids.map(Number) }) },
    { id: 'archive', labelEn: 'Archive', labelFa: 'بایگانی', run: async (ids: string[]) => op('bulk', { op: 'archive', ids: ids.map(Number) }) },
    { id: 'delete', labelEn: 'Delete', labelFa: 'حذف', danger: true, requires: 'delete', confirmEn: 'Delete presets?', confirmFa: 'حذف شود؟', run: async (ids: string[]) => op('bulk', { op: 'delete', ids: ids.map(Number) }) },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label={lc(rtl, 'Custom presets', 'پریست سفارشی')} value={stats?.total ?? 0} />
        <Kpi label={lc(rtl, 'Enabled', 'فعال')} value={stats?.enabled ?? 0} tone="ok" />
        <Kpi label={lc(rtl, 'Archived', 'بایگانی')} value={stats?.archived ?? 0} tone="warn" />
        <Kpi label={lc(rtl, 'Top used', 'پرکاربرد')} value={stats?.mostUsed?.[0]?.key ?? '—'} />
      </div>
      <div className="flex flex-wrap gap-2 justify-end">
        <Btn size="sm" onClick={create}>+ {lc(rtl, 'New preset', 'پریست جدید')}</Btn>
        <Btn size="sm" variant="secondary" onClick={exportPkg}>⇩ {lc(rtl, 'Export signed package', 'خروجی امضاشده')}</Btn>
        <label className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white/5 text-text-secondary hover:text-text-primary text-sm cursor-pointer">
          ⇧ {lc(rtl, 'Import package', 'ورود بسته')}
          <input type="file" accept="application/json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importPkg(f); e.target.value = '' }} />
        </label>
      </div>
      <Card className="p-4">
        <DataTable tableId="hero-animation-library" columns={columns} rows={rows} locale={locale} loading={loading} rowKey={p => String(p.id)} rowActions={rowActions} bulkActions={bulkActions} selectable exportName="hero-animations" onRefresh={load} emptyLabel={lc(rtl, 'No custom presets yet — the 53 built-in presets are always available in the builder.', 'هنوز پریست سفارشی نیست — ۵۳ پریست داخلی همیشه در سازنده در دسترس‌اند.')} />
      </Card>
      {studioFor && (
        <TimelineStudio rtl={rtl} presetId={studioFor.id} presetName={rtl ? studioFor.nameFa : studioFor.nameEn}
          onClose={() => { setStudioFor(null); load() }} toast={toast} />
      )}
    </div>
  )
}

// Re-export for the builder to reuse validation typing.
export type { HeroConfig, HeroCta, Locale }
export { validateHero }
