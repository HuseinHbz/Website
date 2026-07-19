import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { TechnologiesManager } from './TechnologiesManager'

export default async function TechnologiesPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return <AdminShell user={user} title="Technology Ecosystem"><TechnologiesManager /></AdminShell>
}
