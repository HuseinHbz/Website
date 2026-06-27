'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiPatch } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import type { User, Role } from '@/lib/types'

interface UserEditClientProps {
  user: User
  roles: Role[]
}

export function UserEditClient({ user, roles }: UserEditClientProps) {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    roleId: user.role.id,
    status: user.status,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)
    try {
      await apiPatch(`/api/v1/admin/users/${user.id}`, formData)
      setSuccess(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-4 rounded-lg bg-danger/10 border border-danger/20 text-sm text-danger">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 rounded-lg bg-success/10 border border-success/20 text-sm text-success">
          User updated successfully.
        </div>
      )}

      <div>
        <label className="form-label">Full Name</label>
        <input
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="form-input"
        />
      </div>

      <div>
        <label className="form-label">Email</label>
        <input
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          required
          className="form-input"
        />
      </div>

      <div>
        <label className="form-label">Role</label>
        <select
          name="roleId"
          value={formData.roleId}
          onChange={handleChange}
          required
          className="form-input"
        >
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="form-label">Status</label>
        <select
          name="status"
          value={formData.status}
          onChange={handleChange}
          className="form-input"
        >
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.push('/users')}
          className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary bg-surface2 hover:bg-border rounded-lg transition-colors"
        >
          Cancel
        </button>
        <Button type="submit" loading={loading}>
          Save Changes
        </Button>
      </div>
    </form>
  )
}
