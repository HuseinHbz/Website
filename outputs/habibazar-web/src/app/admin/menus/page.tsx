import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { MenuBuilder } from './MenuBuilder'

export default async function MenusPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return <AdminShell user={user} title="Menu Builder"><MenuBuilder /></AdminShell>
}
