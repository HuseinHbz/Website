import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { formatDate, formatDateTime } from '@/lib/utils'
import { LeadStatusBadge } from '@/components/ui/Badge'
import { LeadStatusSelect } from '@/components/leads/LeadStatusSelect'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import type { Lead, LeadEvent } from '@/lib/types'

export const metadata = { title: 'Lead Detail' }

interface LeadDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) redirect('/login')

  const { id } = await params
  const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'

  const [leadRes, eventsRes] = await Promise.all([
    fetch(`${API}/api/v1/admin/leads/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
    fetch(`${API}/api/v1/admin/leads/${id}/events`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
  ])

  if (leadRes.status === 401) redirect('/login')
  if (leadRes.status === 404) notFound()

  const leadJson = await leadRes.json()
  const lead: Lead = leadJson.data

  let events: LeadEvent[] = []
  if (eventsRes.ok) {
    const eventsJson = await eventsRes.json()
    events = eventsJson.data || []
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={lead.name}
        description={`Lead #${lead.id.slice(0, 8)}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
              Lead Information
            </h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-text-muted">Name</dt>
                <dd className="text-sm font-medium text-text-primary mt-0.5">{lead.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Email</dt>
                <dd className="text-sm text-text-primary mt-0.5">{lead.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Phone</dt>
                <dd className="text-sm text-text-primary mt-0.5">{lead.phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Company</dt>
                <dd className="text-sm text-text-primary mt-0.5">{lead.company || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Source</dt>
                <dd className="mt-0.5">
                  <span className="font-mono text-xs bg-surface2 px-2 py-0.5 rounded text-text-secondary">
                    {lead.source}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Score</dt>
                <dd className="text-sm font-bold text-text-primary mt-0.5">{lead.score}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Marketing Consent</dt>
                <dd className="text-sm text-text-primary mt-0.5">
                  {lead.marketingConsent ? 'Yes' : 'No'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Created</dt>
                <dd className="text-sm text-text-primary mt-0.5">{formatDate(lead.createdAt)}</dd>
              </div>
            </dl>

            {lead.notes && (
              <div className="mt-4 pt-4 border-t border-border">
                <dt className="text-xs text-text-muted mb-1">Notes</dt>
                <p className="text-sm text-text-secondary whitespace-pre-wrap">{lead.notes}</p>
              </div>
            )}
          </Card>

          {/* Events timeline */}
          {events.length > 0 && (
            <Card>
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
                Activity Timeline
              </h2>
              <div className="space-y-4">
                {events.map((event) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-accent mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-text-primary">
                        <span className="font-mono bg-surface2 px-1.5 py-0.5 rounded">
                          {event.type}
                        </span>
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {formatDateTime(event.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar: status update */}
        <div className="space-y-4">
          <Card>
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
              Status
            </h2>
            <div className="mb-3">
              <LeadStatusBadge status={lead.status} />
            </div>
            <LeadStatusSelect leadId={lead.id} currentStatus={lead.status} />
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
              Timeline
            </h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-text-muted">Created</span>
                <span className="text-text-secondary">{formatDate(lead.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Updated</span>
                <span className="text-text-secondary">{formatDate(lead.updatedAt)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
