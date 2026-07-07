'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, PageHeader, Badge } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

type Log = { id: number; userEmail: string; action: string; resource: string; resourceId: string; createdAt: string; ipAddress: string }

const ACTION_COLOR: Record<string, string> = { CREATE: 'green', UPDATE: 'blue', DELETE: 'red', LOGIN: 'yellow', UPLOAD: 'indigo', LOGOUT: 'slate' }
const ACTION_ICON: Record<string, string> = { CREATE: '✚', UPDATE: '✎', DELETE: '✕', LOGIN: '→', UPLOAD: '↑', LOGOUT: '←' }

export function AuditView() {
  const t = useT()
  const locale = useAdminLocale()
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/audit-logs?limit=500')
      .then(r => r.json())
      .then(d => { setLogs(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const uniqueActions = useMemo(() => [...new Set(logs.map(l => l.action))].sort(), [logs])
  const uniqueResources = useMemo(() => [...new Set(logs.map(l => l.resource))].sort(), [logs])
  const stats = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of logs) counts[l.action] = (counts[l.action] || 0) + 1
    return counts
  }, [logs])

  const columns: Column<Log>[] = [
    { key: 'createdAt', labelEn: 'Time', labelFa: t('time'), type: 'date', render: l => <span className="text-text-tertiary whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</span> },
    { key: 'userEmail', labelEn: 'User', labelFa: t('user'), render: l => <span className="text-text-secondary">{l.userEmail || '—'}</span> },
    { key: 'action', labelEn: 'Action', labelFa: t('action'), type: 'enum', options: uniqueActions.map(a => ({ value: a, labelEn: a, labelFa: a })), render: l => <Badge color={ACTION_COLOR[l.action] || 'slate'}>{ACTION_ICON[l.action] || ''} {l.action}</Badge> },
    { key: 'resource', labelEn: 'Resource', labelFa: t('resource'), type: 'enum', options: uniqueResources.map(r => ({ value: r, labelEn: r, labelFa: r })), render: l => <span className="text-text-primary font-mono">{l.resource}</span> },
    { key: 'resourceId', labelEn: 'ID', labelFa: 'ID', render: l => <span className="text-text-disabled font-mono">{l.resourceId || '—'}</span> },
    { key: 'ipAddress', labelEn: 'IP', labelFa: 'IP', render: l => <span className="text-text-disabled">{l.ipAddress || '—'}</span> },
  ]

  return (
    <>
      <PageHeader title={t('auditCenter')} subtitle={t('auditSub')} />

      {/* Action stat pills (informational) */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        {Object.entries(ACTION_COLOR).map(([action]) => (
          <div key={action} className="flex flex-col items-center gap-1 p-3 rounded-xl border border-border bg-surface-2">
            <span className="text-base">{ACTION_ICON[action] || '•'}</span>
            <span className="text-[10px] text-text-tertiary uppercase font-bold">{action}</span>
            <span className="text-sm font-bold text-white">{stats[action] || 0}</span>
          </div>
        ))}
      </div>

      <Card>
        <DataTable
          tableId="audit-logs"
          columns={columns}
          rows={logs}
          locale={locale}
          loading={loading}
          pageSize={50}
          rowKey={l => String(l.id)}
          exportName="audit-log"
          emptyLabel="No audit logs yet"
        />
      </Card>
    </>
  )
}
