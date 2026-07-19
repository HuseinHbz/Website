import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { SkillsManager } from './SkillsManager'

export default async function SkillsPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Skills & Certifications">
      <SkillsManager />
    </AdminShell>
  )
}
