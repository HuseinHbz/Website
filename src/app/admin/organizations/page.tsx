import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { OrganizationHub } from './OrganizationHub'

export default async function OrganizationsPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return <AdminShell user={user} title="Organization Hub"><OrganizationHub /></AdminShell>
}
