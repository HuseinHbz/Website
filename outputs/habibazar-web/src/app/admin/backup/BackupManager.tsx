'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, Btn, PageHeader, Badge, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

/* ── Types (mirror /api/admin/backup/engine) ─────────────────────────────── */
interface CatalogRow {
  id: string; version: string; trigger: string; bucket: string | null; status: string
  size: number; verified: number; attempts: number; error: string | null
  started_at: string; finished_at: string | null; copies: string | null
}
interface EngineData {
  root: string; env: string; running: boolean
  encryption: { algo: string; dedicatedKey: boolean }
  strategy: { storageTypes: number; mirror: boolean; offsite: boolean; rule321Met: boolean; copiesLatest: number; adapters: string[] }
  totals: { total: number; size: number; ok: number; failed: number; verified: number }
  latest: CatalogRow | null
  catalog: CatalogRow[]
  alerts: { level: string; message: string; count: number; at: string }[]
}

// The cron-free automatic schedule (mirrors lib/backup/scheduler.ts).
const SCHEDULE = [
  { bucket: 'hourly', cadence: 'هر ساعت', scope: 'دیتابیس' },
  { bucket: 'daily', cadence: 'روزانه', scope: 'کامل (DB + مدیا + کانفیگ)' },
  { bucket: 'weekly', cadence: 'هفتگی', scope: 'اسنپ‌شات کامل' },
  { bucket: 'monthly', cadence: 'ماهانه', scope: 'آرشیو' },
  { bucket: 'yearly', cadence: 'سالانه', scope: 'آرشیو بلندمدت' },
]

