import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { LeadsManager } from './LeadsManager'

export default async function CrmPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="CRM — Leads">
      <LeadsManager />
    </AdminShell>
  )
}
