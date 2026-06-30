import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { AcademyManager } from './AcademyManager'

export default async function AcademyAdminPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return <AdminShell user={user} title="Academy Platform"><AcademyManager /></AdminShell>
}
