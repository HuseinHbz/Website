import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { RecruitmentCenter } from './RecruitmentCenter'

export const metadata = { title: 'Recruitment — HBZ Admin' }

export default async function Page() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Recruitment">
      <RecruitmentCenter />
    </AdminShell>
  )
}
