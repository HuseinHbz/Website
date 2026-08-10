import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { ReviewCenter } from './ReviewCenter'

export const metadata = { title: 'Performance Reviews — HBZ Admin' }

export default async function Page() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Performance Reviews">
      <ReviewCenter />
    </AdminShell>
  )
}
