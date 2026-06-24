'use client'

import { useRouter } from 'next/navigation'
import { RoleForm } from '../../RoleForm'
import { apiPatch } from '@/lib/api'
import type { Role } from '@/lib/types'

interface RoleEditClientProps {
  role: Role
}

export function RoleEditClient({ role }: RoleEditClientProps) {
  const router = useRouter()

  async function handleSubmit(data: { name: string; permissions: string[] }) {
    await apiPatch(`/api/v1/admin/roles/${role.id}`, data)
    router.push('/roles')
    router.refresh()
  }

  return <RoleForm role={role} onSubmit={handleSubmit} />
}
