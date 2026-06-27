import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { UserStatusBadge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import type { User } from '@/lib/types'

export const metadata = { title: 'Users' }

export default async function UsersPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) redirect('/login')

  const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'
  const res = await fetch(`${API}/api/v1/admin/users?limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (res.status === 401) redirect('/login')

  const json = await res.json()
  const users: User[] = json.data || []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage admin users and their access."
        action={
          <Link href="/users/new">
            <Button>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New User
            </Button>
          </Link>
        }
      />

      {users.length === 0 ? (
        <EmptyState
          title="No users found"
          description="Admin users will appear here."
          icon={
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          }
        />
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <p className="font-medium text-text-primary">{user.name}</p>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span className="text-xs font-medium bg-surface2 px-2 py-0.5 rounded text-text-secondary">
                      {user.role.name}
                    </span>
                  </td>
                  <td>
                    <UserStatusBadge status={user.status} />
                  </td>
                  <td className="text-xs">{formatDate(user.createdAt)}</td>
                  <td>
                    <Link
                      href={`/users/${user.id}/edit`}
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
