import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { workspaceById } from '@/lib/admin/workspaces'
import { DashboardEngine } from '../DashboardEngine'

export default async function WorkspaceDashboardPage({ params }: { params: Promise<{ workspace: string }> }) {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  const { workspace } = await params
  const ws = workspaceById(workspace) ? workspace : 'executive'
  return (
    <AdminShell user={user} title="Dashboard">
      <DashboardEngine workspace={ws} />
    </AdminShell>
  )
}
