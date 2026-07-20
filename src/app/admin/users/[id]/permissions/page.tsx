import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { PermissionTree } from './PermissionTree'

export default async function UserPermissionsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  const { id } = await params
  return (
    <AdminShell user={user} title="Permissions">
      <PermissionTree userId={id} />
    </AdminShell>
  )
}
