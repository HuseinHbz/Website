import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { HealthCenter } from './HealthCenter'

export default async function HealthPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Operational Health Center">
      <HealthCenter role={user.role} />
    </AdminShell>
  )
}
