import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { AdminDashboard } from './AdminDashboard'

export default async function AdminPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  return (
    <AdminShell user={user} title="Dashboard">
      <AdminDashboard />
    </AdminShell>
  )
}
