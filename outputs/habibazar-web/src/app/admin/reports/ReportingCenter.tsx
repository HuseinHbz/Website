'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Btn, Select, PageHeader, Badge, StatCard, useToast } from '@/components/admin/ui'
import { DataTable } from '@/components/admin/DataTable'
import type { Column as DTColumn, Row as DTRow } from '@/lib/admin/dataTable'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { summarize, type Row, type Column } from '@/lib/reports/pivot'

interface ReportDef {
  id: string
  module: 'financial' | 'sales' | 'inventory' | 'assets' | 'projects'
  nameEn: string; nameFa: string
  groupField?: string; measureField?: string
}
interface RunResult { def: ReportDef; columns: Column[]; rows: Row[]; summary: { label: string; value: number }[] }

const MODULE_COLOR: Record<ReportDef['module'], string> = {
  financial: 'green', sales: 'blue', inventory: 'indigo', assets: 'yellow', projects: 'slate',
}
const fmt = (v: unknown) => {
  if (typeof v === 'number') return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return v == null || v === '' ? '—' : String(v)
}

export function ReportingCenter() {
  const t = useT()
  const locale = useAdminLocale()
  const { toast, ToastContainer } = useToast()
  const [reports, setReports] = useState<ReportDef[]>([])
  const [active, setActive] = useState<string>('')
  const [result, setResult] = useState<RunResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'table' | 'summary'>('table')

  useEffect(() => {
    fetch('/api/admin/erp/reports')
      .then(r => r.json())
      .then(d => { setReports(d.reports ?? []); if (d.reports?.[0]) setActive(d.reports[0].id) })
      .catch(() => toast(t('rep_loadFail'), 'error'))
  }, [toast, t])

  const run = useCallback(async (id: string) => {
    if (!id) return
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/erp/reports?id=${encodeURIComponent(id)}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'failed')
      setResult(d); setView('table')
    } catch { toast(t('rep_runFail'), 'error') } finally { setLoading(false) }
  }, [toast, t])

  useEffect(() => { if (active) run(active) }, [active, run])

  const summaryRows = useMemo(() => {
    if (!result?.def.groupField || !result.def.measureField) return []
    return summarize(result.rows, result.def.groupField, result.def.measureField, 'sum')
  }, [result])
  const maxVal = summaryRows.reduce((m, s) => Math.max(m, Math.abs(s.value)), 0) || 1

  const name = (r: ReportDef) => (locale === 'fa' ? r.nameFa : r.nameEn)

  const options = useMemo(() => reports.map(r => ({
    value: r.id,
    label: `${t(`rep_mod_${r.module}`)} — ${locale === 'fa' ? r.nameFa : r.nameEn}`,
  })), [reports, locale, t])

  return (
    <div className="space-y-6">
      <ToastContainer />
      <PageHeader
        title={t('rep_title')}
        subtitle={t('rep_subtitle')}
        action={result && (
          <a
            href={`/api/admin/erp/reports?id=${encodeURIComponent(result.def.id)}&format=csv`}
            className="inline-flex items-center gap-2 rounded-lg font-semibold h-9 px-4 py-2 text-sm bg-surface-2 hover:bg-surface text-text-primary border border-border hover:border-border-strong transition-all duration-fast"
            download
          >{t('rep_exportCsv')}</a>
        )}
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label={t('rep_pickReport')}
            value={active}
            onChange={setActive}
            options={options}
            className="min-w-[280px]"
          />
          <Btn variant="secondary" onClick={() => run(active)} disabled={loading}>
            {loading ? t('rep_running') : t('rep_refresh')}
          </Btn>
          {result && (
            <div className="flex gap-1 ms-auto">
              <Btn variant={view === 'table' ? 'primary' : 'ghost'} onClick={() => setView('table')}>{t('rep_viewTable')}</Btn>
              <Btn variant={view === 'summary' ? 'primary' : 'ghost'} onClick={() => setView('summary')} disabled={summaryRows.length === 0}>{t('rep_viewSummary')}</Btn>
            </div>
          )}
        </div>
      </Card>

      {result && (
        <>
          <div className="flex items-center gap-2">
            <Badge color={MODULE_COLOR[result.def.module]}>{t(`rep_mod_${result.def.module}`)}</Badge>
            <span className="text-sm text-text-secondary">{name(result.def)}</span>
          </div>

          {result.summary.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {result.summary.map(s => <StatCard key={s.label} label={s.label} value={fmt(s.value)} />)}
            </div>
          )}

          {view === 'table' ? (
            <Card className="p-4">
              <DataTable
                tableId={`report-${result.def.id ?? 'result'}`}
                columns={result.columns.map(c => ({ key: c.key, labelEn: c.label, labelFa: c.label, numeric: typeof result.rows[0]?.[c.key] === 'number', render: (row: DTRow) => fmt(row[c.key]) })) as DTColumn<DTRow>[]}
                rows={result.rows as DTRow[]}
                locale={locale}
                exportName={`report-${result.def.id ?? 'result'}`}
                emptyLabel={t('rep_noData')}
              />
            </Card>
          ) : (
            <Card className="p-5 space-y-3">
              <p className="text-overline text-text-tertiary">{t('rep_summaryBy')}: {result.def.groupField}</p>
              {summaryRows.map(s => (
                <div key={s.group} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate text-sm text-text-secondary" title={s.group}>{s.group}</span>
                  <div className="flex-1 h-3 rounded bg-white/[0.04] overflow-hidden">
                    <div className="h-full rounded bg-accent" style={{ width: `${Math.max(2, (Math.abs(s.value) / maxVal) * 100)}%` }} />
                  </div>
                  <span className="w-28 shrink-0 text-end text-sm font-medium text-text-primary tabular-nums">{fmt(s.value)}</span>
                  <span className="w-10 shrink-0 text-end text-xs text-text-tertiary">×{s.count}</span>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      <p className="text-xs text-text-tertiary">{t('rep_footnote')}</p>
    </div>
  )
}
