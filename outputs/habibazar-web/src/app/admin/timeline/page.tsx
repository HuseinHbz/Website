import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { TimelineManager } from './TimelineManager'

export default async function TimelinePage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Career Timeline">
      <TimelineManager />
    </AdminShell>
  )
}
