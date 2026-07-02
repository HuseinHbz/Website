'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, Btn, PageHeader, Badge, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

interface BackupEntry {
  name: string
  size: number
  createdAt: string
}

interface SystemStatus {
  bucket: string
  status: string
  detail?: string
  finishedAt?: string
}
interface SystemData {
  root: string
  status: SystemStatus | null
  buckets: Record<string, BackupEntry[]>
  count: number
  totalSize: number
  latest: BackupEntry | null
}

const BUCKETS = ['hourly', 'daily', 'weekly', 'monthly', 'yearly'] as const

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.round(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export function BackupManager() {
  const t = useT()
  const [backups, setBackups] = useState<BackupEntry[]>([])
  const [system, setSystem] = useState<SystemData | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const { toast, ToastContainer } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/backup')
      if (!r.ok) throw new Error(await r.text())
      setBackups(await r.json())
    } catch {
      toast('Failed to load backups', 'error')
    } finally {
      setLoading(false)
    }
    // Automated (cron) backups — read-only monitoring; ignore if not set up.
    try {
      const sr = await fetch('/api/admin/backup/system')
      if (sr.ok) setSystem(await sr.json())
    } catch { /* automated backups not configured */ }
  }, [toast])

  // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  useEffect(() => { load() }, [])

  async function createBackup() {
    setCreating(true)
    try {
      const r = await fetch('/api/admin/backup', { method: 'POST' })
      if (!r.ok) throw new Error(await r.text())
      toast('Database backup created', 'success')
      await load()
    } catch {
      toast('Backup failed', 'error')
    } finally {
      setCreating(false)
    }
  }

  async function del(name: string) {
    if (!confirm(`Delete backup ${name}?`)) return
    try {
      const r = await fetch(`/api/admin/backup?name=${encodeURIComponent(name)}`, { method: 'DELETE' })
      if (!r.ok) throw new Error(await r.text())
      toast('Backup deleted', 'success')
      await load()
    } catch {
      toast('Delete failed', 'error')
    }
  }

  const totalSize = backups.reduce((sum, b) => sum + b.size, 0)
  const stats = [
    { label: 'Total Backups', value: String(backups.length), icon: '💾' },
    { label: 'Last Backup', value: backups[0] ? timeAgo(backups[0].createdAt) : '—', icon: '🕐' },
    { label: 'Storage Used', value: fmtSize(totalSize), icon: '📦' },
  ]

  return (
    <>
      <ToastContainer />
      <PageHeader title={t('backupTitle')} />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl">{s.icon}</span>
              <p className="text-xs text-text-tertiary">{s.label}</p>
            </div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Create backup */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">Create Database Backup</h3>
            <p className="text-xs text-text-tertiary">A consistent snapshot of the SQLite database is saved to <span className="font-mono">data/backups/</span>.</p>
          </div>
          <Btn onClick={createBackup} disabled={creating}>{creating ? 'Backing up…' : 'Backup now'}</Btn>
        </div>
      </Card>

      {/* Automated backups (3-2-1) — monitoring of deploy/backup.sh + cron */}
      {system && system.count > 0 && (
        <Card className="p-5 mb-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-white">Automated Backups <span className="text-text-tertiary font-normal">(encrypted · 3-2-1)</span></h3>
            {system.status && (
              <Badge color={system.status.status === 'ok' ? 'green' : 'red'}>
                last: {system.status.bucket} · {system.status.status}
                {system.status.finishedAt ? ` · ${timeAgo(system.status.finishedAt)}` : ''}
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {BUCKETS.map((b) => {
              const list = system.buckets[b] || []
              return (
                <div key={b} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-xs text-text-tertiary capitalize mb-1">{b}</p>
                  <p className="text-lg font-bold text-white">{list.length}</p>
                  <p className="text-[10px] text-text-tertiary">{list[0] ? timeAgo(list[0].createdAt) : 'none'}</p>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-text-tertiary">
            {system.count} encrypted backups · {fmtSize(system.totalSize)} in <span className="font-mono">{system.root}</span>.
            Verified with checksum + integrity check; retention auto-purged. Weekly recovery-test runs automatically.
          </p>
        </Card>
      )}

      {/* Backup history */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Backup History</h3>
        {loading ? (
          <p className="text-sm text-text-tertiary">Loading…</p>
        ) : backups.length === 0 ? (
          <p className="text-sm text-text-tertiary">No backups yet. Click “Backup now” to create the first one.</p>
        ) : (
          <div className="space-y-2">
            {backups.map((b) => (
              <div
                key={b.name}
                className="flex items-center gap-4 p-3 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <span className="text-lg">🗄️</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-mono truncate">{b.name}</p>
                  <p className="text-xs text-text-tertiary">{new Date(b.createdAt).toLocaleString()}</p>
                </div>
                <Badge color="green">database</Badge>
                <span className="text-xs text-text-secondary w-16 text-right">{fmtSize(b.size)}</span>
                <div className="flex gap-2">
                  <a href={`/api/admin/backup?download=${encodeURIComponent(b.name)}`} download>
                    <Btn size="sm" variant="secondary">{t('downloadBtn')}</Btn>
                  </a>
                  <Btn size="sm" variant="secondary" onClick={() => del(b.name)}>Delete</Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  )
}
