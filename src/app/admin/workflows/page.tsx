import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { WorkflowManager } from './WorkflowManager'

export default async function WorkflowsPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Workflow Designer">
      <WorkflowManager />
    </AdminShell>
  )
}
