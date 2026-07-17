'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, PageHeader, Badge } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'
import { DataTable } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

// BUG-012 (26.26): storage now carries REAL PostgreSQL metrics (bloat/autovacuum/
// connections/WAL) instead of the SQLite PRAGMA fields (pageSize/pageCount/
// freelistPages) that node-postgres never returned → the old UI crashed the whole
// page on `data.storage.pageCount.toLocaleString()`. Every access here is guarded.
interface Health {
  path: string; driver: string
  health: { score: number; status: string; checks: Record<string, boolean> }
  integrity: { integrity: string; quick: string; fkEnabled: boolean; fkViolations: number }
  storage: {
    journalMode: string; walLevel?: string; logicalBytes: number; freeBytes: number; fileBytes: number; walBytes: number
    deadTuples?: number; liveTuples?: number; bloatPct?: number; activeConnections?: number
    lastVacuum?: string | null; lastAnalyze?: string | null; autovacuumCount?: number
  }
  census: { tables: number; indexes: number; totalRows: number }
  schema: { critical: number; missingCritical: string[] }
  rowCounts: { table: string; rows: number }[]
  generatedAt: string
}

const L = (fa: boolean, en: string, f: string) => (fa ? f : en)
function fmtBytes(n?: number): string {
  if (!n || n <= 0) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']; const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(1)} ${u[i]}`
}
const nfmt = (n?: number) => (typeof n === 'number' ? n.toLocaleString() : '—')

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'warn' | 'bad' }) {
  const ring = tone === 'ok' ? 'border-success/40' : tone === 'warn' ? 'border-warning/40' : tone === 'bad' ? 'border-danger/40' : 'border-subtle'
  return (
    <div className={`rounded-xl p-4 bg-surface-2 border ${ring}`}>
      <p className="text-xs text-text-tertiary mb-1">{label}</p>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      {sub && <p className="text-2xs text-text-tertiary mt-1 truncate">{sub}</p>}
    </div>
  )
}

