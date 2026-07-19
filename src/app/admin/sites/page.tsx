import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { SitesManager } from './SitesManager'

export default async function SitesPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return <AdminShell user={user} title="Multi-Site Management"><SitesManager /></AdminShell>
}
