'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, PageHeader, Badge, useToast } from '@/components/admin/ui'

interface BackupEntry {
  id: string
  name: string
  type: 'full' | 'database' | 'media' | 'config'
  size: string
  createdAt: string
  status: 'completed' | 'in_progress' | 'failed'
}

const TYPE_COLORS = {
  full: 'indigo',
  database: 'green',
  media: 'blue',
  config: 'yellow',
} as const

const MOCK_BACKUPS: BackupEntry[] = [
  { id: '1', name: 'full-backup-2025-06-30', type: 'full', size: '248 MB', createdAt: '2025-06-30T03:00:00Z', status: 'completed' },
  { id: '2', name: 'db-backup-2025-06-29', type: 'database', size: '12.4 MB', createdAt: '2025-06-29T03:00:00Z', status: 'completed' },
  { id: '3', name: 'media-backup-2025-06-28', type: 'media', size: '235 MB', createdAt: '2025-06-28T03:00:00Z', status: 'completed' },
  { id: '4', name: 'config-backup-2025-06-27', type: 'config', size: '1.2 MB', createdAt: '2025-06-27T03:00:00Z', status: 'completed' },
]

export function BackupManager() {
  const [backups] = useState<BackupEntry[]>(MOCK_BACKUPS)
  const [running, setRunning] = useState<string | null>(null)
  const { toast, ToastContainer } = useToast()

  async function runBackup(type: BackupEntry['type']) {
    setRunning(type)
    await new Promise(r => setTimeout(r, 2000))
    setRunning(null)
    toast(`${type} backup initiated successfully`, 'success')
  }

  const stats = [
    { label: 'Total Backups', value: backups.length, icon: '💾', color: '#6366f1' },
    { label: 'Last Backup', value: '3h ago', icon: '🕐', color: '#10b981' },
    { label: 'Storage Used', value: '496 MB', icon: '📦', color: '#06b6d4' },
    { label: 'Retention Days', value: '30', icon: '📅', color: '#f59e0b' },
  ]

  return (
    <>
      <ToastContainer />
      <PageHeader title="Backup & Recovery" />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl">{s.icon}</span>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Backup actions */}
      <Card className="p-5 mb-6">
        <h3 className="text-sm font-semibold text-white mb-4">Create Backup</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(['full', 'database', 'media', 'config'] as const).map(type => (
            <button
              key={type}
              onClick={() => runBackup(type)}
              disabled={running !== null}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border transition-all hover:border-indigo-500/40 disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <span className="text-2xl">
                {type === 'full' ? '🗂️' : type === 'database' ? '🗄️' : type === 'media' ? '🖼️' : '⚙️'}
              </span>
              <span className="text-xs font-medium text-slate-300 capitalize">
                {running === type ? 'Running...' : `${type === 'full' ? 'Full' : type.charAt(0).toUpperCase() + type.slice(1)} Backup`}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {/* Scheduled backups */}
      <Card className="p-5 mb-6">
        <h3 className="text-sm font-semibold text-white mb-4">Scheduled Backups</h3>
        <div className="space-y-3">
          {[
            { name: 'Daily Full Backup', schedule: 'Every day at 03:00 AM', next: 'Tomorrow 03:00 AM', active: true },
            { name: 'Weekly Database Export', schedule: 'Every Sunday at 02:00 AM', next: 'Sunday 02:00 AM', active: true },
            { name: 'Monthly Archive', schedule: '1st of every month at 01:00 AM', next: 'Jul 1, 2025 01:00 AM', active: false },
          ].map((schedule, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-3 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${schedule.active ? 'bg-green-400' : 'bg-slate-600'}`} />
              <div className="flex-1">
                <p className="text-sm text-white">{schedule.name}</p>
                <p className="text-xs text-slate-500">{schedule.schedule}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Next</p>
                <p className="text-xs text-indigo-400">{schedule.next}</p>
              </div>
              <Badge color={schedule.active ? 'green' : 'slate'}>{schedule.active ? 'Active' : 'Disabled'}</Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Backup history */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Backup History</h3>
        <div className="space-y-2">
          {backups.map(backup => (
            <div
              key={backup.id}
              className="flex items-center gap-4 p-3 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <span className="text-lg">
                {backup.type === 'full' ? '🗂️' : backup.type === 'database' ? '🗄️' : backup.type === 'media' ? '🖼️' : '⚙️'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-mono truncate">{backup.name}</p>
                <p className="text-xs text-slate-500">{new Date(backup.createdAt).toLocaleString()}</p>
              </div>
              <Badge color={TYPE_COLORS[backup.type]}>{backup.type}</Badge>
              <span className="text-xs text-slate-400 w-16 text-right">{backup.size}</span>
              <Badge color={backup.status === 'completed' ? 'green' : backup.status === 'failed' ? 'red' : 'indigo'}>
                {backup.status}
              </Badge>
              <div className="flex gap-2">
                <Btn size="sm" variant="secondary">⬇ Download</Btn>
                <Btn size="sm" variant="secondary">↺ Restore</Btn>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}
