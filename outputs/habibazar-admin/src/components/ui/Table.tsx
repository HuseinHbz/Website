import { cn } from '@/lib/utils'
import { EmptyState } from './EmptyState'
import { LoadingTable } from './LoadingTable'

export interface Column<T> {
  key: string
  label: string
  render?: (row: T) => React.ReactNode
  className?: string
  headerClassName?: string
}

interface TableProps<T extends Record<string, unknown>> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyTitle?: string
  emptyDescription?: string
  getKey?: (row: T) => string
}

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  emptyTitle = 'No records found',
  emptyDescription,
  getKey,
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.headerClassName}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? null : data.length === 0 ? null : (
            data.map((row, i) => (
              <tr key={getKey ? getKey(row) : i}>
                {columns.map((col) => (
                  <td key={col.key} className={col.className}>
                    {col.render
                      ? col.render(row)
                      : String(row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {loading && <LoadingTable columns={columns.length} />}

      {!loading && data.length === 0 && (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          icon={
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          }
        />
      )}
    </div>
  )
}

export function TableContainer({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('bg-surface border border-border rounded-xl overflow-hidden', className)}>
      {children}
    </div>
  )
}
