'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ALL_PERMISSIONS } from '@/lib/types'
import type { Role } from '@/lib/types'

interface RoleFormProps {
  role?: Role
  onSubmit: (data: { name: string; permissions: string[] }) => Promise<void>
}

// Group permissions by resource
const PERMISSION_GROUPS = [
  { label: 'Leads', perms: ['lead:read', 'lead:write', 'lead:delete'] },
  { label: 'Consultations', perms: ['consultation:read', 'consultation:write'] },
  { label: 'Engagements', perms: ['engagement:read', 'engagement:write'] },
  { label: 'Content', perms: ['content:read', 'content:write', 'content:delete'] },
  { label: 'Users', perms: ['user:read', 'user:write', 'user:delete'] },
  { label: 'Roles', perms: ['role:read', 'role:write'] },
  { label: 'Settings', perms: ['settings:read', 'settings:write'] },
  { label: 'Audit', perms: ['audit:read'] },
  { label: 'AI', perms: ['ai:read'] },
  { label: 'Other', perms: ['testimonial:approve', 'cert:verify', 'consent:write'] },
]

export function RoleForm({ role, onSubmit }: RoleFormProps) {
  const [name, setName] = useState(role?.name || '')
  const [permissions, setPermissions] = useState<Set<string>>(
    new Set(role?.permissions || [])
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function togglePermission(perm: string) {
    setPermissions((prev) => {
      const next = new Set(prev)
      if (next.has(perm)) next.delete(perm)
      else next.add(perm)
      return next
    })
  }

  function toggleGroup(perms: string[]) {
    const allChecked = perms.every((p) => permissions.has(p))
    setPermissions((prev) => {
      const next = new Set(prev)
      if (allChecked) {
        perms.forEach((p) => next.delete(p))
      } else {
        perms.forEach((p) => next.add(p))
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await onSubmit({ name, permissions: Array.from(permissions) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save role')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 rounded-lg bg-danger/10 border border-danger/20 text-sm text-danger">
          {error}
        </div>
      )}

      <div>
        <label className="form-label">Role Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="form-input max-w-xs"
          placeholder="e.g. Editor"
        />
      </div>

      <div>
        <label className="form-label mb-3 block">Permissions</label>
        <div className="space-y-4">
          {PERMISSION_GROUPS.map((group) => {
            const allChecked = group.perms.every((p) => permissions.has(p))
            const someChecked = group.perms.some((p) => permissions.has(p))
            return (
              <div key={group.label} className="bg-surface2 rounded-lg p-4">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.perms)}
                  className="flex items-center gap-2 mb-3"
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      allChecked
                        ? 'bg-accent border-accent'
                        : someChecked
                        ? 'bg-accent/40 border-accent/60'
                        : 'border-border bg-surface'
                    }`}
                  >
                    {(allChecked || someChecked) && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-text-primary">{group.label}</span>
                </button>
                <div className="flex flex-wrap gap-2 ml-6">
                  {group.perms.map((perm) => {
                    const checked = permissions.has(perm)
                    return (
                      <button
                        key={perm}
                        type="button"
                        onClick={() => togglePermission(perm)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors border ${
                          checked
                            ? 'bg-accent/10 border-accent/30 text-accent'
                            : 'bg-surface border-border text-text-muted hover:text-text-primary hover:border-border/70'
                        }`}
                      >
                        {checked && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {perm}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-text-muted">
          {permissions.size} of {ALL_PERMISSIONS.length} permissions selected
        </p>
        <Button type="submit" loading={loading}>
          {role ? 'Update Role' : 'Create Role'}
        </Button>
      </div>
    </form>
  )
}
