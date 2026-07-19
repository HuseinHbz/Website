import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { ProjectCenter } from './ProjectCenter'

export default async function ProjectManagementPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Project Center">
      <ProjectCenter />
    </AdminShell>
  )
}
