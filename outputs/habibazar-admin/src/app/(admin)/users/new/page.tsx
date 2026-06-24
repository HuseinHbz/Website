'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiPost, apiGet } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import type { Role } from '@/lib/types'

export default function NewUserPage() {
  const router = useRouter()
  const [roles, setRoles] = useState<Role[]>([])
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    roleId: '',
    status: 'ACTIVE',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet('/api/v1/admin/roles').then((json) => {
      setRoles(json.data || [])
      if (json.data?.length > 0) {
        setFormData((prev) => ({ ...prev, roleId: json.data[0].id }))
      }
    }).catch(() => {})
  }, [])

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
    try {
      await apiPost('/api/v1/admin/users', formData)
      router.push('/users')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New User" description="Create a new admin user." />

      <div className="max-w-lg bg-surface border border-border rounded-xl p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-4 rounded-lg bg-danger/10 border border-danger/20 text-sm text-danger">
              {error}
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
              placeholder="John Doe"
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
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="form-label">Password</label>
            <input
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={8}
              className="form-input"
              placeholder="Minimum 8 characters"
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
              <option value="" disabled>Select a role</option>
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
              onClick={() => router.back()}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary bg-surface2 hover:bg-border rounded-lg transition-colors"
            >
              Cancel
            </button>
            <Button type="submit" loading={loading}>
              Create User
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
