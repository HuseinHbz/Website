import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { IndustriesManager } from './IndustriesManager'

export default async function IndustriesPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return <AdminShell user={user} title="Industries"><IndustriesManager /></AdminShell>
}
