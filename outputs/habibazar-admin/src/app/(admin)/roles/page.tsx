import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Role } from '@/lib/types'

export const metadata = { title: 'Roles' }

export default async function RolesPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) redirect('/login')

  const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'
  const res = await fetch(`${API}/api/v1/admin/roles`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (res.status === 401) redirect('/login')

  const json = await res.json()
  const roles: Role[] = json.data || []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles"
        description="Manage user roles and permissions."
        action={
          <Link href="/roles/new">
            <Button>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Role
            </Button>
          </Link>
        }
      />

      {roles.length === 0 ? (
        <EmptyState
          title="No roles defined"
          description="Create roles to manage user permissions."
          icon={
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          }
        />
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Role Name</th>
                <th>Permissions</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id}>
                  <td>
                    <p className="font-medium text-text-primary">{role.name}</p>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.slice(0, 5).map((perm) => (
                        <span
                          key={perm}
                          className="font-mono text-xs bg-surface2 px-1.5 py-0.5 rounded text-text-muted"
                        >
                          {perm}
                        </span>
                      ))}
                      {role.permissions.length > 5 && (
                        <span className="text-xs text-text-muted">
                          +{role.permissions.length - 5} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <Link
                      href={`/roles/${role.id}/edit`}
                      className="text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