function fmtSize(bytes: number): string {
  if (!bytes) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']; const i = Math.min(u.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** i).toFixed(1)} ${u[i]}`
}
function timeAgo(iso?: string | null): string {
  if (!iso) return '—'
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'همین الان'
  if (m < 60) return `${m} دقیقه پیش`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} ساعت پیش`
  return `${Math.round(h / 24)} روز پیش`
}
const statusColor: Record<string, string> = { success: 'green', failed: 'red', invalid: 'red', started: 'yellow' }

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

export function BackupManager() {
  const t = useT()
  const [engine, setEngine] = useState<EngineData | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const { toast, ToastContainer } = useToast()

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/backup/engine')
      if (r.ok) setEngine(await r.json())
    } catch { /* engine not reachable */ } finally { setLoading(false) }
  }, [])

  // Poll so automatic backups appear without a manual refresh.
  useEffect(() => {
    load()
    const id = setInterval(load, 8000)
    return () => clearInterval(id)
  }, [load])

  async function runNow() {
    setRunning(true)
    try {
      const r = await fetch('/api/admin/backup/run', { method: 'POST' })
      if (r.status === 202) { toast('بکاپ شروع شد — در حال اجرا در پس‌زمینه', 'success'); setTimeout(load, 1500) }
      else if (r.status === 409) toast('یک بکاپ در حال اجراست', 'error')
      else throw new Error()
    } catch { toast('اجرای بکاپ ناموفق بود', 'error') } finally { setRunning(false) }
  }

  return (
    <>
      <ToastContainer />
      <PageHeader
        title={t('backupTitle')}
        action={
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-xs ${engine?.running ? 'text-warning' : 'text-success'}`}>
              <span className={`w-2 h-2 rounded-full ${engine?.running ? 'bg-warning animate-pulse' : 'bg-success'}`} />
              {engine?.running ? 'در حال بکاپ‌گیری' : 'موتور فعال'}
            </span>
            <Btn onClick={runNow} disabled={running || engine?.running}>{running ? 'شروع…' : 'بکاپ فوری'}</Btn>
          </div>
        }
      />

      {loading ? (
        <p className="text-sm text-text-tertiary">در حال بارگذاری…</p>
      ) : !engine ? (
        <Card className="p-5"><p className="text-sm text-text-tertiary">موتور بکاپ در دسترس نیست.</p></Card>
      ) : (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <Tile label="بکاپ‌گیری خودکار" value="فعال" sub="بدون cron · درون‌برنامه‌ای" tone="ok" />
            <Tile label="کل بکاپ‌ها" value={String(engine.totals.total)} sub={`${engine.totals.verified} تأییدشده`} />
            <Tile label="حجم" value={fmtSize(engine.totals.size)} />
            <Tile label="قانون 3-2-1" value={engine.strategy.rule321Met ? 'برقرار' : 'ناقص'} sub={engine.strategy.adapters.join(' · ')} tone={engine.strategy.rule321Met ? 'ok' : 'warn'} />
            <Tile label="ناموفق" value={String(engine.totals.failed)} tone={engine.totals.failed > 0 ? 'bad' : 'ok'} />
          </div>

          {/* Alerts */}
          {engine.alerts.length > 0 && (
            <Card className="p-4 mb-6 border-danger/40">
              <h3 className="text-sm font-semibold text-danger mb-2">⚠ هشدارها</h3>
              <ul className="space-y-1">
                {engine.alerts.slice(0, 6).map((a, i) => (
                  <li key={i} className="text-xs text-text-secondary flex items-center gap-2">
                    <Badge color={a.level === 'critical' ? 'red' : 'yellow'}>{a.level}</Badge>
                    <span className="truncate">{a.message}</span>
                    <span className="text-text-tertiary">×{a.count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Automatic backup — schedule + triggers */}
          <Card className="p-5 mb-6">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-text-primary">بکاپ‌گیری خودکار (زمان‌بند داخلی — بدون cron)</h3>
              {engine.latest && (
                <Badge color={statusColor[engine.latest.status] ?? 'slate'}>
                  آخرین: {engine.latest.trigger} · {engine.latest.status} · {timeAgo(engine.latest.started_at)}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
              {SCHEDULE.map((s) => (
                <div key={s.bucket} className="rounded-lg p-3 bg-surface-2 border border-subtle">
                  <p className="text-xs font-medium text-text-primary capitalize">{s.bucket}</p>
                  <p className="text-[11px] text-text-secondary">{s.cadence}</p>
                  <p className="text-[10px] text-text-tertiary mt-1">{s.scope}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-text-tertiary leading-relaxed">
              رخدادهای فعال‌ساز: زمان‌بند داخلی (ساعتی تا سالانه)، تغییر داده‌ها (خودکار پس از هر ویرایش در پنل)، تغییر فایل‌های مدیا، و اجرای دستی.
              هر بکاپ: اسنپ‌شات WAL-safe دیتابیس + کانفیگ + مدیا → tar.gz → رمزنگاری {engine.encryption.algo} → checksum SHA-256 →
              توزیع روی {engine.strategy.adapters.length} مقصد ({engine.strategy.adapters.join('، ')}) → <span className="text-text-secondary">تأیید با restore آزمایشی ایزوله</span> پیش از ثبت موفقیت.
              {!engine.encryption.dedicatedKey && <span className="text-warning"> · هشدار: کلید اختصاصی BACKUP_ENCRYPTION_KEY تنظیم نشده (fallback به JWT).</span>}
              {!engine.strategy.offsite && <span className="text-warning"> · برای 3-2-1 کامل، BACKUP_REMOTE (آفسایت) را تنظیم کنید.</span>}
            </p>
          </Card>

          {/* Catalog */}
          <Card className="p-0 overflow-hidden">
            <h3 className="text-sm font-semibold text-text-primary p-5 pb-3">تاریخچه بکاپ‌ها</h3>
            {engine.catalog.length === 0 ? (
              <p className="text-sm text-text-tertiary px-5 pb-5">هنوز بکاپی ثبت نشده. زمان‌بند به‌زودی اولین بکاپ را می‌سازد یا «بکاپ فوری» را بزنید.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-text-tertiary text-left border-b border-subtle">
                    <th className="px-5 py-2">نسخه</th><th className="px-3 py-2">منبع</th><th className="px-3 py-2">دوره</th>
                    <th className="px-3 py-2">وضعیت</th><th className="px-3 py-2">تأیید</th><th className="px-3 py-2">حجم</th>
                    <th className="px-3 py-2">نسخه‌ها</th><th className="px-3 py-2">زمان</th>
                  </tr></thead>
                  <tbody>
                    {engine.catalog.map((b) => {
                      const copies = b.copies ? (JSON.parse(b.copies) as unknown[]).length : 0
                      return (
                        <tr key={b.id} className="border-b border-subtle/50">
                          <td className="px-5 py-2 font-mono text-text-secondary truncate max-w-[160px]" title={b.version}>{b.version}</td>
                          <td className="px-3 py-2 text-text-tertiary">{b.trigger}</td>
                          <td className="px-3 py-2 text-text-tertiary">{b.bucket ?? '—'}</td>
                          <td className="px-3 py-2"><Badge color={statusColor[b.status] ?? 'slate'}>{b.status}</Badge></td>
                          <td className="px-3 py-2">{b.verified ? <span className="text-success">✓</span> : <span className="text-text-disabled">—</span>}</td>
                          <td className="px-3 py-2 text-text-secondary">{fmtSize(b.size)}</td>
                          <td className="px-3 py-2 text-text-tertiary">{copies}×</td>
                          <td className="px-3 py-2 text-text-tertiary">{timeAgo(b.started_at)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[11px] text-text-tertiary px-5 py-3 border-t border-subtle">
              محل ذخیره: <span className="font-mono">{engine.root}</span> · محیط: {engine.env} · پایش زنده رخدادها در «لاگ‌ها و پایش زنده».
            </p>
          </Card>
        </>
      )}
    </>
  )
}
