import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin Panel | HBZ',
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#080810] text-white antialiased" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
