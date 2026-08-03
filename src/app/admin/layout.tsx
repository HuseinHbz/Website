export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { persianFontVars } from '@/lib/fonts'
import '../globals.css'
import { ThemeProvider } from '@/components/ds/ThemeProvider'
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' })

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
    // suppressHydrationWarning: ThemeProvider stamps data-theme on <html> pre-paint.
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable} ${persianFontVars}`}>
      <body className="bg-background text-text-primary antialiased font-sans">
        <ThemeProvider defaultTheme="system" storageKey="hbz-admin-theme">
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
