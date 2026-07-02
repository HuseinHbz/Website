'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, PageHeader, Badge } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

type Log = { id: number; userEmail: string; action: string; resource: string; resourceId: string; createdAt: string; ipAddress: string }

const ACTION_COLOR: Record<string, string> = { CREATE: 'green', UPDATE: 'blue', DELETE: 'red', LOGIN: 'yellow', UPLOAD: 'indigo', LOGOUT: 'slate' }
const ACTION_ICON: Record<string, string> = { CREATE: '✚', UPDATE: '✎', DELETE: '✕', LOGIN: '→', UPLOAD: '↑', LOGOUT: '←' }

function exportCSV(logs: Log[]) {
  const header = 'Date,User,Action,Resource,Resource ID,IP Address'
  const rows = logs.map(l =>
    [new Date(l.createdAt).toLocaleString(), l.userEmail, l.action, l.resource, l.resourceId || '', l.ipAddress || '']
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function AuditView() {
  const t = useT()
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterResource, setFilterResource] = useState('')
  const [page, setPage] = useState(1)
  const PER_PAGE = 50

  useEffect(() => {
    fetch('/api/admin/audit-logs?limit=500')
      .then(r => r.json())
      .then(d => { setLogs(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const uniqueActions = useMemo(() => [...new Set(logs.map(l => l.action))].sort(), [logs])
  const uniqueResources = useMemo(() => [...new Set(logs.map(l => l.resource))].sort(), [logs])

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (filterAction && l.action !== filterAction) return false
      if (filterResource && l.resource !== filterResource) return false
      if (search) {
        const q = search.toLowerCase()
        return l.userEmail?.toLowerCase().includes(q) || l.resource.toLowerCase().includes(q) ||
          l.resourceId?.toLowerCase().includes(q) || l.ipAddress?.includes(q)
      }
      return true
    })
  }, [logs, filterAction, filterResource, search])

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const pageSlice = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const stats = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of logs) counts[l.action] = (counts[l.action] || 0) + 1
    return counts
  }, [logs])

  return (
    <>
      <PageHeader
        title={t('auditCenter')}
        subtitle={t('auditSub')}
        action={
          <button onClick={() => exportCSV(filtered)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-text-primary hover:text-white border border-border hover:border-brand/40 rounded-lg transition-all bg-background">
            ⬇ Export CSV
          </button>
        }
      />

      {/* Action stat pills */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        {Object.entries(ACTION_COLOR).map(([action]) => (
          <button key={action} onClick={() => { setFilterAction(filterAction === action ? '' : action); setPage(1) }}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${filterAction === action ? 'border-brand/40' : 'border-border hover:border-border'}`}
            style={{ background: filterAction === action ? 'rgba(99,102,241,0.1)' : '#0e0e1a' }}>
            <span className="text-base">{ACTION_ICON[action] || '•'}</span>
            <span className="text-[10px] text-text-tertiary uppercase font-bold">{action}</span>
            <span className="text-sm font-bold text-white">{stats[action] || 0}</span>
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex-1 min-w-48">
          <input type="text" placeholder={t('searchAudit')}
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-text-disabled focus:outline-none focus:border-brand transition-colors" />
        </div>
        <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1) }}
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand">
          <option value="">{t('allActions')}</option>
          {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterResource} onChange={e => { setFilterResource(e.target.value); setPage(1) }}
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand">
          <option value="">{t('allResources')}</option>
          {uniqueResources.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {(search || filterAction || filterResource) && (
          <button onClick={() => { setSearch(''); setFilterAction(''); setFilterResource(''); setPage(1) }}
            className="px-3 py-2 text-xs text-text-secondary hover:text-white border border-border rounded-lg">
            ✕ Clear
          </button>
        )}
      </div>

      <Card>
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
          <span className="text-xs text-text-tertiary">
            {filtered.length} entries{(search || filterAction || filterResource) ? ' (filtered)' : ''} · page {page}/{totalPages || 1}
          </span>
          {totalPages > 1 && (
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="text-xs px-2 py-1 rounded text-text-secondary hover:text-white disabled:opacity-30 border border-border">{t('prevPage')}</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="text-xs px-2 py-1 rounded text-text-secondary hover:text-white disabled:opacity-30 border border-border">{t('nextPage')}</button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-text-tertiary">Loading audit logs...</div>
        ) : pageSlice.length === 0 ? (
          <div className="text-center py-12 text-text-disabled">
            {filtered.length === 0 && logs.length > 0 ? 'No entries match your filters.' : 'No audit logs yet.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {[t('time'), t('user'), t('action'), t('resource'), 'ID', 'IP'].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-text-tertiary font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageSlice.map(log => (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-surface transition-colors">
                    <td className="px-4 py-2.5 text-text-tertiary whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-text-secondary max-w-[140px] truncate">{log.userEmail || '—'}</td>
                    <td className="px-4 py-2.5">
                      <Badge color={ACTION_COLOR[log.action] || 'slate'}>{ACTION_ICON[log.action] || ''} {log.action}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-text-primary font-mono">{log.resource}</td>
                    <td className="px-4 py-2.5 text-text-disabled font-mono">{log.resourceId || '—'}</td>
                    <td className="px-4 py-2.5 text-text-disabled">{log.ipAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
