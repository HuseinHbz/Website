import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { AiAgentsManager } from './AiAgentsManager'

export default async function AiAgentsPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="AI Agents">
      <AiAgentsManager />
    </AdminShell>
  )
}
