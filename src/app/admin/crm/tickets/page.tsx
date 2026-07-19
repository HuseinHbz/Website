import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { TicketsManager } from './TicketsManager'

export const metadata = { title: 'Support Tickets — HBZ Admin' }

// BUG-014 (26.26b): must render inside AdminShell (sidebar/header/command palette).
export default async function Page() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Support Tickets">
      <TicketsManager />
    </AdminShell>
  )
}
