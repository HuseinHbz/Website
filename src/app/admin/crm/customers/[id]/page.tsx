import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { Customer360 } from './Customer360'

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  const { id } = await params
  return (
    <AdminShell user={user} title="Customer 360">
      <Customer360 id={Number(id)} />
    </AdminShell>
  )
}
