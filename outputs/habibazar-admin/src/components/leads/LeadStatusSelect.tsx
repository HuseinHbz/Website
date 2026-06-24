'use client'

import { useState } from 'react'
import { apiPatch } from '@/lib/api'

const STATUS_OPTIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'CONVERTED', label: 'Converted' },
  { value: 'LOST', label: 'Lost' },
]

interface LeadStatusSelectProps {
  leadId: string
  currentStatus: string
  onUpdate?: (status: string) => void
}

export function LeadStatusSelect({ leadId, currentStatus, onUpdate }: LeadStatusSelectProps) {
  const [status, setStatus] = useState(currentStatus)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value
    setLoading(true)
    setError(null)
    try {
      await apiPatch(`/api/v1/admin/leads/${leadId}`, { status: newStatus })
      setStatus(newStatus)
      onUpdate?.(newStatus)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-1">
      <select
        value={status}
        onChange={handleChange}
        disabled={loading}
        className="form-input appearance-none cursor-pointer text-sm py-1.5 disabled:opacity-60"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {loading && (
        <p className="text-xs text-accent animate-pulse">Saving...</p>
      )}
      {error && (
        <p className="text-xs text-danger">{error}</p>
      )}
    </div>
  )
}
