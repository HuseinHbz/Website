import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { OrganizationManager } from './OrganizationManager'

export default async function OrganizationPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return <AdminShell user={user} title="Organization Management"><OrganizationManager /></AdminShell>
}
