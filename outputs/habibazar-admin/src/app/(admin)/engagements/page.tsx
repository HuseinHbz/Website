import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { formatDate, formatCurrency } from '@/lib/utils'
import { EngagementStageBadge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Engagement } from '@/lib/types'

export const metadata = { title: 'Engagements' }

const STAGES = ['PROSPECT', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'] as const

const STAGE_LABELS: Record<string, string> = {
  PROSPECT: 'Prospect',
  PROPOSAL: 'Proposal',
  NEGOTIATION: 'Negotiation',
  CLOSED_WON: 'Closed Won',
  CLOSED_LOST: 'Closed Lost',
}

export default async function EngagementsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) redirect('/login')

  const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'
  const res = await fetch(`${API}/api/v1/admin/engagements?limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (res.status === 401) redirect('/login')

  const json = await res.json()
  const engagements: Engagement[] = json.data || []

  // Group by stage
  const grouped = STAGES.reduce<Record<string, Engagement[]>>((acc, stage) => {
    acc[stage] = engagements.filter((e) => e.stage === stage)
    return acc
  }, {} as Record<string, Engagement[]>)

  const pipelineValue = engagements
    .filter((e) => e.stage !== 'CLOSED_LOST')
    .reduce((sum, e) => sum + (e.value ? parseFloat(e.value) : 0), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Engagements"
        description="Pipeline view of all engagement opportunities."
      />

      <div className="flex items-center gap-4 p-4 bg-surface border border-border rounded-xl">
        <div>
          <p className="text-xs text-text-muted">Total Pipeline Value</p>
          <p className="text-xl font-bold text-text-primary">{formatCurrency(pipelineValue)}</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div>
          <p className="text-xs text-text-muted">Total Deals</p>
          <p className="text-xl font-bold text-text-primary">{engagements.length}</p>
        </div>
      </div>

      {engagements.length === 0 ? (
        <EmptyState
          title="No engagements yet"
          description="Engagement opportunities will appear here."
          icon={
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {STAGES.map((stage) => (
            <div key={stage} className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <EngagementStageBadge stage={stage} />
                  <span className="text-xs font-medium text-text-muted">
                    {grouped[stage].length}
                  </span>
                </div>
              </div>

              <div className="p-3 space-y-2 min-h-[200px]">
                {grouped[stage].length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-4">Empty</p>
                ) : (
                  grouped[stage].map((engagement) => (
                    <div
                      key={engagement.id}
                      className="p-3 bg-surface2 rounded-lg border border-border/50 hover:border-accent/30 transition-colors"
                    >
                      <p className="text-xs font-mono text-text-muted mb-1">
                        {engagement.id.slice(0, 8)}
                      </p>
                      {engagement.value && (
                        <p className="text-sm font-semibold text-text-primary">
                          {formatCurrency(parseFloat(engagement.value))}
                        </p>
                      )}
                      {engagement.notes && (
                        <p className="text-xs text-text-muted mt-1 line-clamp-2">
                          {engagement.notes}
                        </p>
                      )}
                      <p className="text-xs text-text-muted mt-2">
                        {formatDate(engagement.createdAt)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
