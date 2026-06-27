'use client'

import { useRouter } from 'next/navigation'
import { RoleForm } from '../RoleForm'
import { apiPost } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'

export default function NewRolePage() {
  const router = useRouter()

  async function handleSubmit(data: { name: string; permissions: string[] }) {
    await apiPost('/api/v1/admin/roles', data)
    router.push('/roles')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New Role" description="Create a new role with permissions." />
      <div className="max-w-2xl bg-surface border border-border rounded-xl p-6">
        <RoleForm onSubmit={handleSubmit} />
      </div>
    </div>
  )
}
