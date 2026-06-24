import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Conversation, Pagination as PaginationType } from '@/lib/types'

interface ConversationsListProps {
  conversations: Conversation[]
  pagination: PaginationType
}

export function ConversationsList({ conversations, pagination }: ConversationsListProps) {
  if (conversations.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <EmptyState
          title="No conversations yet"
          description="AI conversations will appear here once users interact with the assistant."
          icon={
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
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
              <th>Name</th>
              <th>Company</th>
              <th>Category</th>
              <th>Locale</th>
              <th>Turns</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {conversations.map((conv) => (
              <tr key={conv.id}>
                <td>
                  <p className="font-medium text-text-primary">{conv.name || '—'}</p>
                  {conv.phone && <p className="text-xs text-text-muted">{conv.phone}</p>}
                </td>
                <td>{conv.company || <span className="text-text-muted">—</span>}</td>
                <td>
                  {conv.category ? (
                    <Badge variant="info">{conv.category}</Badge>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td>
                  <span className="font-mono text-xs bg-surface2 px-2 py-0.5 rounded text-text-secondary">
                    {conv.locale}
                  </span>
                </td>
                <td>
                  <span className="text-sm font-medium text-text-primary">{conv.turnCount}</span>
                </td>
                <td className="text-xs">{formatDate(conv.createdAt)}</td>
                <td>
                  <Link
                    href={`/ai/${conv.id}`}
                    className="text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination pagination={pagination} />
    </div>
  )
}
