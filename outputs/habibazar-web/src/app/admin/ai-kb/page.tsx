import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { AiKbManager } from './AiKbManager'

export default async function AiKbPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return <AdminShell user={user} title="AI Knowledge Base"><AiKbManager /></AdminShell>
}
