import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { UserEditClient } from './UserEditClient'
import { PageHeader } from '@/components/ui/PageHeader'
import type { User, Role } from '@/lib/types'

export const metadata = { title: 'Edit User' }

interface EditUserPageProps {
  params: Promise<{ id: string }>
}

export default async function EditUserPage({ params }: EditUserPageProps) {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) redirect('/login')

  const { id } = await params
  const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'

  const [userRes, rolesRes] = await Promise.all([
    fetch(`${API}/api/v1/admin/users/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
    fetch(`${API}/api/v1/admin/roles`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
  ])

  if (userRes.status === 401) redirect('/login')
  if (userRes.status === 404) notFound()

  const userJson = await userRes.json()
  const user: User = userJson.data

  let roles: Role[] = []
  if (rolesRes.ok) {
    const rolesJson = await rolesRes.json()
    roles = rolesJson.data || []
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Edit User" description={user.email} />
      <div className="max-w-lg bg-surface border border-border rounded-xl p-6">
        <UserEditClient user={user} roles={roles} />
      </div>
    </div>
  )
}
