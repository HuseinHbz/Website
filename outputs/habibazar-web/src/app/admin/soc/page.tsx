import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { SocDashboard } from './SocDashboard'

export default async function SocPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Security Operations Center">
      <SocDashboard />
    </AdminShell>
  )
}
