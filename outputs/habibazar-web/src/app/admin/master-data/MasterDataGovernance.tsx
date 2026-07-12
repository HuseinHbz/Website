'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, Badge, useToast } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'

const L = (fa: boolean, en: string, faT: string) => (fa ? faT : en)

interface FieldCov { key: string; en: string; fa: string; pct: number; missing: number }
interface Domain { domain: string; total: number; score: number; grade: string; fields: FieldCov[] }
interface Overview {
  domains: Domain[]; overall: number
  duplicates: { total: number; burden: number }
  integrity: { score: number; errors: number; warnings: number; recommendations: number }
}
interface DupMember { id: number; label: string }
interface DupGroup { keyType: string; value: string; members: DupMember[] }
interface Issue { code: string; severity: string; en: string; fa: string; count: number }

const DOMAIN_LABEL: Record<string, [string, string]> = {
  customers: ['Customers', 'مشتریان'], suppliers: ['Suppliers', 'تأمین‌کنندگان'], products: ['Products', 'کالاها'],
}
const scoreColor = (s: number) => (s >= 95 ? 'text-success' : s >= 85 ? 'text-brand' : s >= 70 ? 'text-warning' : 'text-danger')
const barColor = (s: number) => (s >= 95 ? 'bg-success' : s >= 85 ? 'bg-brand' : s >= 70 ? 'bg-warning' : 'bg-danger')