export function DatabaseHealth() {
  const locale = useAdminLocale()
  const fa = locale === 'fa'
  const [data, setData] = useState<Health | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const CHECK_LABEL: Record<string, string> = {
    integrity: L(fa, 'Integrity check', 'یکپارچگی'), quickCheck: L(fa, 'Quick check', 'بررسی سریع'),
    foreignKeys: L(fa, 'Foreign keys', 'کلیدهای خارجی'), walMode: L(fa, 'WAL level', 'سطح WAL'),
    schema: L(fa, 'Critical schema', 'اسکیمای حیاتی'), bloat: L(fa, 'Low bloat', 'تورم پایین'),
  }

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const r = await fetch('/api/admin/database/health')
      if (r.ok) setData(await r.json())
      else setErr(L(fa, 'Failed to load database health', 'خطا در دریافت سلامت دیتابیس'))
    } catch { setErr(L(fa, 'Failed to load database health', 'خطا در دریافت سلامت دیتابیس')) } finally { setLoading(false) }
  }, [fa])
  useEffect(() => { load() }, [load])

  const statusTone = data?.health?.status === 'healthy' ? 'ok' : data?.health?.status === 'warning' ? 'warn' : 'bad'
  const bloat = data?.storage?.bloatPct ?? 0

  return (
    <div dir={fa ? 'rtl' : 'ltr'}>
      <PageHeader
        title={L(fa, 'Database Center', 'مرکز دیتابیس')}
        action={<Btn size="sm" variant="secondary" onClick={load} disabled={loading}>{loading ? L(fa, 'Checking…', 'بررسی…') : L(fa, 'Refresh', 'به‌روزرسانی')}</Btn>}
      />

      {loading && !data ? (
        <p className="text-sm text-text-tertiary">{L(fa, 'Loading…', 'در حال بارگذاری…')}</p>
      ) : !data ? (
        <Card className="p-5"><p className="text-sm text-text-tertiary">{err || L(fa, 'Database info unavailable.', 'اطلاعات دیتابیس در دسترس نیست.')}</p></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className={`rounded-xl p-4 border ${statusTone === 'ok' ? 'bg-success/10 border-success/40' : statusTone === 'warn' ? 'bg-warning/10 border-warning/40' : 'bg-danger/10 border-danger/40'}`}>
              <p className="text-xs text-text-tertiary mb-1">{L(fa, 'Health', 'سلامت دیتابیس')}</p>
              <p className="text-2xl font-bold text-text-primary">{data.health?.score ?? '—'}<span className="text-sm text-text-tertiary">/100</span></p>
              <p className="text-2xs mt-1"><Badge color={statusTone === 'ok' ? 'green' : statusTone === 'warn' ? 'yellow' : 'red'}>{data.health?.status ?? '—'}</Badge></p>
            </div>
            <Tile label={L(fa, 'Tables', 'جداول')} value={nfmt(data.census?.tables)} sub={`${nfmt(data.census?.indexes)} ${L(fa, 'indexes', 'ایندکس')}`} />
            <Tile label={L(fa, 'Total records', 'کل رکوردها')} value={nfmt(data.census?.totalRows)} />
            <Tile label={L(fa, 'DB size', 'حجم دیتابیس')} value={fmtBytes(data.storage?.fileBytes)} sub={`WAL: ${fmtBytes(data.storage?.walBytes)}`} />
            <Tile label={L(fa, 'Bloat (dead tuples)', 'تورم (رکورد مرده)')} value={`${bloat}%`} sub={`${nfmt(data.storage?.deadTuples)} ${L(fa, 'dead', 'مرده')}`} tone={bloat < 25 ? 'ok' : 'warn'} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4 mb-6">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-3">{L(fa, 'Health checks', 'بررسی‌های سلامت')}</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(data.health?.checks ?? {}).map(([k, ok]) => (
                  <div key={k} className="flex items-center gap-2 text-sm">
                    <span className={ok ? 'text-success' : 'text-danger'}>{ok ? '✓' : '✗'}</span>
                    <span className="text-text-secondary">{CHECK_LABEL[k] ?? k}</span>
                  </div>
                ))}
              </div>
              <p className="text-2xs text-text-tertiary mt-3">
                integrity: <span className="font-mono">{data.integrity?.integrity ?? '—'}</span> · quick: <span className="font-mono">{data.integrity?.quick ?? '—'}</span> ·
                FK: {data.integrity?.fkEnabled ? 'on' : 'off'} ({nfmt(data.integrity?.fkViolations)} {L(fa, 'violations', 'نقض')}) · WAL: {data.storage?.walLevel ?? data.storage?.journalMode ?? '—'}
              </p>
            </Card>
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-3">{L(fa, 'Maintenance & connections', 'نگهداری و اتصال‌ها')}</h3>
              <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                <span className="text-text-tertiary">{L(fa, 'Active connections', 'اتصال‌های فعال')}</span><span className="text-text-primary text-end">{nfmt(data.storage?.activeConnections)}</span>
                <span className="text-text-tertiary">{L(fa, 'Autovacuum runs', 'اجراهای autovacuum')}</span><span className="text-text-primary text-end">{nfmt(data.storage?.autovacuumCount)}</span>
                <span className="text-text-tertiary">{L(fa, 'Last vacuum', 'آخرین vacuum')}</span><span className="text-text-primary text-end font-mono text-xs">{data.storage?.lastVacuum ?? '—'}</span>
                <span className="text-text-tertiary">{L(fa, 'Last analyze', 'آخرین analyze')}</span><span className="text-text-primary text-end font-mono text-xs">{data.storage?.lastAnalyze ?? '—'}</span>
                <span className="text-text-tertiary">{L(fa, 'Live tuples', 'رکورد زنده')}</span><span className="text-text-primary text-end">{nfmt(data.storage?.liveTuples)}</span>
              </div>
              {data.schema?.missingCritical?.length ? (
                <p className="text-xs text-danger mt-3">✗ {L(fa, 'Missing critical tables:', 'جداول حیاتی گم‌شده:')} <span className="font-mono">{data.schema.missingCritical.join(', ')}</span></p>
              ) : (
                <p className="text-xs text-success mt-3">✓ {L(fa, `All ${data.schema?.critical ?? 0} critical tables present.`, `همه ${data.schema?.critical ?? 0} جدول حیاتی موجود‌اند.`)}</p>
              )}
              <p className="text-3xs text-text-tertiary mt-1 font-mono truncate" title={data.path}>{data.driver} · {data.path}</p>
            </Card>
          </div>

          <Card className="p-0 overflow-hidden">
            <h3 className="text-sm font-semibold text-text-primary p-5 pb-3">{L(fa, 'Records per table', 'تعداد رکورد هر جدول')}</h3>
            <div className="p-4 pt-0">
              <DataTable
                tableId="db-row-counts"
                columns={[
                  { key: 'table', labelEn: 'Table', labelFa: 'جدول', render: r => <span className="font-mono text-text-secondary">{r.table}</span> },
                  { key: 'rows', labelEn: 'Records', labelFa: 'رکوردها', type: 'number', numeric: true, render: r => <span className="text-text-primary">{r.rows < 0 ? '—' : r.rows.toLocaleString()}</span> },
                  {
                    key: 'ratio', labelEn: 'Ratio', labelFa: 'نسبت', sortable: false, value: r => r.rows,
                    render: r => { const max = data.rowCounts?.[0]?.rows || 1; return <div className="h-1.5 rounded-full bg-sunken overflow-hidden max-w-xs"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(2, (Math.max(r.rows, 0) / max) * 100)}%` }} /></div> },
                  },
                ] as Column<{ table: string; rows: number }>[]}
                rows={(data.rowCounts ?? []).filter((r) => r.rows !== 0)}
                locale={locale}
                pageSize={25}
                rowKey={r => r.table}
                exportName="db-row-counts"
              />
            </div>
            <p className="text-2xs text-text-tertiary px-5 py-3 border-t border-subtle">
              {L(fa, 'Only non-empty tables shown · restore sandbox + backup verification in “Backup & Recovery”.', 'فقط جداول دارای رکورد نمایش داده می‌شوند · restore sandbox و تأیید بکاپ در «Backup & Recovery».')}
            </p>
          </Card>
        </>
      )}
    </div>
  )
}
