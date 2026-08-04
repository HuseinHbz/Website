import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { EmployeesManager } from './EmployeesManager'

export const metadata = { title: 'Employees — HBZ Admin' }

// BUG-014 (26.26b): must render inside AdminShell.
export default async function Page() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Employees">
      <EmployeesManager />
    </AdminShell>
  )
}
