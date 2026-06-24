'use client'

import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { LeadStatusBadge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Lead, Pagination as PaginationType } from '@/lib/types'

interface LeadsTableProps {
  leads: Lead[]
  pagination: PaginationType
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 70 ? 'bg-success' : score >= 45 ? 'bg-warning' : 'bg-danger'
  const textColor =
    score >= 70 ? 'text-success' : score >= 45 ? 'text-warning' : 'text-danger'

  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 bg-[#1e1e2e] rounded h-1.5">
        <div
          className={`h-1.5 rounded ${color} transition-all`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <span className={`text-xs font-medium tabular-nums ${textColor}`}>{score}</span>
    </div>
  )
}

export function LeadsTable({ leads, pagination }: LeadsTableProps) {
  if (leads.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <EmptyState
          title="No leads found"
          description="Leads will appear here once they are created."
          icon={
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
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
              <th>Email / Phone</th>
              <th>Company</th>
              <th>Source</th>
              <th>Status</th>
              <th>Score</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td>
                  <p className="font-medium text-text-primary">{lead.name}</p>
                </td>
                <td>
                  <div className="space-y-0.5">
                    {lead.email && (
                      <p className="text-xs text-text-secondary">{lead.email}</p>
                    )}
                    {lead.phone && (
                      <p className="text-xs text-text-muted">{lead.phone}</p>
                    )}
                    {!lead.email && !lead.phone && (
                      <span className="text-text-muted">—</span>
                    )}
                  </div>
                </td>
                <td>{lead.company || <span className="text-text-muted">—</span>}</td>
                <td>
                  <span className="font-mono text-xs bg-surface2 px-2 py-0.5 rounded">
                    {lead.source}
                  </span>
                </td>
                <td>
                  <LeadStatusBadge status={lead.status} />
                </td>
                <td>
                  <ScoreBar score={lead.score} />
                </td>
                <td className="text-xs">{formatDate(lead.createdAt)}</td>
                <td>
                  <Link
                    href={`/leads/${lead.id}`}
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
