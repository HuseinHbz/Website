import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { PayrollManager } from './PayrollManager'

export const metadata = { title: 'Payroll — HBZ Admin' }

// BUG-014 (26.26b): must render inside AdminShell.
export default async function Page() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Payroll">
      <PayrollManager />
    </AdminShell>
  )
}
