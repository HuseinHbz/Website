import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { RoleEditClient } from './RoleEditClient'
import { PageHeader } from '@/components/ui/PageHeader'
import type { Role } from '@/lib/types'

export const metadata = { title: 'Edit Role' }

interface EditRolePageProps {
  params: Promise<{ id: string }>
}

export default async function EditRolePage({ params }: EditRolePageProps) {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) redirect('/login')

  const { id } = await params
  const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'

  const res = await fetch(`${API}/api/v1/admin/roles/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (res.status === 401) redirect('/login')
  if (res.status === 404) notFound()

  const json = await res.json()
  const role: Role = json.data

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Role" description={role.name} />
      <div className="max-w-2xl bg-surface border border-border rounded-xl p-6">
        <RoleEditClient role={role} />
      </div>
    </div>
  )
}
