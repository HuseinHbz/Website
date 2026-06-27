'use client'

import { useState } from 'react'
import { formatDateTime } from '@/lib/utils'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Setting } from '@/lib/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'

interface SettingRowProps {
  setting: Setting
}

function SettingRow({ setting }: SettingRowProps) {
  const [value, setValue] = useState(setting.value)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setLoading(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/settings/${setting.key}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message || 'Save failed')
      }
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  function handleCancel() {
    setValue(setting.value)
    setEditing(false)
    setError(null)
  }

  return (
    <tr>
      <td className="w-48">
        <code className="text-xs font-mono text-accent">{setting.key}</code>
      </td>
      <td>
        {editing ? (
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="form-input text-sm py-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') handleCancel()
            }}
          />
        ) : (
          <span className="text-sm text-text-secondary">{value || '—'}</span>
        )}
        {error && <p className="text-xs text-danger mt-1">{error}</p>}
      </td>
      <td className="text-xs whitespace-nowrap">{formatDateTime(setting.updatedAt)}</td>
      <td>
        {editing ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={loading}
              className="text-xs font-medium text-success hover:text-success/80 transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              className="text-xs font-medium text-text-muted hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="text-xs font-medium text-accent hover:text-accent-hover transition-colors"
            >
              Edit
            </button>
            {saved && <span className="text-xs text-success">Saved</span>}
          </div>
        )}
      </td>
    </tr>
  )
}

interface SettingsClientProps {
  settings: Setting[]
}

export function SettingsClient({ settings }: SettingsClientProps) {
  if (settings.length === 0) {
    return (
      <EmptyState
        title="No settings configured"
        description="Application settings will appear here."
        icon={
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }
      />
    )
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Value</th>
            <th>Last Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {settings.map((setting) => (
            <SettingRow key={setting.id} setting={setting} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
