'use client'

import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { ConsultationStatusBadge, Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/EmptyState'
import type { ConsultationRequest, Pagination as PaginationType } from '@/lib/types'

interface ConsultationsTableProps {
  consultations: ConsultationRequest[]
  pagination: PaginationType
}

export function ConsultationsTable({ consultations, pagination }: ConsultationsTableProps) {
  if (consultations.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <EmptyState
          title="No consultations found"
          description="Consultation requests will appear here."
          icon={
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
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
              <th>Email</th>
              <th>Kind</th>
              <th>Status</th>
              <th>Preferred Date</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {consultations.map((c) => (
              <tr key={c.id}>
                <td>
                  <p className="font-medium text-text-primary">{c.name}</p>
                  {c.phone && <p className="text-xs text-text-muted">{c.phone}</p>}
                </td>
                <td>{c.email}</td>
                <td>
                  <Badge variant={c.kind === 'ASSESSMENT' ? 'info' : 'default'}>
                    {c.kind === 'ASSESSMENT' ? 'Assessment' : 'Intro Call'}
                  </Badge>
                </td>
                <td>
                  <ConsultationStatusBadge status={c.status} />
                </td>
                <td className="text-xs">
                  {c.preferredDate ? formatDate(c.preferredDate) : <span className="text-text-muted">—</span>}
                </td>
                <td className="text-xs">{formatDate(c.createdAt)}</td>
                <td>
                  <Link
                    href={`/consultations/${c.id}`}
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
