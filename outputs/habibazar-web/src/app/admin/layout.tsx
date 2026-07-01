export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import '../globals.css'
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'

export const metadata: Metadata = {
  title: 'Admin Panel | HBZ',
  robots: { index: false, follow: false },
}

let _initialized = false
async function ensureInit() {
  if (_initialized) return
  runMigrations()
  await seedDatabase()
  _initialized = true
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await ensureInit()
  return (
    <html lang="en">
      <body className="bg-background text-white antialiased font-sans">
        {children}
      </body>
    </html>
  )
}
