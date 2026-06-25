import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { AdminDashboard } from './AdminDashboard'
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'

let initialized = false
async function ensureInit() {
  if (!initialized) {
    runMigrations()
    await seedDatabase()
    initialized = true
  }
}

export default async function AdminPage() {
  await ensureInit()
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  return (
    <AdminShell user={user} title="Dashboard">
      <AdminDashboard />
    </AdminShell>
  )
}
