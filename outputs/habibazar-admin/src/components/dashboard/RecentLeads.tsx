import Link from 'next/link'
import { formatDate, truncate } from '@/lib/utils'
import { LeadStatusBadge } from '@/components/ui/Badge'
import type { Lead } from '@/lib/types'

interface RecentLeadsProps {
  leads: Lead[]
}

export function RecentLeads({ leads }: RecentLeadsProps) {
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Recent Leads</h3>
        <Link
          href="/leads"
          className="text-xs text-accent hover:text-accent-hover transition-colors"
        >
          View all
        </Link>
      </div>

      {leads.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-text-muted">
          No leads yet.
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-5 py-3">
                Name
              </th>
              <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-5 py-3 hidden sm:table-cell">
                Company
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
            {leads.map((lead) => (
              <tr key={lead.id} className="border-b border-border last:border-0 hover:bg-surface2 transition-colors">
                <td className="px-5 py-3">
                  <Link href={`/leads/${lead.id}`} className="hover:text-accent transition-colors">
                    <p className="text-sm font-medium text-text-primary">{lead.name}</p>
                    {lead.email && (
                      <p className="text-xs text-text-muted">{truncate(lead.email, 30)}</p>
                    )}
                  </Link>
                </td>
                <td className="px-5 py-3 hidden sm:table-cell">
                  <span className="text-sm text-text-secondary">{lead.company || '—'}</span>
                </td>
                <td className="px-5 py-3">
                  <LeadStatusBadge status={lead.status} />
                </td>
                <td className="px-5 py-3 hidden md:table-cell">
                  <span className="text-xs text-text-muted">{formatDate(lead.createdAt)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
