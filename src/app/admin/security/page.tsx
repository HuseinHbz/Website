import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { SecurityManager } from './SecurityManager'

export default async function SecurityPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return <AdminShell user={user} title="Security & 2FA"><SecurityManager /></AdminShell>
}
