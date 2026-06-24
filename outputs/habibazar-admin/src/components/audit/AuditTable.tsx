import { formatDateTime, truncate } from '@/lib/utils'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/EmptyState'
import type { AuditLog, Pagination as PaginationType } from '@/lib/types'

interface AuditTableProps {
  logs: AuditLog[]
  pagination: PaginationType
}

export function AuditTable({ logs, pagination }: AuditTableProps) {
  if (logs.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <EmptyState
          title="No audit logs found"
          description="Audit events will appear here as actions are performed."
          icon={
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          }
        />
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Resource</th>
              <th>Resource ID</th>
              <th>User ID</th>
              <th>IP</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>
                  <code className="text-xs font-mono bg-surface2 px-2 py-0.5 rounded text-accent">
                    {log.action}
                  </code>
                </td>
                <td>
                  <span className="text-xs font-medium text-text-secondary">{log.resource}</span>
                </td>
                <td>
                  <span className="font-mono text-xs text-text-muted" title={log.resourceId || ''}>
                    {log.resourceId ? truncate(log.resourceId, 12) : '—'}
                  </span>
                </td>
                <td>
                  <span className="font-mono text-xs text-text-muted" title={log.userId || ''}>
                    {log.userId ? truncate(log.userId, 12) : '—'}
                  </span>
                </td>
                <td>
                  <span className="font-mono text-xs text-text-muted">
                    {log.ipAddress || '—'}
                  </span>
                </td>
                <td className="text-xs whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination pagination={pagination} />
    </div>
  )
}
