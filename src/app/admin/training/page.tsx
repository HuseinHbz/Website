import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { TrainingCenter } from './TrainingCenter'

export const metadata = { title: 'Training — HBZ Admin' }

export default async function Page() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Training">
      <TrainingCenter />
    </AdminShell>
  )
}
