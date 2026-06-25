'use client'

import { useState, useEffect } from 'react'
import { Card, PageHeader, Table, TR, TD, Badge } from '@/components/admin/ui'

type Log = { id: number; userEmail: string; action: string; resource: string; resourceId: string; createdAt: string; ipAddress: string }
const ACTION_COLOR: Record<string, string> = { CREATE: 'green', UPDATE: 'blue', DELETE: 'red', LOGIN: 'yellow', UPLOAD: 'indigo' }

export function AuditView() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/audit-logs?limit=200')
      .then((r) => r.json())
      .then((d) => { setLogs(d); setLoading(false) })
  }, [])

  return (
    <>
      <PageHeader title="Audit Logs" subtitle="Complete history of all admin actions" />
      <Card>
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading...</div>
        ) : (
          <Table headers={['Timestamp', 'User', 'Action', 'Resource', 'ID', 'IP']}>
            {logs.map((log) => (
              <TR key={log.id}>
                <TD className="text-xs text-slate-500 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</TD>
                <TD className="text-slate-400 text-xs">{log.userEmail || '—'}</TD>
                <TD><Badge color={ACTION_COLOR[log.action] || 'slate'}>{log.action}</Badge></TD>
                <TD className="text-slate-300 font-mono text-xs">{log.resource}</TD>
                <TD className="text-slate-500 text-xs">{log.resourceId || '—'}</TD>
                <TD className="text-slate-600 text-xs">{log.ipAddress || '—'}</TD>
              </TR>
            ))}
          </Table>
        )}
        {!loading && logs.length === 0 && (
          <div className="text-center py-12 text-slate-600">No audit logs yet</div>
        )}
      </Card>
    </>
  )
}
