import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { WorkspacesManager } from './WorkspacesManager'

export default async function WorkspacesPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return <AdminShell user={user} title="Workspace Management"><WorkspacesManager /></AdminShell>
}
