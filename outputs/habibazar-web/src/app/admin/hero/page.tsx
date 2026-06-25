import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { HeroEditor } from './HeroEditor'

export default async function HeroPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Hero Section">
      <HeroEditor />
    </AdminShell>
  )
}
