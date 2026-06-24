'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { formatDate, formatDateTime } from '@/lib/utils'
import { ConsultationStatusBadge, Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { apiPatch } from '@/lib/api'
import type { ConsultationRequest } from '@/lib/types'

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

function ConsultationStatusForm({ consultation }: { consultation: ConsultationRequest }) {
  const [status, setStatus] = useState(consultation.status)
  const [notes, setNotes] = useState(consultation.notes || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)
    try {
      await apiPatch(`/api/v1/admin/consultations/${consultation.id}`, { status, notes })
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="form-label">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ConsultationRequest['status'])}
          className="form-input"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="form-label">Internal Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="form-input resize-none"
          placeholder="Add internal notes..."
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {success && <p className="text-xs text-success">Updated successfully.</p>}
      <Button type="submit" loading={loading} className="w-full">
        Update
      </Button>
    </form>
  )
}

export default function ConsultationDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [consultation, setConsultation] = useState<ConsultationRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'
    fetch(`${API}/api/v1/admin/consultations/${params.id}`, {
      credentials: 'include',
    })
      .then((res) => {
        if (res.status === 401) router.push('/login')
        if (!res.ok) throw new Error('Not found')
        return res.json()
      })
      .then((json) => setConsultation(json.data))
      .catch(() => setError('Failed to load consultation.'))
      .finally(() => setLoading(false))
  }, [params.id, router])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-surface2 rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-64 bg-surface border border-border rounded-xl animate-pulse" />
          <div className="h-64 bg-surface border border-border rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (error || !consultation) {
    return (
      <div className="p-6 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm">
        {error || 'Consultation not found.'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={consultation.name}
        description={`Consultation #${consultation.id.slice(0, 8)}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
              Details
            </h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-text-muted">Name</dt>
                <dd className="text-sm font-medium text-text-primary mt-0.5">{consultation.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Email</dt>
                <dd className="text-sm text-text-primary mt-0.5">{consultation.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Phone</dt>
                <dd className="text-sm text-text-primary mt-0.5">{consultation.phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Kind</dt>
                <dd className="mt-0.5">
                  <Badge variant={consultation.kind === 'ASSESSMENT' ? 'info' : 'default'}>
                    {consultation.kind === 'ASSESSMENT' ? 'Assessment' : 'Intro Call'}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Preferred Date</dt>
                <dd className="text-sm text-text-primary mt-0.5">
                  {consultation.preferredDate ? formatDate(consultation.preferredDate) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Created</dt>
                <dd className="text-sm text-text-primary mt-0.5">
                  {formatDateTime(consultation.createdAt)}
                </dd>
              </div>
            </dl>

            {consultation.message && (
              <div className="mt-4 pt-4 border-t border-border">
                <dt className="text-xs text-text-muted mb-1">Message</dt>
                <p className="text-sm text-text-secondary whitespace-pre-wrap">
                  {consultation.message}
                </p>
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card>
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
              Update Status
            </h2>
            <div className="mb-4">
              <ConsultationStatusBadge status={consultation.status} />
            </div>
            <ConsultationStatusForm consultation={consultation} />
          </Card>
        </div>
      </div>
    </div>
  )
}
