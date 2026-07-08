import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { HeroCenter } from './HeroCenter'

export default async function HeroPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Hero Experience Platform">
      <HeroCenter />
    </AdminShell>
  )
}
