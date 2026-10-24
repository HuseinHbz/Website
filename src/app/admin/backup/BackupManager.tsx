'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, Btn, PageHeader, Badge, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

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
  { bucket: 'hourly', cadenceEn: 'Every hour', cadenceFa: 'هر ساعت', scopeEn: 'Database', scopeFa: 'دیتابیس' },
  { bucket: 'daily', cadenceEn: 'Daily', cadenceFa: 'روزانه', scopeEn: 'Full (DB + media + config)', scopeFa: 'کامل (DB + مدیا + کانفیگ)' },
  { bucket: 'weekly', cadenceEn: 'Weekly', cadenceFa: 'هفتگی', scopeEn: 'Full snapshot', scopeFa: 'اسنپ‌شات کامل' },
  { bucket: 'monthly', cadenceEn: 'Monthly', cadenceFa: 'ماهانه', scopeEn: 'Archive', scopeFa: 'آرشیو' },
  { bucket: 'yearly', cadenceEn: 'Yearly', cadenceFa: 'سالانه', scopeEn: 'Long-term archive', scopeFa: 'آرشیو بلندمدت' },
]

function fmtSize(bytes: number): string {
  if (!bytes) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']; const i = Math.min(u.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** i).toFixed(1)} ${u[i]}`
}
function timeAgo(iso: string | null | undefined, rtl: boolean): string {
  if (!iso) return '—'
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return rtl ? 'همین الان' : 'just now'
  if (m < 60) return rtl ? `${m} دقیقه پیش` : `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return rtl ? `${h} ساعت پیش` : `${h}h ago`
  return rtl ? `${Math.round(h / 24)} روز پیش` : `${Math.round(h / 24)}d ago`
}
const statusColor: Record<string, string> = { success: 'green', failed: 'red', invalid: 'red', started: 'yellow' }
const statusLabel: Record<string, [string, string]> = {
  success: ['Success', 'موفق'], failed: ['Failed', 'ناموفق'], invalid: ['Invalid', 'نامعتبر'], started: ['Running', 'در حال اجرا'],
}
function fmtStatus(status: string, locale: 'fa' | 'en'): string {
  const pair = statusLabel[status]
  return pair ? (locale === 'fa' ? pair[1] : pair[0]) : status
}

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

export function BackupManager() {
  const t = useT()
  const locale = useAdminLocale()
  const rtl = locale === 'fa'
  const lc = (en: string, fa: string) => (rtl ? fa : en)
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
      if (r.status === 202) { toast(lc('Backup started — running in the background', 'بکاپ شروع شد — در حال اجرا در پس‌زمینه'), 'success'); setTimeout(load, 1500) }
      else if (r.status === 409) toast(lc('A backup is already running', 'یک بکاپ در حال اجراست'), 'error')
      else throw new Error()
    } catch { toast(lc('Backup run failed', 'اجرای بکاپ ناموفق بود'), 'error') } finally { setRunning(false) }
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
              {engine?.running ? lc('Backing up…', 'در حال بکاپ‌گیری') : lc('Engine active', 'موتور فعال')}
            </span>
            <Btn onClick={runNow} disabled={running || engine?.running}>{running ? lc('Starting…', 'شروع…') : lc('Run backup now', 'بکاپ فوری')}</Btn>
          </div>
        }
      />

      {loading ? (
        <p className="text-sm text-text-tertiary">{lc('Loading…', 'در حال بارگذاری…')}</p>
      ) : !engine ? (
        <Card className="p-5"><p className="text-sm text-text-tertiary">{lc('Backup engine is not available.', 'موتور بکاپ در دسترس نیست.')}</p></Card>
      ) : (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <Tile label={lc('Automatic backup', 'بکاپ‌گیری خودکار')} value={lc('Active', 'فعال')} sub={lc('No cron · in-process', 'بدون cron · درون‌برنامه‌ای')} tone="ok" />
            <Tile label={lc('Total backups', 'کل بکاپ‌ها')} value={String(engine.totals.total)} sub={lc(`${engine.totals.verified} verified`, `${engine.totals.verified} تأییدشده`)} />
            <Tile label={lc('Size', 'حجم')} value={fmtSize(engine.totals.size)} />
            <Tile label={lc('3-2-1 rule', 'قانون 3-2-1')} value={engine.strategy.rule321Met ? lc('Met', 'برقرار') : lc('Incomplete', 'ناقص')} sub={engine.strategy.adapters.join(' · ')} tone={engine.strategy.rule321Met ? 'ok' : 'warn'} />
            <Tile label={lc('Failed', 'ناموفق')} value={String(engine.totals.failed)} tone={engine.totals.failed > 0 ? 'bad' : 'ok'} />
          </div>

          {/* Alerts */}
          {engine.alerts.length > 0 && (
            <Card className="p-4 mb-6 border-danger/40">
              <h3 className="text-sm font-semibold text-danger mb-2">⚠ {lc('Alerts', 'هشدارها')}</h3>
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
              <h3 className="text-sm font-semibold text-text-primary">{lc('Automatic backup (internal scheduler — no cron)', 'بکاپ‌گیری خودکار (زمان‌بند داخلی — بدون cron)')}</h3>
              {engine.latest && (
                <Badge color={statusColor[engine.latest.status] ?? 'slate'}>
                  {lc('Last', 'آخرین')}: {engine.latest.trigger} · {fmtStatus(engine.latest.status, locale)} · {timeAgo(engine.latest.started_at, rtl)}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
              {SCHEDULE.map((s) => (
                <div key={s.bucket} className="rounded-lg p-3 bg-surface-2 border border-subtle">
                  <p className="text-xs font-medium text-text-primary capitalize">{s.bucket}</p>
                  <p className="text-2xs text-text-secondary">{lc(s.cadenceEn, s.cadenceFa)}</p>
                  <p className="text-3xs text-text-tertiary mt-1">{lc(s.scopeEn, s.scopeFa)}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-text-tertiary leading-relaxed">
              {lc(
                `Triggers: internal scheduler (hourly through yearly), data changes (automatic after every panel edit), media file changes, and manual runs.
                Each backup: WAL-safe DB snapshot + config + media → tar.gz → ${engine.encryption.algo} encryption → SHA-256 checksum →
                distributed to ${engine.strategy.adapters.length} destination(s) (${engine.strategy.adapters.join(', ')}) → `,
                `رخدادهای فعال‌ساز: زمان‌بند داخلی (ساعتی تا سالانه)، تغییر داده‌ها (خودکار پس از هر ویرایش در پنل)، تغییر فایل‌های مدیا، و اجرای دستی.
                هر بکاپ: اسنپ‌شات WAL-safe دیتابیس + کانفیگ + مدیا → tar.gz → رمزنگاری ${engine.encryption.algo} → checksum SHA-256 →
                توزیع روی ${engine.strategy.adapters.length} مقصد (${engine.strategy.adapters.join('، ')}) → `,
              )}
              <span className="text-text-secondary">{lc('verified by an isolated test restore', 'تأیید با restore آزمایشی ایزوله')}</span>
              {lc(' before recording success.', ' پیش از ثبت موفقیت.')}
              {!engine.encryption.dedicatedKey && <span className="text-warning"> · {lc('Warning: no dedicated BACKUP_ENCRYPTION_KEY set (falling back to JWT).', 'هشدار: کلید اختصاصی BACKUP_ENCRYPTION_KEY تنظیم نشده (fallback به JWT).')}</span>}
              {!engine.strategy.offsite && <span className="text-warning"> · {lc('For a full 3-2-1, configure BACKUP_REMOTE (offsite).', 'برای 3-2-1 کامل، BACKUP_REMOTE (آفسایت) را تنظیم کنید.')}</span>}
            </p>
          </Card>

          {/* Catalog */}
          <Card className="p-0 overflow-hidden">
            <h3 className="text-sm font-semibold text-text-primary p-5 pb-3">{lc('Backup history', 'تاریخچه بکاپ‌ها')}</h3>
            <div className="p-4 pt-0">
              <DataTable
                tableId="backup-catalog"
                columns={[
                  { key: 'version', labelEn: 'Version', labelFa: 'نسخه', render: b => <span className="font-mono text-text-secondary truncate max-w-[160px] inline-block" title={b.version}>{b.version}</span> },
                  { key: 'trigger', labelEn: 'Source', labelFa: 'منبع', type: 'enum', render: b => <span className="text-text-tertiary">{b.trigger}</span> },
                  { key: 'bucket', labelEn: 'Period', labelFa: 'دوره', type: 'enum', render: b => <span className="text-text-tertiary">{b.bucket ?? '—'}</span> },
                  { key: 'status', labelEn: 'Status', labelFa: 'وضعیت', type: 'enum', render: b => <Badge color={statusColor[b.status] ?? 'slate'}>{fmtStatus(b.status, locale)}</Badge> },
                  { key: 'verified', labelEn: 'Verified', labelFa: 'تأیید', type: 'boolean', value: b => !!b.verified, render: b => b.verified ? <span className="text-success">✓</span> : <span className="text-text-disabled">—</span> },
                  { key: 'size', labelEn: 'Size', labelFa: 'حجم', type: 'number', numeric: true, render: b => <span className="text-text-secondary">{fmtSize(b.size)}</span> },
                  { key: 'copies', labelEn: 'Copies', labelFa: 'نسخه‌ها', type: 'number', numeric: true, value: b => b.copies ? (JSON.parse(b.copies) as unknown[]).length : 0, render: b => <span className="text-text-tertiary">{b.copies ? (JSON.parse(b.copies) as unknown[]).length : 0}×</span> },
                  { key: 'started_at', labelEn: 'Time', labelFa: 'زمان', type: 'date', render: b => <span className="text-text-tertiary">{timeAgo(b.started_at, rtl)}</span> },
                ] as Column<CatalogRow>[]}
                rows={engine.catalog}
                locale={locale}
                rowKey={b => b.id}
                exportName="backup-catalog"
                emptyLabel={lc('No backups recorded yet.', 'هنوز بکاپی ثبت نشده.')}
              />
            </div>
            <p className="text-2xs text-text-tertiary px-5 py-3 border-t border-subtle">
              {lc('Storage path', 'محل ذخیره')}: <span className="font-mono">{engine.root}</span> · {lc('Environment', 'محیط')}: {engine.env} · {lc('Live event monitoring is under "Logs & Monitoring".', 'پایش زنده رخدادها در «لاگ‌ها و پایش زنده».')}
            </p>
          </Card>
        </>
      )}
    </>
  )
}
