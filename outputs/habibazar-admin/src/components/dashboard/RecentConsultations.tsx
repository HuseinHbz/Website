import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { ConsultationStatusBadge, Badge } from '@/components/ui/Badge'
import type { ConsultationRequest } from '@/lib/types'

interface RecentConsultationsProps {
  consultations: ConsultationRequest[]
}

export function RecentConsultations({ consultations }: RecentConsultationsProps) {
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Recent Consultations</h3>
        <Link
          href="/consultations"
          className="text-xs text-accent hover:text-accent-hover transition-colors"
        >
          View all
        </Link>
      </div>

      {consultations.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-text-muted">
          No consultations yet.
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-5 py-3">
                Name
              </th>
              <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-5 py-3 hidden sm:table-cell">
                Kind
              </th>
              <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-5 py-3">
                Status
              </th>
              <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-5 py-3 hidden md:table-cell">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {consultations.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface2 transition-colors">
                <td className="px-5 py-3">
                  <Link href={`/consultations/${c.id}`} className="hover:text-accent transition-colors">
                    <p className="text-sm font-medium text-text-primary">{c.name}</p>
                    <p className="text-xs text-text-muted">{c.email}</p>
                  </Link>
                </td>
                <td className="px-5 py-3 hidden sm:table-cell">
                  <Badge variant="info">{c.kind.replace('_', ' ')}</Badge>
                </td>
                <td className="px-5 py-3">
                  <ConsultationStatusBadge status={c.status} />
                </td>
                <td className="px-5 py-3 hidden md:table-cell">
                  <span className="text-xs text-text-muted">{formatDate(c.createdAt)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