export function MasterDataGovernance({ role }: { role: string }) {
  const fa = useAdminLocale() === 'fa'
  const { toast } = useToast()
  const [tab, setTab] = useState<'overview' | 'duplicates' | 'integrity'>('overview')
  const canMerge = ['administrator', 'super_admin'].includes(role)

  return (
    <div className="space-y-4">
      <div className="flex gap-1 w-fit rounded-lg bg-white/5 p-1 flex-wrap">
        {([['overview', 'Overview', 'نمای کلی'], ['duplicates', 'Duplicates', 'تکراری‌ها'], ['integrity', 'Relation integrity', 'یکپارچگی روابط']] as const).map(([id, en, faL]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${tab === id ? 'bg-brand text-white' : 'text-text-secondary hover:text-white'}`}>{L(fa, en, faL)}</button>
        ))}
      </div>
      {tab === 'overview' && <OverviewTab fa={fa} />}
      {tab === 'duplicates' && <DuplicatesTab fa={fa} canMerge={canMerge} toast={toast} />}
      {tab === 'integrity' && <IntegrityTab fa={fa} />}
    </div>
  )
}

function OverviewTab({ fa }: { fa: boolean }) {
  const [ov, setOv] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { fetch('/api/admin/erp/master-data?view=overview').then(r => r.json()).then(d => setOv(d.overview ?? null)).finally(() => setLoading(false)) }, [])
  if (loading) return <Card><p className="text-xs text-text-tertiary">{L(fa, 'Loading…', 'در حال بارگذاری…')}</p></Card>
  if (!ov) return <Card><p className="text-xs text-text-tertiary">{L(fa, 'No data.', 'داده‌ای نیست.')}</p></Card>
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><p className="text-2xs text-text-tertiary mb-1">{L(fa, 'Master-data score', 'امتیاز داده پایه')}</p><p className={`text-2xl font-bold ${scoreColor(ov.overall)}`}>{ov.overall}%</p></Card>
        <Card><p className="text-2xs text-text-tertiary mb-1">{L(fa, 'Duplicate groups', 'گروه‌های تکراری')}</p><p className={`text-2xl font-bold ${ov.duplicates.total ? 'text-warning' : 'text-success'}`}>{ov.duplicates.total}</p><p className="text-2xs text-text-tertiary">{L(fa, 'redundant', 'مازاد')}: {ov.duplicates.burden}</p></Card>
        <Card><p className="text-2xs text-text-tertiary mb-1">{L(fa, 'Integrity score', 'امتیاز یکپارچگی')}</p><p className={`text-2xl font-bold ${scoreColor(ov.integrity.score)}`}>{ov.integrity.score}</p></Card>
        <Card><p className="text-2xs text-text-tertiary mb-1">{L(fa, 'Integrity issues', 'ایرادهای یکپارچگی')}</p><p className="text-sm font-semibold"><span className="text-danger">{ov.integrity.errors}</span> · <span className="text-warning">{ov.integrity.warnings}</span> · <span className="text-text-tertiary">{ov.integrity.recommendations}</span></p><p className="text-2xs text-text-tertiary">{L(fa, 'error · warning · rec', 'خطا · هشدار · توصیه')}</p></Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {ov.domains.map(d => (
          <Card key={d.domain}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-text-primary">{L(fa, DOMAIN_LABEL[d.domain]?.[0] ?? d.domain, DOMAIN_LABEL[d.domain]?.[1] ?? d.domain)}</h3>
              <span className={`text-lg font-bold ${scoreColor(d.score)}`}>{d.score}%</span>
            </div>
            <p className="text-2xs text-text-tertiary mb-2">{L(fa, 'records', 'رکورد')}: {d.total}</p>
            <div className="space-y-1.5">
              {d.fields.map(f => (
                <div key={f.key}>
                  <div className="flex justify-between text-2xs text-text-secondary mb-0.5"><span>{L(fa, f.en, f.fa)}</span><span>{f.pct}%{f.missing > 0 && <span className="text-text-tertiary"> ({f.missing})</span>}</span></div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden"><div className={`h-full ${barColor(f.pct)}`} style={{ width: `${f.pct}%` }} /></div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function DuplicatesTab({ fa, canMerge, toast }: { fa: boolean; canMerge: boolean; toast: (m: string, k?: 'success' | 'error') => void }) {
  const [groups, setGroups] = useState<DupGroup[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/erp/master-data?view=duplicates').then(r => r.json()).then(d => setGroups(d.groups ?? [])).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  async function merge(g: DupGroup) {
    if (!g.keyType.startsWith('customer.')) { toast(L(fa, 'Only customer duplicates can be merged here.', 'فقط مشتریان تکراری قابل ادغام‌اند.'), 'error'); return }
    const [primary, ...dups] = g.members
    if (!window.confirm(L(fa, `Merge into "${primary.label}" (#${primary.id})? The other ${dups.length} record(s) will be archived.`, `ادغام در «${primary.label}» (#${primary.id})؟ ${dups.length} رکورد دیگر بایگانی می‌شود.`))) return
    let ok = 0
    for (const d of dups) {
      const r = await fetch('/api/admin/erp/master-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'merge', primaryId: primary.id, duplicateId: d.id }) })
      if (r.ok) ok++
    }
    toast(ok ? L(fa, `Merged ${ok} record(s).`, `${ok} رکورد ادغام شد.`) : L(fa, 'Merge failed.', 'ادغام ناموفق بود.'), ok ? 'success' : 'error')
    load()
  }

  const columns = [
    { key: 'keyType', labelEn: 'Match on', labelFa: 'کلید تطبیق', render: (g: DupGroup) => <span className="font-mono text-2xs text-text-tertiary">{g.keyType}</span> },
    { key: 'value', labelEn: 'Value', labelFa: 'مقدار', render: (g: DupGroup) => <span className="font-mono text-xs text-text-secondary">{g.value}</span> },
    { key: 'members', labelEn: 'Records', labelFa: 'رکوردها', render: (g: DupGroup) => <div className="flex flex-wrap gap-1">{g.members.map(m => <Badge key={m.id} color="warning">{m.label} #{m.id}</Badge>)}</div> },
  ]
  const rowActions: RowAction<DupGroup>[] = canMerge ? [
    { id: 'merge', labelEn: 'Merge (customers)', labelFa: 'ادغام (مشتری)', icon: '⚯', hidden: (g: DupGroup) => !g.keyType.startsWith('customer.'), onClick: merge },
  ] : []

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">{L(fa, 'Duplicate records', 'رکوردهای تکراری')}</h3>
        <Btn size="sm" onClick={load}>{L(fa, 'Refresh', 'به‌روزرسانی')}</Btn>
      </div>
      <DataTable tableId="md-duplicates" columns={columns} rows={groups} locale={fa ? 'fa' : 'en'} loading={loading}
        rowKey={(g: DupGroup) => `${g.keyType}:${g.value}`} rowActions={rowActions} exportName="master-data-duplicates"
        emptyLabel={L(fa, 'No duplicate records — every identity key is unique.', 'رکورد تکراری نیست — همهٔ کلیدهای هویتی یکتا هستند.')} />
    </Card>
  )
}

function IntegrityTab({ fa }: { fa: boolean }) {
  const [issues, setIssues] = useState<Issue[]>([])
  const [score, setScore] = useState(100)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/admin/erp/master-data?view=integrity').then(r => r.json()).then(d => { setIssues(d.integrity?.issues ?? []); setScore(d.integrity?.score ?? 100) }).finally(() => setLoading(false))
  }, [])
  const columns = [
    { key: 'severity', labelEn: 'Severity', labelFa: 'شدت', render: (i: Issue) => <Badge color={i.severity === 'error' ? 'danger' : i.severity === 'warning' ? 'warning' : 'default'}>{L(fa, i.severity, i.severity === 'error' ? 'خطا' : i.severity === 'warning' ? 'هشدار' : 'توصیه')}</Badge> },
    { key: 'en', labelEn: 'Finding', labelFa: 'یافته', render: (i: Issue) => <span className="text-text-secondary text-xs">{L(fa, i.en, i.fa)}</span> },
    { key: 'count', labelEn: 'Affected', labelFa: 'تعداد', numeric: true, render: (i: Issue) => <span className="font-semibold text-text-primary">{i.count}</span> },
  ]
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">{L(fa, 'Relation integrity', 'یکپارچگی روابط')}</h3>
        <span className={`text-lg font-bold ${scoreColor(score)}`}>{score}</span>
      </div>
      <DataTable tableId="md-integrity" columns={columns} rows={issues} locale={fa ? 'fa' : 'en'} loading={loading}
        rowKey={(i: Issue) => i.code} exportName="master-data-integrity"
        emptyLabel={L(fa, '✓ No relation-integrity problems found.', '✓ هیچ ایراد یکپارچگی یافت نشد.')} />
    </Card>
  )
}
