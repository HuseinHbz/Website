import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { WorkspaceHome } from './WorkspaceHome'

export default async function WorkspaceHomePage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Workspaces">
      <WorkspaceHome role={user.role} />
    </AdminShell>
  )
}
