import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { ConsultationsView } from './ConsultationsView'

export default async function ConsultationsPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return <AdminShell user={user} title="Consultation Requests"><ConsultationsView /></AdminShell>
}
