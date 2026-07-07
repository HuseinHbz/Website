'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, PageHeader, Badge } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'
import { DataTable } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

interface Health {
  path: string; driver: string
  health: { score: number; status: string; checks: Record<string, boolean> }
  integrity: { integrity: string; quick: string; fkEnabled: boolean; fkViolations: number }
  storage: { journalMode: string; pageSize: number; pageCount: number; freelistPages: number; logicalBytes: number; freeBytes: number; fileBytes: number; walBytes: number; fragmentationPct: number }
  census: { tables: number; indexes: number; totalRows: number }
  schema: { critical: number; missingCritical: string[] }
  rowCounts: { table: string; rows: number }[]
  generatedAt: string
}

function fmtBytes(n: number): string {
  if (!n) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']; const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(1)} ${u[i]}`
}
const CHECK_LABEL: Record<string, string> = {
  integrity: 'Integrity check', quickCheck: 'Quick check', foreignKeys: 'Foreign keys',
  walMode: 'WAL journal mode', schema: 'Critical schema', bloat: 'Low fragmentation',
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'warn' | 'bad' }) {
  const ring = tone === 'ok' ? 'border-success/40' : tone === 'warn' ? 'border-warning/40' : tone === 'bad' ? 'border-danger/40' : 'border-subtle'
  return (
    <div className={`rounded-xl p-4 bg-surface-2 border ${ring}`}>
      <p className="text-xs text-text-tertiary mb-1">{label}</p>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      {sub && <p className="text-[11px] text-text-tertiary mt-1 truncate">{sub}</p>}
    </div>
  )
}

export function DatabaseHealth() {
  const locale = useAdminLocale()
  const [data, setData] = useState<Health | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/database/health')
      if (r.ok) setData(await r.json())
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const statusTone = data?.health.status === 'healthy' ? 'ok' : data?.health.status === 'warning' ? 'warn' : 'bad'

  return (
    <>
      <PageHeader
        title="Database Center"
        action={<Btn size="sm" variant="secondary" onClick={load} disabled={loading}>{loading ? 'بررسی…' : 'به‌روزرسانی'}</Btn>}
      />

      {loading && !data ? (
        <p className="text-sm text-text-tertiary">در حال بارگذاری…</p>
      ) : !data ? (
        <Card className="p-5"><p className="text-sm text-text-tertiary">اطلاعات دیتابیس در دسترس نیست.</p></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className={`rounded-xl p-4 border ${statusTone === 'ok' ? 'bg-success/10 border-success/40' : statusTone === 'warn' ? 'bg-warning/10 border-warning/40' : 'bg-danger/10 border-danger/40'}`}>
              <p className="text-xs text-text-tertiary mb-1">سلامت دیتابیس</p>
              <p className="text-2xl font-bold text-text-primary">{data.health.score}<span className="text-sm text-text-tertiary">/100</span></p>
              <p className="text-[11px] mt-1"><Badge color={statusTone === 'ok' ? 'green' : statusTone === 'warn' ? 'yellow' : 'red'}>{data.health.status}</Badge></p>
            </div>
            <Tile label="جداول" value={String(data.census.tables)} sub={`${data.census.indexes} ایندکس`} />
            <Tile label="کل رکوردها" value={data.census.totalRows.toLocaleString()} />
            <Tile label="حجم دیتابیس" value={fmtBytes(data.storage.fileBytes)} sub={`WAL: ${fmtBytes(data.storage.walBytes)}`} />
            <Tile label="Fragmentation" value={`${data.storage.fragmentationPct}%`} sub={`${data.storage.freelistPages} صفحه آزاد`} tone={data.storage.fragmentationPct < 25 ? 'ok' : 'warn'} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4 mb-6">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-3">بررسی‌های سلامت</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(data.health.checks).map(([k, ok]) => (
                  <div key={k} className="flex items-center gap-2 text-sm">
                    <span className={ok ? 'text-success' : 'text-danger'}>{ok ? '✓' : '✗'}</span>
                    <span className="text-text-secondary">{CHECK_LABEL[k] ?? k}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-text-tertiary mt-3">
                integrity_check: <span className="font-mono">{data.integrity.integrity}</span> · quick_check: <span className="font-mono">{data.integrity.quick}</span> ·
                FK: {data.integrity.fkEnabled ? 'on' : 'off'} ({data.integrity.fkViolations} violation) · journal: {data.storage.journalMode}
              </p>
            </Card>
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-3">اعتبارسنجی Schema</h3>
              {data.schema.missingCritical.length === 0 ? (
                <p className="text-sm text-success">✓ همه {data.schema.critical} جدول حیاتی موجود‌اند.</p>
              ) : (
                <div className="text-sm text-danger">
                  <p className="mb-1">✗ جداول حیاتی گم‌شده:</p>
                  <ul className="text-xs font-mono">{data.schema.missingCritical.map((t) => <li key={t}>• {t}</li>)}</ul>
                </div>
              )}
              <p className="text-[11px] text-text-tertiary mt-3">
                صفحه: {data.storage.pageSize}B × {data.storage.pageCount.toLocaleString()} = {fmtBytes(data.storage.logicalBytes)} منطقی ·
                driver: {data.driver}
              </p>
              <p className="text-[10px] text-text-tertiary mt-1 font-mono truncate" title={data.path}>{data.path}</p>
            </Card>
          </div>

          <Card className="p-0 overflow-hidden">
            <h3 className="text-sm font-semibold text-text-primary p-5 pb-3">تعداد رکورد هر جدول</h3>
            <div className="p-4 pt-0">
              <DataTable
                tableId="db-row-counts"
                columns={[
                  { key: 'table', labelEn: 'Table', labelFa: 'جدول', render: r => <span className="font-mono text-text-secondary">{r.table}</span> },
                  { key: 'rows', labelEn: 'Records', labelFa: 'رکوردها', type: 'number', numeric: true, render: r => <span className="text-text-primary">{r.rows < 0 ? '—' : r.rows.toLocaleString()}</span> },
                  {
                    key: 'ratio', labelEn: 'Ratio', labelFa: 'نسبت', sortable: false, value: r => r.rows,
                    render: r => { const max = data.rowCounts[0]?.rows || 1; return <div className="h-1.5 rounded-full bg-sunken overflow-hidden max-w-xs"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(2, (Math.max(r.rows, 0) / max) * 100)}%` }} /></div> },
                  },
                ] as Column<{ table: string; rows: number }>[]}
                rows={data.rowCounts.filter((r) => r.rows !== 0)}
                locale={locale}
                pageSize={25}
                rowKey={r => r.table}
                exportName="db-row-counts"
              />
            </div>
            <p className="text-[11px] text-text-tertiary px-5 py-3 border-t border-subtle">
              فقط جداول دارای رکورد نمایش داده می‌شوند · restore sandbox و تأیید بکاپ در «Backup & Recovery».
            </p>
          </Card>
        </>
      )}
    </>
  )
}
