import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { AiControlCenter } from './AiControlCenter'

export default async function AiControlPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return <AdminShell user={user} title="AI Control Center"><AiControlCenter /></AdminShell>
}
