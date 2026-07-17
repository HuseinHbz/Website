import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { ReportingCenter } from './ReportingCenter'

export default async function ReportsPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Reporting Center">
      <ReportingCenter />
    </AdminShell>
  )
}
