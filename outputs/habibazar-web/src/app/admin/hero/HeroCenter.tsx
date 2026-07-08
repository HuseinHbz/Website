'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Btn, Input, Select, PageHeader, Badge, useToast } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'
import { HERO_TEMPLATES, HERO_CATEGORIES } from '@/lib/hero/templates'
import { validateHero } from '@/lib/hero/rules'
import type { HeroConfig, HeroRecord, HeroStatus, HeroCta, Locale } from '@/lib/hero/types'
import { HeroBuilder } from './HeroBuilder'

type Tab = 'dashboard' | 'heroes' | 'templates' | 'experiments' | 'analytics'
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
    { id: 'templates', en: 'Templates', fa: 'قالب‌ها' },
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
      {tab === 'templates' && <Templates rtl={rtl} toast={toast} onOpen={setEditingId} />}
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
      <DataTable tableId="heroes" columns={columns} rows={rows} locale={locale} loading={loading} rowKey={h => String(h.id)} onRowClick={h => onOpen(h.id)} rowActions={rowActions} bulkActions={bulkActions} selectable exportName="heroes" onRefresh={load} emptyLabel={lc(rtl, 'No heroes — create one from a template.', 'هیرویی نیست.')} />
    </Card>
  )
}

function Templates({ rtl, toast, onOpen }: { rtl: boolean; toast: Toast; onOpen: (id: number) => void }) {
  const [cat, setCat] = useState('all')
  const [lib, setLib] = useState<'all' | 'classic' | 'premium'>('all')
  const shown = useMemo(() => HERO_TEMPLATES
    .filter(t => lib === 'all' || (lib === 'premium' ? t.premium : !t.premium))
    .filter(t => cat === 'all' || t.category === cat), [cat, lib])
  async function create(templateId: string) {
    const name = window.prompt(lc(rtl, 'Hero name', 'نام هیرو')); if (!name) return
    const r = await fetch('/api/admin/heroes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', name, template: templateId }) })
    const d = await r.json().catch(() => ({}))
    if (r.ok && d.id) { toast(lc(rtl, 'Created', 'ساخته شد'), 'success'); onOpen(d.id) } else toast(d.error || lc(rtl, 'Failed', 'ناموفق'), 'error')
  }
  return (
    <div className="space-y-4">
      <div className="flex gap-1 w-fit rounded-lg bg-white/5 p-1">
        {(['all', 'classic', 'premium'] as const).map(l => (
          <button key={l} onClick={() => setLib(l)} className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${lib === l ? 'bg-brand text-white' : 'text-text-secondary hover:text-white'}`}>
            {l === 'all' ? lc(rtl, 'All', 'همه') : l === 'classic' ? lc(rtl, 'Classic Templates', 'قالب‌های کلاسیک') : lc(rtl, 'Premium Templates', 'قالب‌های ویژه')}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {['all', ...HERO_CATEGORIES].map(c => (
          <button key={c} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${cat === c ? 'bg-brand text-white' : 'bg-white/5 text-text-secondary hover:text-white'}`}>{c}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {shown.map(t => (
          <Card key={t.id} className="p-4 flex flex-col gap-2">
            <div className="h-20 rounded-lg bg-gradient-to-br from-brand/20 to-accent/10 border border-subtle flex items-center justify-center text-2xl">⬡</div>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-text-primary">{rtl ? t.nameFa : t.nameEn}</h4>
              {t.premium && <Badge color="yellow">{lc(rtl, 'Premium', 'ویژه')}</Badge>}
            </div>
            <p className="text-xs text-text-tertiary">{t.category}</p>
            <Btn size="sm" onClick={() => create(t.id)}>{lc(rtl, 'Use template', 'استفاده')}</Btn>
          </Card>
        ))}
      </div>
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

// Re-export for the builder to reuse validation typing.
export type { HeroConfig, HeroCta, Locale }
export { validateHero }
