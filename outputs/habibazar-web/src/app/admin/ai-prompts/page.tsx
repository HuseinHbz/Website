import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { PromptCenter } from './PromptCenter'

export default async function AiPromptsPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Prompt Center">
      <PromptCenter />
    </AdminShell>
  )
}
