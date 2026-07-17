import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { SolutionsManager } from './SolutionsManager'

export default async function SolutionsPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return <AdminShell user={user} title="Technology Solutions"><SolutionsManager /></AdminShell>
}
